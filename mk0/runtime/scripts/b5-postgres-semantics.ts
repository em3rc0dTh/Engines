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

function start(input: {
  businessSlug: string;
  idempotencyKey: string;
  name: string;
  email: string;
  documentValue?: string;
}): RegisterNewCustomerStartEnvelope {
  return {
    operation: REGISTER_NEW_CUSTOMER_OPERATION,
    businessSlug: input.businessSlug,
    draft: {
      customer: {
        name: input.name,
        contact: { email: input.email },
        ...(input.documentValue
          ? { document: { type: 'DNI', country: 'PE', value: input.documentValue } }
          : {}),
      },
    },
    request: { idempotencyKey: input.idempotencyKey },
    schemaVersion: REGISTER_NEW_CUSTOMER_SCHEMA_VERSION,
  };
}

async function reserve(envelope: RegisterNewCustomerStartEnvelope, workflowId: string) {
  return postgresRegistrationActivities.reserveRegistrationSession({ start: envelope, workflowId });
}

async function run(): Promise<void> {
  const opaqueKey = 'opaque-probe-key-do-not-store-raw';
  const original = start({
    businessSlug: 'b5-repository-probe',
    idempotencyKey: opaqueKey,
    name: 'Probe Customer',
    email: 'probe@example.test',
  });

  const first = await reserve(original, 'b5-probe-workflow');
  assert.equal(first.kind, 'RESERVED');

  const replay = await reserve(original, 'b5-probe-workflow');
  assert.equal(replay.kind, 'REPLAY');
  assert.equal(replay.registrationId, first.registrationId);

  const conflict = await reserve(
    start({
      businessSlug: original.businessSlug,
      idempotencyKey: opaqueKey,
      name: 'Materially Different Initial Draft',
      email: 'probe@example.test',
    }),
    'b5-probe-workflow-conflict',
  );
  assert.equal(conflict.kind, 'CONFLICT');
  assert.equal(conflict.registrationId, first.registrationId);

  const otherBusiness = await reserve(
    start({
      businessSlug: 'b5-other-business-probe',
      idempotencyKey: opaqueKey,
      name: 'Same Opaque Key Other Business',
      email: 'other-business@example.test',
    }),
    'b5-other-business-workflow',
  );
  assert.equal(otherBusiness.kind, 'RESERVED');
  assert.notEqual(otherBusiness.registrationId, first.registrationId);

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

  const raceA = start({
    businessSlug: 'b5-race-probe',
    idempotencyKey: 'race-a',
    name: 'Race A',
    email: 'race-a@example.test',
    documentValue: 'RACE-001',
  });
  const raceB = start({
    businessSlug: 'b5-race-probe',
    idempotencyKey: 'race-b',
    name: 'Race B',
    email: 'race-b@example.test',
    documentValue: 'RACE-001',
  });
  const [raceReservationA, raceReservationB] = await Promise.all([
    reserve(raceA, 'b5-race-workflow-a'),
    reserve(raceB, 'b5-race-workflow-b'),
  ]);
  assert.equal(raceReservationA.kind, 'RESERVED');
  assert.equal(raceReservationB.kind, 'RESERVED');

  const [raceResultA, raceResultB] = await Promise.all([
    postgresRegistrationActivities.createCustomer({
      registrationId: raceReservationA.registrationId,
      businessSlug: raceA.businessSlug,
      customer: raceA.draft?.customer ?? {},
      enforceHardUniqueDocument: true,
    }),
    postgresRegistrationActivities.createCustomer({
      registrationId: raceReservationB.registrationId,
      businessSlug: raceB.businessSlug,
      customer: raceB.draft?.customer ?? {},
      enforceHardUniqueDocument: true,
    }),
  ]);

  const raceKinds = [raceResultA.kind, raceResultB.kind].sort();
  assert.deepEqual(raceKinds, ['CREATED', 'HARD_DUPLICATE']);
  assert.equal(raceResultA.customerId, raceResultB.customerId);

  console.log(
    `B5_POSTGRES_SEMANTICS_OK ${JSON.stringify({
      registrationId: first.registrationId,
      customerId: created.customerId,
      exactReplay: replay.kind,
      conflict: conflict.kind,
      sameOpaqueKeyOtherBusiness: otherBusiness.kind,
      repeatedCreateReused: repeatedCreate.reused,
      concurrentHardUnique: {
        resultKinds: raceKinds,
        customerId: raceResultA.customerId,
      },
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
