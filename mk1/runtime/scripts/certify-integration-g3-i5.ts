import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { Client, Connection } from '@temporalio/client';
import { NativeConnection, Worker } from '@temporalio/worker';
import { Pool } from 'pg';
import { loadRuntimeConfig } from '../src/config/runtime-config.js';
import type { IntegrationCommand, IntegrationEvent } from '../src/contracts/integration-engine/index.js';
import { IntegrationProviderAdapterRegistry, type IntegrationProviderAdapter } from '../src/integration/provider.js';
import { PostgresIntegrationOutboundLedger } from '../src/persistence/postgres/integration-outbound-ledger.repository.js';
import { PostgresIntegrationRegistryRepository } from '../src/persistence/postgres/integration-registry.repository.js';
import { createIntegrationDeliveryActivities } from '../src/orchestration/temporal/activities/integration-delivery.activities.js';
import type { IntegrationTemporalActivities } from '../src/orchestration/temporal/activities/integration-delivery.types.js';
import {
  integrationDeliveryWorkflow,
  integrationEventHandoffWorkflow,
} from '../src/orchestration/temporal/workflows/integration.workflows.js';

const PROVIDER_KIND = 'g3-i5-cert-provider';
const CAPABILITY = 'messaging.send';
const TASK_QUEUE = `engines-g3-i5-cert-${process.pid}`;

function command(operationId: string, connectionRef: string): IntegrationCommand {
  return {
    schemaVersion: 1,
    commandId: `command:${operationId}`,
    operationId,
    businessSlug: 'g3-i5-cert-business',
    connectionRef,
    capability: CAPABILITY,
    action: 'certify',
    targetRef: { kind: 'certification-target', ref: 'provider-neutral' },
    payload: { certification: true },
    requestedAt: new Date().toISOString(),
    correlation: { correlationId: operationId },
  };
}

