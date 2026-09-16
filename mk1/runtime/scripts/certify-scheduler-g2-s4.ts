import assert from 'node:assert/strict';
import { Pool } from 'pg';
import { loadRuntimeConfig } from '../src/config/runtime-config.js';
import type {
  QueryAvailabilityInput,
  SchedulerResource,
  SchedulingDemand,
} from '../src/contracts/scheduler-engine/index.js';
import { PostgresSchedulerManagementRepository } from '../src/persistence/postgres/scheduler-management.repository.js';
import { queryDeterministicAvailability } from '../src/scheduler/availability-engine.js';
import {
  createHoldAtomic,
  expireHoldsHousekeeping,
  releaseHoldAtomic,
  SchedulerHoldError,
} from '../src/scheduler/hold-engine.js';
import {
  confirmReservationAtomic,
  SchedulerReservationError,
} from '../src/scheduler/reservation-engine.js';

const businessSlug = 'g2-s4-hold-business';
const t0 = '2026-09-14T23:00:00.000Z';
const tPlus60 = '2026-09-14T23:01:00.000Z';
const tPlus301 = '2026-09-14T23:05:01.000Z';

function resource(resourceId: string): SchedulerResource {
  return {
    resourceId,
    businessSlug,
    code: resourceId,
    kind: 'BAY',
    name: resourceId,
    status: 'ACTIVE',
    timeZone: 'America/Lima',
    capacity: 1,
    capabilities: [{ code: 'HOLDABLE_BAY', capacityUnits: 1 }],
    revision: 1,
  };
}

function demand(demandId: string, beforeMinutes = 0, afterMinutes = 0): SchedulingDemand {
  return {
    schemaVersion: 1,
    businessSlug,
    demandId,
    service: { serviceId: 'service_g2s4', revision: 1 },
    offering: { offeringId: `offering_${demandId}`, revision: 1, durationMinutes: 30 },
    capacityUnits: 1,
    requiredCapabilities: [{ code: 'HOLDABLE_BAY', quantity: 1, resourceKinds: ['BAY'] }],
    buffers: { beforeMinutes, afterMinutes },
  };
}

function availabilityInput(
  requestId: string,
  schedulingDemand: SchedulingDemand,
  resourceId: string,
  startAt: string,
  endAt: string,
): QueryAvailabilityInput {
  return {
    businessSlug,
    requestId,
    demand: schedulingDemand,
    window: { startAt, endAt, timeZone: 'America/Lima' },
    preferredResourceIds: [resourceId],
  };
}

async function oneCandidate(
  pool: Pool,
  schedulingDemand: SchedulingDemand,
  resourceId: string,
  startAt: string,
  endAt: string,
  asOf: string,
  requestId: string,
) {
  const result = await queryDeterministicAvailability(
    pool,
    availabilityInput(requestId, schedulingDemand, resourceId, startAt, endAt),
    { granularityMinutes: 1, generatedAt: asOf, asOf },
  );
  assert.equal(result.slots.length, 1, `${requestId} must yield exactly one candidate`);
  return result.slots[0]!;
}

