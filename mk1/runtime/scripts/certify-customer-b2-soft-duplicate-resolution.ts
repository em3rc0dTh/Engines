import assert from 'node:assert/strict';
import { Pool } from 'pg';
import { loadRuntimeConfig } from '../src/config/runtime-config.js';
import type { RegistrationStateProjection } from '../src/contracts/register-new-customer/index.js';
import { TemporalRegisterNewCustomerPort } from '../src/orchestration/temporal/ports/register-new-customer.temporal-port.js';
import {
  getRegistrationStateQuery,
  resolveCustomerDuplicateUpdate,
} from '../src/orchestration/temporal/workflows/register-new-customer.workflow.js';
import { PostgresChannelRepository } from '../src/persistence/postgres/channel.repository.js';
import { CustomerRegistrationChannelExecutionCore } from '../src/cta/channel-core/customer-registration-channel-execution.js';
import type {
  CanonicalChannelEnvelope,
  ChannelKind,
} from '../src/cta/channel-core/types.js';

const BUSINESS_SLUG = 'golden-business';
const POLL_MS = 75;
const TIMEOUT_MS = 15_000;

type LabChannel = Extract<ChannelKind, 'TELEGRAM' | 'WHATSAPP'>;

type CustomerSpec = Readonly<{
  name: string;
  phone: string;
  email: string;
}>;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function startEnvelope(
  channel: LabChannel,
  conversation: string,
  message: string,
  customer: CustomerSpec,
): CanonicalChannelEnvelope {
  return {
    version: 'v1',
    channel,
    businessSlug: BUSINESS_SLUG,
    externalConversationId: `${channel.toLowerCase()}:${conversation}`,
    externalMessageId: `${channel.toLowerCase()}:message:${message}`,
    externalSenderId: `${channel.toLowerCase()}:sender:${conversation}`,
    action: 'START_CUSTOMER_REGISTRATION',
    payload: {
      consentAccepted: true,
      draft: {
        customer: {
          name: customer.name,
          contact: {
            phones: [{ number: customer.phone }],
            email: customer.email,
          },
        },
      },
    },
  };
}

function duplicateDecisionEnvelope(
  channel: LabChannel,
  conversation: string,
  message: string,
  decision: 'USE_EXISTING' | 'CREATE_NEW',
): CanonicalChannelEnvelope {
  return {
    version: 'v1',
    channel,
    businessSlug: BUSINESS_SLUG,
    externalConversationId: `${channel.toLowerCase()}:${conversation}`,
    externalMessageId: `${channel.toLowerCase()}:message:${message}`,
    externalSenderId: `${channel.toLowerCase()}:sender:${conversation}`,
    action: 'RESOLVE_CUSTOMER_DUPLICATE',
    payload: { decision },
  };
}

async function waitForState(
  port: TemporalRegisterNewCustomerPort,
  workflowId: string,
  predicate: (state: RegistrationStateProjection) => boolean,
  label: string,
): Promise<RegistrationStateProjection> {
  const handle = port.getClient().workflow.getHandle(workflowId);
  const deadline = Date.now() + TIMEOUT_MS;
  let last: RegistrationStateProjection | undefined;

  while (Date.now() < deadline) {
    try {
      const state = await handle.query(getRegistrationStateQuery) as RegistrationStateProjection;
      last = state;
      if (predicate(state)) return state;
    } catch {
      // Query visibility can lag immediately after start/completion.
    }
    await sleep(POLL_MS);
  }

  throw new Error(`B2_STATE_TIMEOUT:${label}:${last?.phase ?? 'unavailable'}`);
}

async function seedCustomer(
  core: CustomerRegistrationChannelExecutionCore,
  port: TemporalRegisterNewCustomerPort,
  channel: LabChannel,
  conversation: string,
  customer: CustomerSpec,
): Promise<Readonly<{ workflowId: string; customerId: string }>> {
  const response = await core.execute(startEnvelope(channel, conversation, 'start', customer));
  assert.equal(response.ok, true, `${conversation} start must succeed`);
  assert.ok(response.workflowId, `${conversation} must expose workflowId`);

  const state = await waitForState(
    port,
    response.workflowId,
    (candidate) => candidate.workflowStatus === 'COMPLETED',
    `${conversation}-complete`,
  );
  assert.equal(state.phase, 'CREATED', `${conversation} seed must create a Customer`);
  assert.ok(state.customerId, `${conversation} seed must expose customerId`);
  return { workflowId: response.workflowId, customerId: state.customerId };
}

async function startSoftMatch(
  core: CustomerRegistrationChannelExecutionCore,
  port: TemporalRegisterNewCustomerPort,
  channel: LabChannel,
  conversation: string,
  customer: CustomerSpec,
): Promise<Readonly<{ workflowId: string; state: RegistrationStateProjection }>> {
  const response = await core.execute(startEnvelope(channel, conversation, 'start', customer));
  assert.equal(response.ok, true, `${conversation} start must succeed`);
  assert.ok(response.workflowId, `${conversation} must expose workflowId`);

  const state = await waitForState(
    port,
    response.workflowId,
    (candidate) => candidate.nextAction === 'RESOLVE_DUPLICATE',
    `${conversation}-soft-match`,
  );
  assert.equal(state.phase, 'WAITING_FOR_DUPLICATE_DECISION');
  assert.equal(state.possibleDuplicate?.classification, 'SOFT_MATCH');
  assert.ok(state.possibleDuplicate.candidateCustomerIds.length > 0);
  return { workflowId: response.workflowId, state };
}

