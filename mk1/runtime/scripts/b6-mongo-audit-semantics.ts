import assert from 'node:assert/strict';
import {
  closeMongoRegistrationAuditRepository,
  persistRegistrationAuditEvents,
  verifyRegistrationAuditEvents,
} from '../src/persistence/mongo/registration-audit.repository.js';
import type { RegistrationAuditEventInput } from '../src/orchestration/temporal/activities/mongo-registration-audit.types.js';

const baseEvent: RegistrationAuditEventInput = {
  eventType: 'REGISTRATION_SESSION_STARTED',
  logicalKey: 'probe-session',
  schemaVersion: 'mk0.register-customer.v0',
  businessSlug: 'b6-audit-probe',
  workflowId: 'b6-audit-probe-workflow',
  correlationId: 'b6-audit-probe-correlation',
  phase: 'STARTED',
  occurredAt: '2026-08-25T00:00:00.000Z',
  metadata: { source: 'CERTIFICATION_PROBE' },
};

async function run(): Promise<void> {
  const first = await persistRegistrationAuditEvents([baseEvent]);
  assert.equal(first.persistedEventIds.length, 1);
  assert.equal(first.reusedEventIds.length, 0);

  const replay = await persistRegistrationAuditEvents([baseEvent]);
  assert.equal(replay.persistedEventIds.length, 0);
  assert.equal(replay.reusedEventIds.length, 1);
  assert.equal(replay.reusedEventIds[0], first.persistedEventIds[0]);

  const verified = await verifyRegistrationAuditEvents(baseEvent.workflowId, [
    { eventType: baseEvent.eventType, logicalKey: baseEvent.logicalKey },
  ]);
  assert.equal(verified.complete, true);
  assert.deepEqual(verified.missing, []);

  let conflictObserved = false;
  try {
    await persistRegistrationAuditEvents([
      { ...baseEvent, metadata: { source: 'MATERIALLY_DIFFERENT' } },
    ]);
  } catch (error) {
    conflictObserved = String(error).includes('MONGO_AUDIT_EVENT_CONFLICT');
  }
  assert.equal(conflictObserved, true);

  console.log(
    `B6_MONGO_AUDIT_SEMANTICS_OK ${JSON.stringify({
      eventId: first.persistedEventIds[0],
      exactReplay: true,
      conflictingReplayRejected: true,
      verificationComplete: verified.complete,
    })}`,
  );
}

run()
  .catch((error: unknown) => {
    console.error(
      `B6_MONGO_AUDIT_SEMANTICS_FAILED ${JSON.stringify({
        error: error instanceof Error ? error.message : String(error),
      })}`,
    );
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeMongoRegistrationAuditRepository();
  });