async function run(): Promise<void> {
  const config = loadRuntimeConfig();
  const pool = new Pool({ connectionString: config.postgresUrl, max: 16 });
  const management = new PostgresSchedulerManagementRepository(pool);
  const heldResource = resource('res_g2s4_main');

  try {
    await management.createResource({
      businessSlug,
      operationId: 'g2s4-create-resource',
      resource: heldResource,
    });
    await management.setScheduleTemplate({
      businessSlug,
      operationId: 'g2s4-set-schedule',
      expectedRevision: 0,
      schedule: {
        scheduleId: 'schedule_g2s4_main',
        businessSlug,
        resourceId: heldResource.resourceId,
        timeZone: heldResource.timeZone,
        weeklyWindows: [{ weekday: 1, startLocal: '08:00', endLocal: '14:00', capacity: 1 }],
        revision: 1,
      },
    });

    // 1) Hold blocks while logically alive, then becomes non-blocking from expires_at
    // even while the physical row still says ACTIVE.
    const expiringDemand = demand('demand_g2s4_expiring', 10, 5);
    const expiringCandidate = await oneCandidate(
      pool,
      expiringDemand,
      heldResource.resourceId,
      '2026-09-21T09:00:00-05:00',
      '2026-09-21T09:30:00-05:00',
      t0,
      'g2s4-expiring-before-hold',
    );

    const created = await createHoldAtomic(pool, {
      businessSlug,
      operationId: 'g2s4-create-expiring-hold',
      demand: expiringDemand,
      candidateId: expiringCandidate.candidateId,
      requestedStartAt: expiringCandidate.startAt,
      expiresInSeconds: 300,
    }, { now: t0 });
    assert.equal(created.replayed, false);
    assert.equal(created.hold.status, 'ACTIVE');
    assert.equal(created.hold.expiresAt, '2026-09-14T23:05:00.000Z');
    assert.equal(created.hold.startAt, '2026-09-21T13:50:00.000Z', 'hold start must include before-buffer occupancy');
    assert.equal(created.hold.endAt, '2026-09-21T14:35:00.000Z', 'hold end must include after-buffer occupancy');

    const createReplay = await createHoldAtomic(pool, {
      businessSlug,
      operationId: 'g2s4-create-expiring-hold',
      demand: expiringDemand,
      candidateId: expiringCandidate.candidateId,
      requestedStartAt: expiringCandidate.startAt,
      expiresInSeconds: 300,
    }, { now: tPlus60 });
    assert.equal(createReplay.replayed, true);
    assert.equal(createReplay.hold.holdId, created.hold.holdId);

    await assert.rejects(
      () => createHoldAtomic(pool, {
        businessSlug,
        operationId: 'g2s4-create-expiring-hold',
        demand: expiringDemand,
        candidateId: expiringCandidate.candidateId,
        requestedStartAt: expiringCandidate.startAt,
        expiresInSeconds: 301,
      }, { now: tPlus60 }),
      (error: unknown) => error instanceof SchedulerHoldError
        && error.code === 'IDEMPOTENCY_MATERIAL_CONFLICT',
    );

    const blocked = await queryDeterministicAvailability(
      pool,
      availabilityInput(
        'g2s4-expiring-blocked',
        expiringDemand,
        heldResource.resourceId,
        '2026-09-21T09:00:00-05:00',
        '2026-09-21T09:30:00-05:00',
      ),
      { granularityMinutes: 1, generatedAt: tPlus60, asOf: tPlus60 },
    );
    assert.equal(blocked.slots.length, 0, 'unexpired ACTIVE hold must block availability');

    const statusBeforeExpiryCleanup = await pool.query<{ status: string }>(
      `SELECT status FROM scheduler_holds WHERE business_slug=$1 AND hold_id=$2`,
      [businessSlug, created.hold.holdId],
    );
    assert.equal(statusBeforeExpiryCleanup.rows[0]?.status, 'ACTIVE');

    // Fresh pool = no in-memory hold timer/state can help this query.
    const restartedPool = new Pool({ connectionString: config.postgresUrl, max: 4 });
    try {
      const availableAfterLogicalExpiry = await queryDeterministicAvailability(
        restartedPool,
        availabilityInput(
          'g2s4-expiring-after-restart',
          expiringDemand,
          heldResource.resourceId,
          '2026-09-21T09:00:00-05:00',
          '2026-09-21T09:30:00-05:00',
        ),
        { granularityMinutes: 1, generatedAt: tPlus301, asOf: tPlus301 },
      );
      assert.equal(
        availableAfterLogicalExpiry.slots.length,
        1,
        'logically expired hold must be non-blocking before physical cleanup and after fresh-pool re-entry',
      );
    } finally {
      await restartedPool.end();
    }

    const stillActiveBeforeCleanup = await pool.query<{ status: string }>(
      `SELECT status FROM scheduler_holds WHERE business_slug=$1 AND hold_id=$2`,
      [businessSlug, created.hold.holdId],
    );
    assert.equal(stillActiveBeforeCleanup.rows[0]?.status, 'ACTIVE');

    const expiredIds = await expireHoldsHousekeeping(pool, tPlus301);
    assert.ok(expiredIds.includes(created.hold.holdId));
    const afterCleanup = await pool.query<{ status: string }>(
      `SELECT status FROM scheduler_holds WHERE business_slug=$1 AND hold_id=$2`,
      [businessSlug, created.hold.holdId],
    );
    assert.equal(afterCleanup.rows[0]?.status, 'EXPIRED');

    // 2) Explicit release is durable, replay-safe, and frees the slot immediately.
    const releaseDemand = demand('demand_g2s4_release');
    const releaseCandidate = await oneCandidate(
      pool,
      releaseDemand,
      heldResource.resourceId,
      '2026-09-21T10:00:00-05:00',
      '2026-09-21T10:30:00-05:00',
      t0,
      'g2s4-release-before-hold',
    );
    const releaseCreated = await createHoldAtomic(pool, {
      businessSlug,
      operationId: 'g2s4-create-release-hold',
      demand: releaseDemand,
      candidateId: releaseCandidate.candidateId,
      requestedStartAt: releaseCandidate.startAt,
      expiresInSeconds: 900,
    }, { now: t0 });
    const released = await releaseHoldAtomic(pool, {
      businessSlug,
      operationId: 'g2s4-release-hold',
      holdId: releaseCreated.hold.holdId,
    }, { now: tPlus60 });
    assert.equal(released.hold.status, 'RELEASED');
    assert.equal(released.replayed, false);

    const releaseReplay = await releaseHoldAtomic(pool, {
      businessSlug,
      operationId: 'g2s4-release-hold',
      holdId: releaseCreated.hold.holdId,
    }, { now: tPlus60 });
    assert.equal(releaseReplay.replayed, true);
    assert.equal(releaseReplay.hold.status, 'RELEASED');

    await assert.rejects(
      () => releaseHoldAtomic(pool, {
        businessSlug,
        operationId: 'g2s4-release-hold',
        holdId: created.hold.holdId,
      }, { now: tPlus60 }),
      (error: unknown) => error instanceof SchedulerHoldError
        && error.code === 'IDEMPOTENCY_MATERIAL_CONFLICT',
    );

    const availableAfterRelease = await queryDeterministicAvailability(
      pool,
      availabilityInput(
        'g2s4-release-available',
        releaseDemand,
        heldResource.resourceId,
        '2026-09-21T10:00:00-05:00',
        '2026-09-21T10:30:00-05:00',
      ),
      { granularityMinutes: 1, generatedAt: tPlus60, asOf: tPlus60 },
    );
    assert.equal(availableAfterRelease.slots.length, 1);

    // 3) Valid hold is consumed atomically with reservation and replay remains safe.
    const consumeDemand = demand('demand_g2s4_consume', 5, 5);
    const consumeCandidate = await oneCandidate(
      pool,
      consumeDemand,
      heldResource.resourceId,
      '2026-09-21T11:00:00-05:00',
      '2026-09-21T11:30:00-05:00',
      t0,
      'g2s4-consume-before-hold',
    );
    const consumeCreated = await createHoldAtomic(pool, {
      businessSlug,
      operationId: 'g2s4-create-consume-hold',
      demand: consumeDemand,
      candidateId: consumeCandidate.candidateId,
      requestedStartAt: consumeCandidate.startAt,
      expiresInSeconds: 1200,
    }, { now: t0 });

    const confirmationInput = {
      businessSlug,
      operationId: 'g2s4-confirm-held-slot',
      demand: consumeDemand,
      holdId: consumeCreated.hold.holdId,
      requestedStartAt: consumeCandidate.startAt,
    } as const;
    const confirmed = await confirmReservationAtomic(pool, confirmationInput, { now: tPlus60 });
    assert.equal(confirmed.replayed, false);

    const consumedStatus = await pool.query<{ status: string }>(
      `SELECT status FROM scheduler_holds WHERE business_slug=$1 AND hold_id=$2`,
      [businessSlug, consumeCreated.hold.holdId],
    );
    assert.equal(consumedStatus.rows[0]?.status, 'CONSUMED');

    const reservationCount = await pool.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count
         FROM scheduler_reservations
        WHERE business_slug=$1 AND demand_id=$2 AND status='RESERVED'`,
      [businessSlug, consumeDemand.demandId],
    );
    assert.equal(reservationCount.rows[0]?.count, '1');

    const confirmReplay = await confirmReservationAtomic(pool, confirmationInput, { now: tPlus301 });
    assert.equal(confirmReplay.replayed, true);
    assert.equal(confirmReplay.reservation.reservationId, confirmed.reservation.reservationId);

    await assert.rejects(
      () => confirmReservationAtomic(pool, {
        ...confirmationInput,
        requestedStartAt: '2026-09-21T11:01:00-05:00',
      }, { now: tPlus301 }),
      (error: unknown) => error instanceof SchedulerReservationError
        && error.code === 'IDEMPOTENCY_MATERIAL_CONFLICT',
    );

    // 4) An expired ACTIVE hold cannot be consumed and leaves no reservation effect.
    const expiredConsumeDemand = demand('demand_g2s4_expired_consume');
    const expiredConsumeCandidate = await oneCandidate(
      pool,
      expiredConsumeDemand,
      heldResource.resourceId,
      '2026-09-21T12:00:00-05:00',
      '2026-09-21T12:30:00-05:00',
      t0,
      'g2s4-expired-consume-before-hold',
    );
    const expiredConsumeHold = await createHoldAtomic(pool, {
      businessSlug,
      operationId: 'g2s4-create-expired-consume-hold',
      demand: expiredConsumeDemand,
      candidateId: expiredConsumeCandidate.candidateId,
      requestedStartAt: expiredConsumeCandidate.startAt,
      expiresInSeconds: 60,
    }, { now: t0 });

    await assert.rejects(
      () => confirmReservationAtomic(pool, {
        businessSlug,
        operationId: 'g2s4-confirm-expired-hold',
        demand: expiredConsumeDemand,
        holdId: expiredConsumeHold.hold.holdId,
        requestedStartAt: expiredConsumeCandidate.startAt,
      }, { now: tPlus301 }),
      (error: unknown) => error instanceof SchedulerReservationError
        && error.code === 'HOLD_EXPIRED',
    );
    const expiredReservationEffects = await pool.query<{ reservations: string; commands: string }>(
      `SELECT
         (SELECT COUNT(*)::text FROM scheduler_reservations WHERE business_slug=$1 AND demand_id=$2) AS reservations,
         (SELECT COUNT(*)::text FROM scheduler_commands WHERE business_slug=$1 AND operation_id='g2s4-confirm-expired-hold') AS commands`,
      [businessSlug, expiredConsumeDemand.demandId],
    );
    assert.deepEqual(expiredReservationEffects.rows[0], { reservations: '0', commands: '0' });

    console.log(`SCHEDULER_G2_S4_EVIDENCE ${JSON.stringify({
      businessSlug,
      createReplay: createReplay.replayed,
      unexpiredHoldBlocks: blocked.slots.length === 0,
      expiredActiveHoldNonBlockingBeforeCleanup: true,
      freshPoolReentryUsesPersistedExpiry: true,
      housekeepingMarkedExpired: expiredIds.includes(created.hold.holdId),
      releaseReplay: releaseReplay.replayed,
      releaseRestoresAvailability: availableAfterRelease.slots.length === 1,
      consumedHoldId: consumeCreated.hold.holdId,
      reservationId: confirmed.reservation.reservationId,
      holdConsumedWithReservation: consumedStatus.rows[0]?.status === 'CONSUMED',
      confirmationReplay: confirmReplay.replayed,
      expiredHoldConsumptionRejected: true,
      appointmentMigrated: false,
    })}`);
    console.log('SCHEDULER_G2_S4_HOLD_LIFECYCLE_PASS');
  } finally {
    await pool.end();
  }
}

run().catch((error: unknown) => {
  console.error(`SCHEDULER_G2_S4_HOLD_LIFECYCLE_FAILED ${JSON.stringify({
    error: error instanceof Error ? error.message : String(error),
    code: error instanceof SchedulerHoldError || error instanceof SchedulerReservationError
      ? error.code
      : undefined,
  })}`);
  process.exitCode = 1;
});
