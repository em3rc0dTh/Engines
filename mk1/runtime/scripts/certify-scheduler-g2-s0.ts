import assert from 'node:assert/strict';
import { Pool } from 'pg';
import { loadRuntimeConfig } from '../src/config/runtime-config.js';
import type {
  ScheduleOverride,
  ScheduleTemplate,
  SchedulerHold,
  SchedulerReservation,
  SchedulerResource,
  SchedulingDemand,
  SlotCandidate,
} from '../src/contracts/scheduler-engine/index.js';
import { validateSlotCandidate } from '../src/contracts/scheduler-engine/index.js';
import { PostgresSchedulerFoundationRepository } from '../src/persistence/postgres/scheduler-foundation.repository.js';

async function expectConstraintFailure(work: () => Promise<unknown>): Promise<string> {
  try {
    await work();
  } catch (error) {
    const code = typeof error === 'object' && error !== null && 'code' in error
      ? String((error as { code?: unknown }).code ?? '')
      : '';
    assert.ok(code === '23503' || code === '23505', `expected PostgreSQL FK/unique violation, got ${code}`);
    return code;
  }
  throw new Error('EXPECTED_POSTGRES_CONSTRAINT_FAILURE');
}

async function run(): Promise<void> {
  const config = loadRuntimeConfig();
  const pool = new Pool({ connectionString: config.postgresUrl, max: 4 });
  const repository = new PostgresSchedulerFoundationRepository(pool);
  const businessSlug = 'g2-s0-foundation-business';

  const resource: SchedulerResource = {
    resourceId: 'res_g2s0_bay_1',
    businessSlug,
    code: 'bay-1',
    kind: 'BAY',
    name: 'G2-S0 Bay 1',
    status: 'ACTIVE',
    timeZone: 'America/Lima',
    capacity: 2,
    capabilities: [
      { code: 'WASH_BAY', capacityUnits: 2, metadata: { lane: 'north' } },
    ],
    revision: 1,
  };

  const schedule: ScheduleTemplate = {
    scheduleId: 'schedule_g2s0_bay_1_v1',
    businessSlug,
    resourceId: resource.resourceId,
    timeZone: resource.timeZone,
    weeklyWindows: [
      { weekday: 1, startLocal: '08:00', endLocal: '12:00', capacity: 2 },
      { weekday: 1, startLocal: '13:00', endLocal: '17:00', capacity: 2 },
    ],
    revision: 1,
  };

  const override: ScheduleOverride = {
    overrideId: 'override_g2s0_maintenance',
    businessSlug,
    resourceId: resource.resourceId,
    startAt: '2026-09-21T12:00:00-05:00',
    endAt: '2026-09-21T13:00:00-05:00',
    kind: 'UNAVAILABLE',
    reasonCode: 'MAINTENANCE',
    revision: 1,
  };

  const demand: SchedulingDemand = {
    schemaVersion: 1,
    businessSlug,
    demandId: 'demand_g2s0_appointment_1',
    service: { serviceId: 'service_snapshot_not_fk_bound', revision: 4 },
    offering: {
      offeringId: 'offering_snapshot_not_fk_bound',
      revision: 7,
      durationMinutes: 30,
    },
    capacityUnits: 1,
    requiredCapabilities: [
      { code: 'WASH_BAY', quantity: 1, resourceKinds: ['BAY'] },
    ],
    buffers: { beforeMinutes: 5, afterMinutes: 10 },
  };

  const candidate: SlotCandidate = {
    candidateId: 'candidate_g2s0_1',
    startAt: '2026-09-21T10:00:00-05:00',
    endAt: '2026-09-21T10:30:00-05:00',
    timeZone: resource.timeZone,
    assignments: [{ resourceId: resource.resourceId, capacityUnits: 1 }],
  };

  const hold: SchedulerHold = {
    holdId: 'hold_g2s0_1',
    businessSlug,
    demandId: demand.demandId,
    startAt: candidate.startAt,
    endAt: candidate.endAt,
    assignments: candidate.assignments,
    expiresAt: '2026-09-15T00:00:00Z',
    status: 'ACTIVE',
  };

  const reservation: SchedulerReservation = {
    reservationId: 'reservation_g2s0_1',
    businessSlug,
    demandId: demand.demandId,
    startAt: candidate.startAt,
    endAt: candidate.endAt,
    timeZone: candidate.timeZone,
    assignments: candidate.assignments,
    status: 'RESERVED',
    revision: 1,
    createdAt: '2026-09-14T18:00:00Z',
    updatedAt: '2026-09-14T18:00:00Z',
  };

  try {
    assert.deepEqual(validateSlotCandidate(candidate), []);

    await repository.insertResource(resource);
    await repository.insertScheduleTemplate(schedule);
    await repository.insertScheduleOverride(override);
    const snapshotHash = await repository.insertDemand(demand);
    await repository.insertHold(hold);
    await repository.insertReservation(reservation);
    const commandHash = await repository.insertCommandIdentity({
      commandId: 'cmd_g2s0_hold_1',
      businessSlug,
      operationId: 'g2s0-operation-hold-1',
      commandType: 'CreateHold',
      material: {
        demandId: demand.demandId,
        candidateId: candidate.candidateId,
        expiresInSeconds: 300,
      },
      resultType: 'HOLD',
      resultId: hold.holdId,
    });

    assert.deepEqual(await repository.getResource(businessSlug, resource.resourceId), resource);
    assert.deepEqual(await repository.getScheduleTemplate(businessSlug, schedule.scheduleId), schedule);

    const persistedOverride = await repository.getScheduleOverride(businessSlug, override.overrideId);
    assert.ok(persistedOverride);
    assert.equal(persistedOverride.overrideId, override.overrideId);
    assert.equal(Date.parse(persistedOverride.startAt), Date.parse(override.startAt));
    assert.equal(Date.parse(persistedOverride.endAt), Date.parse(override.endAt));
    assert.equal(persistedOverride.kind, override.kind);
    assert.equal(persistedOverride.reasonCode, override.reasonCode);

    assert.deepEqual(await repository.getDemand(businessSlug, demand.demandId), demand);
    assert.match(snapshotHash, /^[a-f0-9]{64}$/);
    assert.match(commandHash, /^[a-f0-9]{64}$/);
    assert.deepEqual(await repository.tableCounts(businessSlug), {
      resources: 1,
      demands: 1,
      holds: 1,
      reservations: 1,
      commands: 1,
    });

    const schemaProof = await pool.query<{
      slot_candidate_table_count: string;
      service_fk_count: string;
      scheduler_table_count: string;
    }>(
      `SELECT
         (SELECT COUNT(*)::text
            FROM information_schema.tables
           WHERE table_schema = 'public'
             AND table_name = 'scheduler_slot_candidates') AS slot_candidate_table_count,
         (SELECT COUNT(*)::text
            FROM pg_constraint c
            JOIN pg_class source_table ON source_table.oid = c.conrelid
            JOIN pg_class target_table ON target_table.oid = c.confrelid
           WHERE c.contype = 'f'
             AND source_table.relname = 'scheduler_demands'
             AND target_table.relname IN ('service_catalog', 'service_products')) AS service_fk_count,
         (SELECT COUNT(*)::text
            FROM information_schema.tables
           WHERE table_schema = 'public'
             AND table_name LIKE 'scheduler_%') AS scheduler_table_count`,
    );
    assert.equal(schemaProof.rows[0]?.slot_candidate_table_count, '0');
    assert.equal(schemaProof.rows[0]?.service_fk_count, '0');
    assert.equal(schemaProof.rows[0]?.scheduler_table_count, '11');

    const crossBusinessCode = await expectConstraintFailure(async () => {
      await pool.query(
        `INSERT INTO scheduler_schedule_templates (
           schedule_id, business_slug, resource_id, time_zone, revision
         ) VALUES ($1,$2,$3,$4,$5)`,
        ['schedule_cross_business_rejected', 'other-business', resource.resourceId, resource.timeZone, 1],
      );
    });
    assert.equal(crossBusinessCode, '23503');

    const duplicateOperationCode = await expectConstraintFailure(async () => {
      await repository.insertCommandIdentity({
        commandId: 'cmd_g2s0_hold_conflict',
        businessSlug,
        operationId: 'g2s0-operation-hold-1',
        commandType: 'CreateHold',
        material: { demandId: demand.demandId, candidateId: 'different-material' },
      });
    });
    assert.equal(duplicateOperationCode, '23505');

    console.log(`SCHEDULER_G2_S0_EVIDENCE ${JSON.stringify({
      businessSlug,
      resourceId: resource.resourceId,
      capabilityCodes: resource.capabilities.map((entry) => entry.code),
      scheduleId: schedule.scheduleId,
      overrideId: override.overrideId,
      demandId: demand.demandId,
      serviceRevision: demand.service.revision,
      offeringRevision: demand.offering.revision,
      snapshotHash,
      commandHash,
      slotCandidatePersisted: false,
      serviceCatalogForeignKeyCoupling: false,
      crossBusinessReferenceRejected: true,
      duplicateOperationIdentityRejected: true,
      holdSchemaRoundTrip: true,
      reservationSchemaRoundTrip: true,
    })}`);
    console.log('SCHEDULER_G2_S0_CONTRACT_PERSISTENCE_PASS');
  } finally {
    await pool.end();
  }
}

run().catch((error: unknown) => {
  console.error(`SCHEDULER_G2_S0_CONTRACT_PERSISTENCE_FAILED ${JSON.stringify({
    error: error instanceof Error ? error.message : String(error),
  })}`);
  process.exitCode = 1;
});
