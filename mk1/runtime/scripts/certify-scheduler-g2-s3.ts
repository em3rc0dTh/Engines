import assert from 'node:assert/strict';
import { Pool } from 'pg';
import { loadRuntimeConfig } from '../src/config/runtime-config.js';
import type {
  ConfirmReservationInput,
  QueryAvailabilityInput,
  SchedulerResource,
  SchedulingDemand,
} from '../src/contracts/scheduler-engine/index.js';
import { PostgresSchedulerManagementRepository } from '../src/persistence/postgres/scheduler-management.repository.js';
import { queryDeterministicAvailability } from '../src/scheduler/availability-engine.js';
import {
  confirmReservationAtomic,
  SchedulerReservationError,
} from '../src/scheduler/reservation-engine.js';

const businessSlug = 'g2-s3-atomic-business';
const generatedAt = '2026-09-14T22:10:00.000Z';

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
    capabilities: [{ code: 'WASH_BAY', capacityUnits: 1 }],
    revision: 1,
  };
}

function demand(demandId: string, durationMinutes: number): SchedulingDemand {
  return {
    schemaVersion: 1,
    businessSlug,
    demandId,
    service: { serviceId: 'service_g2s3_wash', revision: 1 },
    offering: {
      offeringId: `offering_g2s3_${durationMinutes}`,
      revision: 1,
      durationMinutes,
    },
    capacityUnits: 1,
    requiredCapabilities: [{ code: 'WASH_BAY', quantity: 1, resourceKinds: ['BAY'] }],
    buffers: { beforeMinutes: 0, afterMinutes: 0 },
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
    window: {
      startAt,
      endAt,
      timeZone: 'America/Lima',
    },
    preferredResourceIds: [resourceId],
  };
}

function rejectedCode(result: PromiseSettledResult<unknown>): string | undefined {
  if (result.status !== 'rejected') return undefined;
  return result.reason instanceof SchedulerReservationError
    ? result.reason.code
    : undefined;
}