async function run(): Promise<void> {
  const config = loadRuntimeConfig();
  const pool = new Pool({ connectionString: config.postgresUrl, max: 4 });
  const repository = new PostgresChannelRepository(pool);
  const port = await TemporalRegisterNewCustomerPort.connect();
  const core = new CustomerRegistrationChannelExecutionCore(repository, port);

  try {
    // B2-01 + B2-03 + B2-04: one soft match, invalid candidate rejection,
    // canonical use-existing resolution and exact channel-event replay.
    const existingEmail = 'b2.use-existing@example.com';
    const existing = await seedCustomer(core, port, 'TELEGRAM', 'b2-existing-seed', {
      name: 'B2 Existing Seed',
      phone: '+51981000001',
      email: existingEmail,
    });

    const contender = await startSoftMatch(core, port, 'WHATSAPP', 'b2-existing-contender', {
      name: 'B2 Existing Contender',
      phone: '+51981000002',
      email: existingEmail,
    });
    assert.deepEqual(contender.state.possibleDuplicate?.candidateCustomerIds, [existing.customerId]);

    const contenderHandle = port.getClient().workflow.getHandle(contender.workflowId);
    const invalidCandidate = await contenderHandle.executeUpdate(resolveCustomerDuplicateUpdate, {
      args: [{
        inputId: 'b2-invalid-candidate',
        decision: 'USE_EXISTING',
        customerId: 'cus_not_in_candidate_set',
      }],
    });
    assert.equal(invalidCandidate.ok, false, 'B2-04 invalid candidate must be rejected');
    assert.equal(invalidCandidate.state.phase, 'WAITING_FOR_DUPLICATE_DECISION');
    assert.equal(invalidCandidate.state.nextAction, 'RESOLVE_DUPLICATE');
    console.log('CUSTOMER_B2_INVALID_CANDIDATE_REJECTED_PASS');

    const resolutionEnvelope = duplicateDecisionEnvelope(
      'WHATSAPP',
      'b2-existing-contender',
      'resolve-existing',
      'USE_EXISTING',
    );
    const resolved = await core.execute(resolutionEnvelope);
    assert.equal(resolved.ok, true, 'B2-01 use-existing decision must be accepted');
    assert.equal(resolved.replayed, false);

    const replayed = await core.execute(resolutionEnvelope);
    assert.equal(replayed.ok, true, 'B2-03 exact duplicate decision replay must remain successful');
    assert.equal(replayed.replayed, true, 'B2-03 exact duplicate decision must replay from durable channel ledger');
    console.log('CUSTOMER_B2_DUPLICATE_DECISION_REPLAY_PASS');

    const existingTerminal = await waitForState(
      port,
      contender.workflowId,
      (candidate) => candidate.workflowStatus === 'COMPLETED',
      'use-existing-terminal',
    );
    assert.equal(existingTerminal.phase, 'ALREADY_EXISTS');
    assert.equal(existingTerminal.customerId, existing.customerId);
    console.log('CUSTOMER_B2_USE_EXISTING_PASS', JSON.stringify({
      seedCustomerId: existing.customerId,
      resolvedCustomerId: existingTerminal.customerId,
      workflowId: contender.workflowId,
    }));

    // B2-02: soft match may explicitly create a distinct Customer while the
    // existing hard-unique document rule remains untouched.
    const createNewEmail = 'b2.create-new@example.com';
    const createNewSeed = await seedCustomer(core, port, 'TELEGRAM', 'b2-create-new-seed', {
      name: 'B2 Create New Seed',
      phone: '+51982000001',
      email: createNewEmail,
    });

    const createNewContender = await startSoftMatch(core, port, 'WHATSAPP', 'b2-create-new-contender', {
      name: 'B2 Create New Contender',
      phone: '+51982000002',
      email: createNewEmail,
    });
    assert.deepEqual(createNewContender.state.possibleDuplicate?.candidateCustomerIds, [createNewSeed.customerId]);

    const createNewResolution = await core.execute(duplicateDecisionEnvelope(
      'WHATSAPP',
      'b2-create-new-contender',
      'resolve-create-new',
      'CREATE_NEW',
    ));
    assert.equal(createNewResolution.ok, true, 'B2-02 create-new decision must be accepted');

    const createNewTerminal = await waitForState(
      port,
      createNewContender.workflowId,
      (candidate) => candidate.workflowStatus === 'COMPLETED',
      'create-new-terminal',
    );
    assert.equal(createNewTerminal.phase, 'CREATED');
    assert.ok(createNewTerminal.customerId);
    assert.notEqual(createNewTerminal.customerId, createNewSeed.customerId);
    console.log('CUSTOMER_B2_CREATE_NEW_PASS', JSON.stringify({
      seedCustomerId: createNewSeed.customerId,
      createdCustomerId: createNewTerminal.customerId,
      workflowId: createNewContender.workflowId,
    }));

    console.log('CUSTOMER_B2_SOFT_DUPLICATE_RESOLUTION_PASS', JSON.stringify({
      useExisting: true,
      createNew: true,
      invalidCandidateRejected: true,
      exactDecisionReplay: true,
      agent: false,
      mcp: false,
    }));
  } finally {
    await Promise.allSettled([port.close(), pool.end()]);
  }
}

run().catch((error: unknown) => {
  console.error('CUSTOMER_B2_SOFT_DUPLICATE_RESOLUTION_FAIL', error);
  process.exitCode = 1;
});
