import assert from 'node:assert/strict';
import { Pool } from 'pg';
import { loadRuntimeConfig } from '../src/config/runtime-config.js';
import type { QueryAvailabilityInput, SchedulerResource, SchedulingDemand } from '../src/contracts/scheduler-engine/index.js';
import { PostgresSchedulerManagementRepository } from '../src/persistence/postgres/scheduler-management.repository.js';
import { queryDeterministicAvailability } from '../src/scheduler/availability-engine.js';

const businessSlug = 'g2-s2-availability-business';
const generatedAt = '2026-09-14T21:50:00.000Z';

function resource(
  resourceId: string,
  kind: string,
  status: SchedulerResource['status'],
  capacity = 2,
): SchedulerResource {
  return {
    resourceId,
    businessSlug,
    code: resourceId,
    kind,
    name: resourceId,
    status,
    timeZone: 'America/Lima',
    capacity,
    capabilities: [{ code: 'WASH_BAY', capacityUnits: capacity }],
    revision: 1,
  };
}

async function run(): Promise<void> {
  const config = loadRuntimeConfig();
  const pool = new Pool({ connectionString: config.postgresUrl, max: 8 });
  const management = new PostgresSchedulerManagementRepository(pool);

  const primary = resource('res_g2s2_primary', 'BAY', 'ACTIVE', 2);
  const exceptional = resource('res_g2s2_exceptional', 'BAY', 'ACTIVE', 1);
  const inactive = resource('res_g2s2_inactive', 'BAY', 'INACTIVE', 2);
  const wrongKind = resource('res_g2s2_machine', 'MACHINE', 'ACTIVE', 2);

  const demand: SchedulingDemand = {
    schemaVersion: 1,
    businessSlug,
    demandId: 'demand_g2s2_wash',
    service: { serviceId: 'service_wash', revision: 1 },
    offering: { offeringId: 'offering_wash_60', revision: 1, durationMinutes: 60 },
    capacityUnits: 1,
    requiredCapabilities: [{ code: 'WASH_BAY', quantity: 1, resourceKinds: ['BAY'] }],
    buffers: { beforeMinutes: 15, afterMinutes: 15 },
  };

  try {
    for (const item of [primary, exceptional, inactive, wrongKind]) {
      await management.createResource({
        businessSlug,
        operationId: `g2s2-create-${item.resourceId}`,
        resource: item,
      });
    }

    await management.setScheduleTemplate({
      businessSlug,
      operationId: 'g2s2-schedule-primary',
      expectedRevision: 0,
      schedule: {
        scheduleId: 'schedule_g2s2_primary',
        businessSlug,
        resourceId: primary.resourceId,
        timeZone: 'America/Lima',
        weeklyWindows: [{ weekday: 1, startLocal: '08:00', endLocal: '12:00', capacity: 2 }],
        revision: 1,
      },
    });
    await management.setScheduleTemplate({
      businessSlug,
      operationId: 'g2s2-schedule-exceptional',
      expectedRevision: 0,
      schedule: {
        scheduleId: 'schedule_g2s2_exceptional',
        businessSlug,
        resourceId: exceptional.resourceId,
        timeZone: 'America/Lima',
        weeklyWindows: [{ weekday: 2, startLocal: '08:00', endLocal: '12:00', capacity: 1 }],
        revision: 1,
      },
    });
    await management.setScheduleTemplate({
      businessSlug,
      operationId: 'g2s2-schedule-machine',
      expectedRevision: 0,
      schedule: {
        scheduleId: 'schedule_g2s2_machine',
        businessSlug,
        resourceId: wrongKind.resourceId,
        timeZone: 'America/Lima',
        weeklyWindows: [{ weekday: 1, startLocal: '08:00', endLocal: '12:00', capacity: 2 }],
        revision: 1,
      },
    });

    await management.putScheduleOverride({
      businessSlug,
      operationId: 'g2s2-capacity-primary',
      expectedRevision: 0,
      override: {
        overrideId: 'override_g2s2_capacity',
        businessSlug,
        resourceId: primary.resourceId,
        startAt: '2026-09-21T09:00:00-05:00',
        endAt: '2026-09-21T09:30:00-05:00',
        kind: 'CAPACITY',
        capacity: 1,
        reasonCode: 'REDUCED_CAPACITY',
        revision: 1,
      },
    });
    await management.putScheduleOverride({
      businessSlug,
      operationId: 'g2s2-unavailable-primary',
      expectedRevision: 0,
      override: {
        overrideId: 'override_g2s2_unavailable',
        businessSlug,
        resourceId: primary.resourceId,
        startAt: '2026-09-21T10:00:00-05:00',
        endAt: '2026-09-21T10:30:00-05:00',
        kind: 'UNAVAILABLE',
        reasonCode: 'MAINTENANCE',
        revision: 1,
      },
    });
    await management.putScheduleOverride({
      businessSlug,
      operationId: 'g2s2-available-exceptional',
      expectedRevision: 0,
      override: {
        overrideId: 'override_g2s2_exceptional_open',
        businessSlug,
        resourceId: exceptional.resourceId,
        startAt: '2026-09-21T10:45:00-05:00',
        endAt: '2026-09-21T12:15:00-05:00',
        kind: 'AVAILABLE',
        reasonCode: 'EXCEPTIONAL_OPEN',
        revision: 1,
      },
    });

    await pool.query(
      `INSERT INTO scheduler_demands (
         demand_id, schema_version, business_slug,
         service_id, service_revision, offering_id, offering_revision,
         duration_minutes, capacity_units, required_capabilities,
         buffer_before_minutes, buffer_after_minutes, snapshot_hash
       ) VALUES ($1,1,$2,$3,1,$4,1,60,1,$5::jsonb,15,15,$6)`,
      [
        demand.demandId,
        businessSlug,
        demand.service.serviceId,
        demand.offering.offeringId,
        JSON.stringify(demand.requiredCapabilities),
        'a'.repeat(64),
      ],
    );

    await pool.query(
      `INSERT INTO scheduler_reservations (
         reservation_id, business_slug, demand_id, start_at, end_at, time_zone, status, revision
       ) VALUES ($1,$2,$3,$4,$5,'America/Lima','RESERVED',1)`,
      [
        'reservation_g2s2_existing',
        businessSlug,
        demand.demandId,
        '2026-09-21T08:30:00-05:00',
        '2026-09-21T09:00:00-05:00',
      ],
    );
    await pool.query(
      `INSERT INTO scheduler_reservation_assignments (
         business_slug, reservation_id, resource_id, capacity_units
       ) VALUES ($1,$2,$3,1)`,
      [businessSlug, 'reservation_g2s2_existing', primary.resourceId],
    );

    await pool.query(
      `INSERT INTO scheduler_holds (
         hold_id, business_slug, demand_id, start_at, end_at, expires_at, status
       ) VALUES ($1,$2,$3,$4,$5,$6,'ACTIVE')`,
      [
        'hold_g2s2_active',
        businessSlug,
        demand.demandId,
        '2026-09-21T09:00:00-05:00',
        '2026-09-21T09:30:00-05:00',
        '2026-09-21T15:00:00-05:00',
      ],
    );
    await pool.query(
      `INSERT INTO scheduler_hold_assignments (
         business_slug, hold_id, resource_id, capacity_units
       ) VALUES ($1,$2,$3,1)`,
      [businessSlug, 'hold_g2s2_active', primary.resourceId],
    );

    const baseInput: QueryAvailabilityInput = {
      businessSlug,
      requestId: 'availability-g2s2-primary',
      demand,
      window: {
        startAt: '2026-09-21T08:00:00-05:00',
        endAt: '2026-09-21T12:00:00-05:00',
        timeZone: 'America/Lima',
      },
      preferredResourceIds: [primary.resourceId],
    };

    const first = await queryDeterministicAvailability(pool, baseInput, { granularityMinutes: 15, generatedAt });
    const replay = await queryDeterministicAvailability(pool, baseInput, { granularityMinutes: 15, generatedAt });
    assert.deepEqual(replay, first, 'same truth + same input must produce the same availability result');
    assert.equal(first.slots.length, 1, 'capacity, hold and unavailable overrides must leave one feasible primary slot');
    assert.equal(first.slots[0]?.startAt, '2026-09-21T15:45:00.000Z');
    assert.equal(first.slots[0]?.endAt, '2026-09-21T16:45:00.000Z');
    assert.equal(first.slots[0]?.assignments[0]?.resourceId, primary.resourceId);

    const exceptionalResult = await queryDeterministicAvailability(pool, {
      ...baseInput,
      requestId: 'availability-g2s2-exceptional',
      preferredResourceIds: [exceptional.resourceId],
    }, { granularityMinutes: 15, generatedAt });
    assert.equal(exceptionalResult.slots.length, 1, 'AVAILABLE override must open the exceptional resource outside its weekly Monday schedule');
    assert.equal(exceptionalResult.slots[0]?.startAt, '2026-09-21T16:00:00.000Z');
    assert.equal(exceptionalResult.slots[0]?.assignments[0]?.resourceId, exceptional.resourceId);

    const inactiveResult = await queryDeterministicAvailability(pool, {
      ...baseInput,
      requestId: 'availability-g2s2-inactive',
      preferredResourceIds: [inactive.resourceId],
    }, { granularityMinutes: 15, generatedAt });
    assert.equal(inactiveResult.slots.length, 0, 'INACTIVE resources must never yield candidates');

    const wrongKindResult = await queryDeterministicAvailability(pool, {
      ...baseInput,
      requestId: 'availability-g2s2-kind',
      preferredResourceIds: [wrongKind.resourceId],
    }, { granularityMinutes: 15, generatedAt });
    assert.equal(wrongKindResult.slots.length, 0, 'resourceKinds constraint must be enforced');

    const unsatisfiedResult = await queryDeterministicAvailability(pool, {
      ...baseInput,
      requestId: 'availability-g2s2-capability-miss',
      demand: {
        ...demand,
        demandId: 'demand_g2s2_missing_capability',
        requiredCapabilities: [{ code: 'NON_EXISTENT_CAPABILITY', quantity: 1, resourceKinds: ['BAY'] }],
      },
      preferredResourceIds: [primary.resourceId],
    }, { granularityMinutes: 15, generatedAt });
    assert.equal(unsatisfiedResult.slots.length, 0, 'missing capabilities must yield no candidates');

    const combined = await queryDeterministicAvailability(pool, {
      ...baseInput,
      requestId: 'availability-g2s2-combined',
      preferredResourceIds: [exceptional.resourceId, primary.resourceId],
    }, { granularityMinutes: 15, generatedAt });
    assert.deepEqual(
      combined.slots.map((slot) => [slot.startAt, slot.assignments[0]?.resourceId]),
      [
        ['2026-09-21T15:45:00.000Z', primary.resourceId],
        ['2026-09-21T16:00:00.000Z', exceptional.resourceId],
      ],
      'slots must use stable start/resource ordering',
    );
    assert.equal(new Set(combined.slots.map((slot) => slot.candidateId)).size, combined.slots.length);

    const limited = await queryDeterministicAvailability(pool, {
      ...baseInput,
      requestId: 'availability-g2s2-limit',
      preferredResourceIds: [exceptional.resourceId, primary.resourceId],
      limit: 1,
    }, { granularityMinutes: 15, generatedAt });
    assert.equal(limited.slots.length, 1);
    assert.equal(limited.slots[0]?.candidateId, combined.slots[0]?.candidateId);

    const slotTable = await pool.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count
         FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'scheduler_slot_candidates'`,
    );
    assert.equal(slotTable.rows[0]?.count, '0', 'SlotCandidate must remain advisory and non-persisted');

    console.log(`SCHEDULER_G2_S2_EVIDENCE ${JSON.stringify({
      businessSlug,
      primarySlots: first.slots.map((slot) => slot.candidateId),
      exceptionalSlots: exceptionalResult.slots.map((slot) => slot.candidateId),
      deterministicReplay: true,
      buffersApplied: true,
      weeklyScheduleApplied: true,
      availableOverrideApplied: true,
      unavailableOverrideApplied: true,
      capacityOverrideApplied: true,
      activeHoldApplied: true,
      reservationApplied: true,
      resourceStatusApplied: true,
      resourceKindConstraintApplied: true,
      capabilityConstraintApplied: true,
      deterministicOrdering: true,
      slotCandidatePersisted: false,
    })}`);
    console.log('SCHEDULER_G2_S2_AVAILABILITY_PASS');
  } finally {
    await pool.end();
  }
}

run().catch((error: unknown) => {
  console.error(`SCHEDULER_G2_S2_AVAILABILITY_FAILED ${JSON.stringify({
    error: error instanceof Error ? error.message : String(error),
  })}`);
  process.exitCode = 1;
});