async function run(): Promise<void> {
  const config = loadRuntimeConfig();
  const pool = new Pool({ connectionString: config.postgresUrl, max: 8 });
  const registry = new PostgresIntegrationRegistryRepository(pool);
  const ledger = new PostgresIntegrationOutboundLedger(pool);
  const connectionRef = `i5-cert-${process.pid}`;
  const now = new Date().toISOString();
  const providerCalls = new Map<string, number>();

  const adapter: IntegrationProviderAdapter = {
    providerKind: PROVIDER_KIND,
    async deliver(providerCommand) {
      const calls = (providerCalls.get(providerCommand.operationId) ?? 0) + 1;
      providerCalls.set(providerCommand.operationId, calls);

      if (providerCommand.operationId === 'i5-retry-then-success' && calls === 1) {
        return { kind: 'RETRYABLE', errorCode: 'TRANSIENT_PROVIDER_FAILURE' };
      }
      if (providerCommand.operationId === 'i5-permanent-failure') {
        return { kind: 'FAILED_PERMANENT', errorCode: 'PROVIDER_REJECTED' };
      }
      return { kind: 'SUCCEEDED', providerReceiptRef: `i5-cert-receipt:${providerCommand.operationId}` };
    },
  };

  const adapters = new IntegrationProviderAdapterRegistry([adapter]);
  const baseActivities = createIntegrationDeliveryActivities({
    connections: registry,
    ledger,
    adapters,
    leaseSeconds: 2,
  });

  let injectedPostCommitFailure = true;
  const activities: IntegrationTemporalActivities = {
    async executeIntegrationDelivery(input) {
      const result = await baseActivities.executeIntegrationDelivery(input);
      if (
        input.operationId === 'i5-post-commit-recovery'
        && result.status === 'SUCCEEDED'
        && injectedPostCommitFailure
      ) {
        injectedPostCommitFailure = false;
        throw new Error('G3_I5_INJECTED_ACTIVITY_FAILURE_AFTER_DURABLE_SUCCESS');
      }
      return result;
    },
  };

  const temporalConnection = await Connection.connect({ address: config.temporalAddress });
  const nativeConnection = await NativeConnection.connect({ address: config.temporalAddress });
  let worker: Worker | undefined;
  let workerRun: Promise<void> | undefined;

  try {
    await registry.registerProvider({
      providerKind: PROVIDER_KIND,
      displayName: 'G3 I5 certification provider',
      status: 'ENABLED',
      capabilities: [CAPABILITY],
      revision: 1,
    });
    await registry.registerConnection({
      connectionRef,
      businessSlug: 'g3-i5-cert-business',
      providerKind: PROVIDER_KIND,
      status: 'ENABLED',
      capabilities: [CAPABILITY],
      secretRefs: [],
      revision: 1,
      createdAt: now,
      updatedAt: now,
    });

    for (const operationId of [
      'i5-post-commit-recovery',
      'i5-retry-then-success',
      'i5-permanent-failure',
    ]) {
      await ledger.enqueue(command(operationId, connectionRef), 3);
    }

    const workflowsPath = fileURLToPath(new URL('../src/orchestration/temporal/workflows/integration.workflows.ts', import.meta.url));
    worker = await Worker.create({
      connection: nativeConnection,
      namespace: config.temporalNamespace,
      taskQueue: TASK_QUEUE,
      workflowsPath,
      activities,
    });
    workerRun = worker.run();

    const client = new Client({ connection: temporalConnection, namespace: config.temporalNamespace });

    const recovery = await client.workflow.execute(integrationDeliveryWorkflow, {
      taskQueue: TASK_QUEUE,
      workflowId: `g3-i5-recovery-${Date.now()}`,
      args: [{ businessSlug: 'g3-i5-cert-business', operationId: 'i5-post-commit-recovery' }],
    });
    assert.equal(recovery.status, 'SUCCEEDED');
    assert.equal(providerCalls.get('i5-post-commit-recovery'), 1);
    assert.equal(injectedPostCommitFailure, false);
    const recoveryAttempts = await ledger.listAttempts('g3-i5-cert-business', 'i5-post-commit-recovery');
    assert.equal(recoveryAttempts.length, 1);
    assert.equal(recoveryAttempts[0]?.outcome, 'SUCCEEDED');
    console.log('INTEGRATION_G3_I5_ACTIVITY_RETRY_TERMINAL_REPLAY_PASS');

    const retry = await client.workflow.execute(integrationDeliveryWorkflow, {
      taskQueue: TASK_QUEUE,
      workflowId: `g3-i5-retry-${Date.now()}`,
      args: [{ businessSlug: 'g3-i5-cert-business', operationId: 'i5-retry-then-success' }],
    });
    assert.equal(retry.status, 'SUCCEEDED');
    assert.equal(providerCalls.get('i5-retry-then-success'), 2);
    const retryAttempts = await ledger.listAttempts('g3-i5-cert-business', 'i5-retry-then-success');
    assert.equal(retryAttempts.length, 2);
    assert.equal(retryAttempts[0]?.outcome, 'RETRYABLE');
    assert.equal(retryAttempts[1]?.outcome, 'SUCCEEDED');
    console.log('INTEGRATION_G3_I5_I2_RETRY_AUTHORITY_PASS');

    const permanent = await client.workflow.execute(integrationDeliveryWorkflow, {
      taskQueue: TASK_QUEUE,
      workflowId: `g3-i5-permanent-${Date.now()}`,
      args: [{ businessSlug: 'g3-i5-cert-business', operationId: 'i5-permanent-failure' }],
    });
    assert.equal(permanent.status, 'FAILED_PERMANENT');
    assert.equal(permanent.lastErrorCode, 'PROVIDER_REJECTED');
    assert.equal(providerCalls.get('i5-permanent-failure'), 1);
    console.log('INTEGRATION_G3_I5_TERMINAL_FAILURE_PASS');

    const canonicalEvent: IntegrationEvent = {
      schemaVersion: 1,
      eventId: 'integration-event:g3-i5-handoff',
      providerEventIdentity: 'cert-provider-event:g3-i5-handoff',
      businessSlug: 'g3-i5-cert-business',
      connectionRef,
      capability: 'messaging.receive',
      eventType: 'message.received',
      payload: { message: { kind: 'text', text: 'provider-neutral-certification-event' } },
      receivedAt: new Date().toISOString(),
      correlation: { correlationId: 'g3-i5-handoff' },
    };
    const handoff = await client.workflow.execute(integrationEventHandoffWorkflow, {
      taskQueue: TASK_QUEUE,
      workflowId: `g3-i5-handoff-${Date.now()}`,
      args: [{ event: canonicalEvent }],
    });
    assert.equal(handoff.eventId, canonicalEvent.eventId);
    assert.equal(handoff.eventType, canonicalEvent.eventType);
    assert.equal(JSON.stringify(handoff).includes('provider-neutral-certification-event'), false);
    console.log('INTEGRATION_G3_I5_CANONICAL_EVENT_HANDOFF_PASS');

    const recoveryReplay = await client.workflow.execute(integrationDeliveryWorkflow, {
      taskQueue: TASK_QUEUE,
      workflowId: `g3-i5-terminal-replay-${Date.now()}`,
      args: [{ businessSlug: 'g3-i5-cert-business', operationId: 'i5-post-commit-recovery' }],
    });
    assert.equal(recoveryReplay.status, 'SUCCEEDED');
    assert.equal(providerCalls.get('i5-post-commit-recovery'), 1);
    console.log('INTEGRATION_G3_I5_WORKFLOW_REPLAY_NO_DUPLICATE_PROVIDER_ATTEMPT_PASS');

    const durableProjection = JSON.stringify({ recovery, retry, permanent, handoff });
    for (const forbidden of ['api_key', 'access_token', 'authorization', 'webhook_secret', 'raw_body', 'headers']) {
      assert.equal(durableProjection.toLowerCase().includes(forbidden), false);
    }
    console.log('INTEGRATION_G3_I5_WORKFLOW_HISTORY_BOUNDARY_PASS');
    console.log('INTEGRATION_G3_I5_CERTIFICATION_PASS');
  } finally {
    if (worker) worker.shutdown();
    if (workerRun) await workerRun.catch(() => undefined);
    await nativeConnection.close();
    await temporalConnection.close();
    await pool.end();
  }
}

run().catch((error: unknown) => {
  console.error(`INTEGRATION_G3_I5_CERTIFICATION_FAILED ${JSON.stringify({
    error: error instanceof Error ? error.message : String(error),
  })}`);
  process.exitCode = 1;
});
