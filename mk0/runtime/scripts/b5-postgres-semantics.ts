import assert from 'node:assert/strict';
import {
  REGISTER_NEW_CUSTOMER_OPERATION,
  REGISTER_NEW_CUSTOMER_SCHEMA_VERSION,
  type RegisterNewCustomerStartEnvelope,
} from '../src/contracts/register-new-customer/index.js';
import {
  closePostgresRegistrationActivities,
  postgresRegistrationActivities,
} from '../src/orchestration/temporal/activities/postgres-registration.activities.js';

function start(draftName: string): RegisterNewCustomerStartEnvelope {
  return {
    operation: REGISTER_NEW_CUSTOMER_OPERATION,
    businessSlug: 'b5-repository-probe',
    draft: {
      customer: {
        name: draftName,
        contact: { email: 'probe@example.test' },
      },
    },
    request: { idempotencyKey: 'opaque-probe-key-do-not-store-raw' },
    schemaVersion: REGISTER_NEW_CUSTOMER_SCHEMA_VERSION,
  };
}

async function run(): Promise<void> {
  const original = start('Probe Customer');
  const first = await postgresRegistrationActivities.reserveRegistrationSession({
    start: original,
    workflowId: 'b5-probe-workflow',
  });
  assert.equal(first.kind, 'RESERVED');

  const replay = await postgresRegistrationActivities.reserveRegistrationSession({
    start: original,
    workflowId: 'b5-probe-workflow',
  });
  assert.equal(replay.kind, 'REPLAY');
  assert.equal(replay.registrationId, first.registrationId);

  const conflict = await postgresRegistrationActivities.reserveRegistrationSession({
    start: start('Materially Different Initial Draft'),
    workflowId: 'b5-probe-workflow-conflict',
  });
  assert.equal(conflict.kind, 'CONFLICT');
  assert.equal(conflict.registrationId, first.registrationId);

  const created = await postgresRegistrationActivities.createCustomer({
    registrationId: first.registrationId,
    businessSlug: original.businessSlug,
    customer: original.draft?.customer ?? {},
    enforceHardUniqueDocument: false,
  });
  assert.equal(created.kind, 'CREATED');
  if (created.kind !== 'CREATED') throw new Error('expected CREATED');
  assert.equal(created.reused, false);

  const repeatedCreate = await postgresRegistrationActivities.createCustomer({
    registrationId: first.registrationId,
    businessSlug: original.businessSlug,
    customer: original.draft?.customer ?? {},
    enforceHardUniqueDocument: false,
  });
  assert.equal(repeatedCreate.kind, 'CREATED');
  if (repeatedCreate.kind !== 'CREATED') throw new Error('expected CREATED replay');
  assert.equal(repeatedCreate.customerId, created.customerId);
  assert.equal(repeatedCreate.reused, true);

  console.log(
    `B5_POSTGRES_SEMANTICS_OK ${JSON.stringify({
      registrationId: first.registrationId,
      customerId: created.customerId,
      exactReplay: replay.kind,
      conflict: conflict.kind,
      repeatedCreateReused: repeatedCreate.reused,
    })}`,
  );
}

run()
  .catch((error: unknown) => {
    console.error(
      `B5_POSTGRES_SEMANTICS_FAILED ${JSON.stringify({
        error: error instanceof Error ? error.message : String(error),
      })}`,
    );
    process.exitCode = 1;
  })
  .finally(async () => {
    await closePostgresRegistrationActivities();
  });