async function run(): Promise<void> {
  const config = loadRuntimeConfig();
  const pool = new Pool({ connectionString: config.postgresUrl, max: 12 });
  const management = new PostgresSchedulerManagementRepository(pool);

  const contestedResource = resource('res_g2s3_contested');
  const staleResource = resource('res_g2s3_stale');
  const contestedDemand = demand('demand_g2s3_contested', 60);
  const staleDemand = demand('demand_g2s3_stale', 30);

  try {
    for (const item of [contestedResource, staleResource]) {
      await management.createResource({
        businessSlug,
        operationId: `g2s3-create-${item.resourceId}`,
        resource: item,
      });
      await management.setScheduleTemplate({
        businessSlug,
        operationId: `g2s3-schedule-${item.resourceId}`,
        expectedRevision: 0,
        schedule: {
          scheduleId: `schedule_${item.resourceId}`,
          businessSlug,
          resourceId: item.resourceId,
          timeZone: 'America/Lima',
          weeklyWindows: [{ weekday: 1, startLocal: '08:00', endLocal: '12:00', capacity: 1 }],
          revision: 1,
        },
      });
    }

    const shown = await queryDeterministicAvailability(
      pool,
      availabilityInput(
        'g2s3-shown-contested',
        contestedDemand,
        contestedResource.resourceId,
        '2026-09-21T09:00:00-05:00',
        '2026-09-21T10:00:00-05:00',
      ),
      { granularityMinutes: 15, generatedAt },
    );
    assert.equal(shown.slots.length, 1, 'the last-capacity candidate must exist before the race');
    const contestedCandidate = shown.slots[0]!;

    const firstInput: ConfirmReservationInput = {
      businessSlug,
      operationId: 'g2s3-confirm-a',
      demand: contestedDemand,
      candidateId: contestedCandidate.candidateId,
      requestedStartAt: contestedCandidate.startAt,
    };
    const secondInput: ConfirmReservationInput = {
      ...firstInput,
      operationId: 'g2s3-confirm-b',
    };

    const race = await Promise.allSettled([
      confirmReservationAtomic(pool, firstInput),
      confirmReservationAtomic(pool, secondInput),
    ]);
    const fulfilled = race.filter((result) => result.status === 'fulfilled');
    const rejected = race.filter((result) => result.status === 'rejected');
    assert.equal(fulfilled.length, 1, 'exactly one concurrent confirmation must win');
    assert.equal(rejected.length, 1, 'exactly one concurrent confirmation must lose');
    assert.equal(rejectedCode(rejected[0]!), 'CAPACITY_CONFLICT', 'the race loser must receive typed CAPACITY_CONFLICT');

    const winnerIndex = race.findIndex((result) => result.status === 'fulfilled');
    assert.ok(winnerIndex === 0 || winnerIndex === 1);
    const winnerInput = winnerIndex === 0 ? firstInput : secondInput;
    const loserInput = winnerIndex === 0 ? secondInput : firstInput;
    const winnerResult = race[winnerIndex];
    assert.equal(winnerResult.status, 'fulfilled');
    if (winnerResult.status !== 'fulfilled') throw new Error('G2-S3 winner unexpectedly missing');

    const reservationRows = await pool.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count
         FROM scheduler_reservations
        WHERE business_slug = $1 AND demand_id = $2 AND status = 'RESERVED'`,
      [businessSlug, contestedDemand.demandId],
    );
    assert.equal(reservationRows.rows[0]?.count, '1', 'the race must persist exactly one reservation');

    const assignmentRows = await pool.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count
         FROM scheduler_reservation_assignments a
         JOIN scheduler_reservations r
           ON r.business_slug = a.business_slug AND r.reservation_id = a.reservation_id
        WHERE r.business_slug = $1 AND r.demand_id = $2`,
      [businessSlug, contestedDemand.demandId],
    );
    assert.equal(assignmentRows.rows[0]?.count, '1', 'the race must persist exactly one assignment');

    const contenderCommands = await pool.query<{ operation_id: string }>(
      `SELECT operation_id
         FROM scheduler_commands
        WHERE business_slug = $1
          AND command_type = 'ConfirmReservation'
          AND operation_id IN ($2,$3)
        ORDER BY operation_id ASC`,
      [businessSlug, firstInput.operationId, secondInput.operationId],
    );
    assert.equal(contenderCommands.rows.length, 1, 'loser transaction must not leave a command ledger effect');
    assert.equal(contenderCommands.rows[0]?.operation_id, winnerInput.operationId);
    assert.equal(
      contenderCommands.rows.some((row) => row.operation_id === loserInput.operationId),
      false,
      'loser operation must be absent from the committed command ledger',
    );

    const replay = await confirmReservationAtomic(pool, winnerInput);
    assert.equal(replay.replayed, true, 'same successful operation/material must replay');
    assert.equal(replay.reservation.reservationId, winnerResult.value.reservation.reservationId);

    await assert.rejects(
      () => confirmReservationAtomic(pool, {
        ...winnerInput,
        requestedStartAt: '2026-09-21T09:15:00-05:00',
      }),
      (error: unknown) => error instanceof SchedulerReservationError
        && error.code === 'IDEMPOTENCY_MATERIAL_CONFLICT',
      'same operation identity with changed material must be rejected',
    );

    const staleShown = await queryDeterministicAvailability(
      pool,
      availabilityInput(
        'g2s3-shown-stale',
        staleDemand,
        staleResource.resourceId,
        '2026-09-21T10:00:00-05:00',
        '2026-09-21T10:30:00-05:00',
      ),
      { granularityMinutes: 15, generatedAt },
    );
    assert.equal(staleShown.slots.length, 1, 'stale-candidate fixture must begin available');
    const staleCandidate = staleShown.slots[0]!;

    await management.putScheduleOverride({
      businessSlug,
      operationId: 'g2s3-block-stale-candidate',
      expectedRevision: 0,
      override: {
        overrideId: 'override_g2s3_stale_block',
        businessSlug,
        resourceId: staleResource.resourceId,
        startAt: staleCandidate.startAt,
        endAt: staleCandidate.endAt,
        kind: 'UNAVAILABLE',
        reasonCode: 'G2_S3_STALE_REVALIDATION',
        revision: 1,
      },
    });

    await assert.rejects(
      () => confirmReservationAtomic(pool, {
        businessSlug,
        operationId: 'g2s3-confirm-stale',
        demand: staleDemand,
        candidateId: staleCandidate.candidateId,
        requestedStartAt: staleCandidate.startAt,
      }),
      (error: unknown) => error instanceof SchedulerReservationError
        && error.code === 'SLOT_NO_LONGER_AVAILABLE',
      'candidate must be revalidated against current schedule truth at commit time',
    );

    const staleEffects = await pool.query<{ reservations: string; commands: string; demands: string }>(
      `SELECT
         (SELECT COUNT(*)::text FROM scheduler_reservations WHERE business_slug = $1 AND demand_id = $2) AS reservations,
         (SELECT COUNT(*)::text FROM scheduler_commands WHERE business_slug = $1 AND operation_id = 'g2s3-confirm-stale') AS commands,
         (SELECT COUNT(*)::text FROM scheduler_demands WHERE business_slug = $1 AND demand_id = $2) AS demands`,
      [businessSlug, staleDemand.demandId],
    );
    assert.deepEqual(staleEffects.rows[0], { reservations: '0', commands: '0', demands: '0' });

    console.log(`SCHEDULER_G2_S3_EVIDENCE ${JSON.stringify({
      businessSlug,
      contestedCandidateId: contestedCandidate.candidateId,
      winnerOperationId: winnerInput.operationId,
      loserOperationId: loserInput.operationId,
      winnerReservationId: winnerResult.value.reservation.reservationId,
      concurrentSuccesses: fulfilled.length,
      concurrentTypedConflicts: rejected.filter((result) => rejectedCode(result) === 'CAPACITY_CONFLICT').length,
      loserPartialReservationEffects: 0,
      loserPartialAssignmentEffects: 0,
      loserPartialCommandEffects: 0,
      staleCandidateRejected: true,
      replayedWinner: replay.replayed,
      idempotencyMaterialConflictRejected: true,
      appointmentMigrated: false,
    })}`);
    console.log('SCHEDULER_G2_S3_ATOMIC_RESERVATION_PASS');
  } finally {
    await pool.end();
  }
}

run().catch((error: unknown) => {
  console.error(`SCHEDULER_G2_S3_ATOMIC_RESERVATION_FAILED ${JSON.stringify({
    error: error instanceof Error ? error.message : String(error),
    code: error instanceof SchedulerReservationError ? error.code : undefined,
  })}`);
  process.exitCode = 1;
});
