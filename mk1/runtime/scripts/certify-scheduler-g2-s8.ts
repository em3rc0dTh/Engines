import { Pool } from 'pg';
import type { ConfirmReservationInput, SchedulingDemand } from '../src/contracts/scheduler-engine/index.js';
import {
  confirmMultiResourceReservationAtomic,
  queryDeterministicMultiResourceAvailability,
} from '../src/scheduler/multi-resource-engine.js';
import { SchedulerReservationError } from '../src/scheduler/reservation-engine.js';

const pool = new Pool({ connectionString: process.env.POSTGRES_URL });
const BUSINESS = 'g2-s8-multi-resource';
const SLOT_A = '2030-01-07T08:00:00.000Z';
const SLOT_B = '2030-01-07T09:00:00.000Z';
const WINDOW_END = '2030-01-07T10:00:00.000Z';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`SCHEDULER_G2_S8_ASSERTION_FAILED:${message}`);
}

async function resetFixture(): Promise<void> {
  await pool.query('DELETE FROM scheduler_commands WHERE business_slug = $1', [BUSINESS]);
  await pool.query('DELETE FROM scheduler_reservations WHERE business_slug = $1', [BUSINESS]);
  await pool.query('DELETE FROM scheduler_holds WHERE business_slug = $1', [BUSINESS]);
  await pool.query('DELETE FROM scheduler_demands WHERE business_slug = $1', [BUSINESS]);
  await pool.query('DELETE FROM scheduler_schedule_overrides WHERE business_slug = $1', [BUSINESS]);
  await pool.query('DELETE FROM scheduler_schedule_templates WHERE business_slug = $1', [BUSINESS]);
  await pool.query('DELETE FROM scheduler_resources WHERE business_slug = $1', [BUSINESS]);

  const resources = [
    ['bay-a', 'BAY-A', 'BAY', 'Bay A', 'BAY_ACCESS'],
    ['bay-b', 'BAY-B', 'BAY', 'Bay B', 'BAY_ACCESS'],
    ['tech-a', 'TECH-A', 'TECHNICIAN', 'Technician A', 'TECHNICIAN'],
    ['tech-b', 'TECH-B', 'TECHNICIAN', 'Technician B', 'TECHNICIAN'],
  ] as const;

  for (const [resourceId, code, kind, name, capability] of resources) {
    await pool.query(
      `INSERT INTO scheduler_resources (
         resource_id,business_slug,resource_code,resource_kind,resource_name,status,time_zone,capacity,revision
       ) VALUES ($1,$2,$3,$4,$5,'ACTIVE','UTC',1,1)`,
      [resourceId, BUSINESS, code, kind, name],
    );
    await pool.query(
      `INSERT INTO scheduler_resource_capabilities (
         business_slug,resource_id,capability_code,capacity_units,metadata
       ) VALUES ($1,$2,$3,1,'{}'::jsonb)`,
      [BUSINESS, resourceId, capability],
    );
    const scheduleId = `schedule-${resourceId}`;
    await pool.query(
      `INSERT INTO scheduler_schedule_templates (
         schedule_id,business_slug,resource_id,time_zone,revision
       ) VALUES ($1,$2,$3,'UTC',1)`,
      [scheduleId, BUSINESS, resourceId],
    );
    await pool.query(
      `INSERT INTO scheduler_schedule_windows (
         business_slug,schedule_id,window_index,weekday,start_local,end_local,capacity
       ) VALUES ($1,$2,0,1,'08:00','12:00',1)`,
      [BUSINESS, scheduleId],
    );
  }
}

function demand(demandId: string): SchedulingDemand {
  return {
    schemaVersion: 1,
    businessSlug: BUSINESS,
    demandId,
    service: { serviceId: 'svc-g2-s8', revision: 1 },
    offering: {
      offeringId: 'off-g2-s8',
      revision: 1,
      durationMinutes: 30,
    },
    capacityUnits: 1,
    requiredCapabilities: [
      { code: 'BAY_ACCESS', quantity: 1, resourceKinds: ['BAY'] },
      { code: 'TECHNICIAN', quantity: 1, resourceKinds: ['TECHNICIAN'] },
    ],
    buffers: { beforeMinutes: 0, afterMinutes: 0 },
  };
}

async function candidateAt(demandValue: SchedulingDemand, startAt: string) {
  const endAt = new Date(Date.parse(startAt) + 30 * 60_000).toISOString();
  const result = await queryDeterministicMultiResourceAvailability(pool, {
    businessSlug: BUSINESS,
    requestId: `availability-${demandValue.demandId}-${startAt}`,
    demand: demandValue,
    window: { startAt, endAt, timeZone: 'UTC' },
  }, {
    granularityMinutes: 30,
    generatedAt: '2029-12-01T00:00:00.000Z',
    asOf: '2029-12-01T00:00:00.000Z',
  });
  return result.slots[0];
}

async function main(): Promise<void> {
  try {
    await resetFixture();

    const availabilityDemand = demand('g2-s8-demand-availability');
    const availability = await queryDeterministicMultiResourceAvailability(pool, {
      businessSlug: BUSINESS,
      requestId: 'g2-s8-availability',
      demand: availabilityDemand,
      window: { startAt: SLOT_A, endAt: WINDOW_END, timeZone: 'UTC' },
      limit: 20,
    }, {
      granularityMinutes: 30,
      generatedAt: '2029-12-01T00:00:00.000Z',
      asOf: '2029-12-01T00:00:00.000Z',
    });

    assert(availability.slots.length >= 4, `expected joint candidates, got ${availability.slots.length}`);
    assert(
      availability.slots.every((slot) =>
        slot.assignments.length === 2
        && slot.assignments.some((assignment) => assignment.resourceId.startsWith('bay-'))
        && slot.assignments.some((assignment) => assignment.resourceId.startsWith('tech-')),
      ),
      'every multi-resource slot must bind one BAY and one TECHNICIAN',
    );
    assert(
      availability.slots.every((slot) =>
        slot.assignments[0]!.resourceId.localeCompare(slot.assignments[1]!.resourceId) < 0,
      ),
      'assignments must be canonically ordered',
    );
    console.log('SCHEDULER_G2_S8_JOINT_AVAILABILITY_PASS', JSON.stringify({ slots: availability.slots.length }));

    const directDemand = demand('g2-s8-demand-direct');
    const directCandidate = await candidateAt(directDemand, SLOT_A);
    assert(directCandidate, 'direct multi-resource candidate missing');
    const directInput: ConfirmReservationInput = {
      businessSlug: BUSINESS,
      operationId: 'g2-s8-direct-confirm',
      demand: directDemand,
      candidateId: directCandidate.candidateId,
      requestedStartAt: SLOT_A,
    };
    const direct = await confirmMultiResourceReservationAtomic(pool, directInput, {
      now: '2029-12-01T00:00:00.000Z',
    });
    assert(!direct.replayed, 'first direct confirmation must not be replayed');
    assert(direct.reservation.assignments.length === 2, 'direct reservation must persist two assignments');

    const persistedAssignments = await pool.query<{ resource_id: string }>(
      `SELECT resource_id
         FROM scheduler_reservation_assignments
        WHERE business_slug = $1 AND reservation_id = $2
        ORDER BY resource_id ASC`,
      [BUSINESS, direct.reservation.reservationId],
    );
    assert(persistedAssignments.rows.length === 2, 'exactly two durable assignment rows required');
    console.log('SCHEDULER_G2_S8_ATOMIC_MULTI_RESOURCE_PASS', JSON.stringify({
      reservationId: direct.reservation.reservationId,
      assignments: direct.reservation.assignments,
    }));

    const replay = await confirmMultiResourceReservationAtomic(pool, directInput, {
      now: '2029-12-01T00:00:01.000Z',
    });
    assert(replay.replayed, 'same operation/material must replay');
    assert(replay.reservation.reservationId === direct.reservation.reservationId, 'replay reservation identity changed');
    const directCount = await pool.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count
         FROM scheduler_reservations
        WHERE business_slug = $1 AND demand_id = $2`,
      [BUSINESS, directDemand.demandId],
    );
    assert(Number(directCount.rows[0]!.count) === 1, 'replay duplicated reservation');
    console.log('SCHEDULER_G2_S8_REPLAY_PASS');

    const raceDemand = demand('g2-s8-demand-race');
    const raceCandidate = await candidateAt(raceDemand, SLOT_B);
    assert(raceCandidate, 'race candidate missing');

    const race = await Promise.allSettled([
      confirmMultiResourceReservationAtomic(pool, {
        businessSlug: BUSINESS,
        operationId: 'g2-s8-race-a',
        demand: raceDemand,
        candidateId: raceCandidate.candidateId,
        requestedStartAt: SLOT_B,
      }, { now: '2029-12-01T00:00:02.000Z' }),
      confirmMultiResourceReservationAtomic(pool, {
        businessSlug: BUSINESS,
        operationId: 'g2-s8-race-b',
        demand: raceDemand,
        candidateId: raceCandidate.candidateId,
        requestedStartAt: SLOT_B,
      }, { now: '2029-12-01T00:00:02.000Z' }),
    ]);

    const winners = race.filter((result) => result.status === 'fulfilled');
    const losers = race.filter((result) => result.status === 'rejected');
    assert(winners.length === 1 && losers.length === 1, `expected one winner/one loser, got ${winners.length}/${losers.length}`);
    const loserReason = (losers[0] as PromiseRejectedResult).reason;
    assert(
      loserReason instanceof SchedulerReservationError
      && (loserReason.code === 'CAPACITY_CONFLICT' || loserReason.code === 'SLOT_NO_LONGER_AVAILABLE'),
      `unexpected race loser ${String(loserReason)}`,
    );

    const raceReservations = await pool.query<{ reservation_id: string }>(
      `SELECT reservation_id
         FROM scheduler_reservations
        WHERE business_slug = $1 AND demand_id = $2`,
      [BUSINESS, raceDemand.demandId],
    );
    assert(raceReservations.rows.length === 1, `race must persist one reservation, got ${raceReservations.rows.length}`);
    const raceAssignments = await pool.query<{ resource_id: string }>(
      `SELECT resource_id
         FROM scheduler_reservation_assignments
        WHERE business_slug = $1 AND reservation_id = $2
        ORDER BY resource_id ASC`,
      [BUSINESS, raceReservations.rows[0]!.reservation_id],
    );
    assert(raceAssignments.rows.length === 2, `winner must persist both assignments, got ${raceAssignments.rows.length}`);

    const loserOperation = race[0]!.status === 'rejected' ? 'g2-s8-race-a' : 'g2-s8-race-b';
    const loserCommand = await pool.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count
         FROM scheduler_commands
        WHERE business_slug = $1 AND operation_id = $2`,
      [BUSINESS, loserOperation],
    );
    assert(Number(loserCommand.rows[0]!.count) === 0, 'loser command must roll back completely');
    console.log('SCHEDULER_G2_S8_ALL_OR_NOTHING_CONCURRENCY_PASS', JSON.stringify({
      loserCode: loserReason.code,
      winnerReservationId: raceReservations.rows[0]!.reservation_id,
    }));

    let holdRejected = false;
    try {
      await confirmMultiResourceReservationAtomic(pool, {
        businessSlug: BUSINESS,
        operationId: 'g2-s8-hold-not-claimed',
        demand: demand('g2-s8-demand-hold-boundary'),
        candidateId: raceCandidate.candidateId,
        holdId: 'unsupported-multi-hold',
        requestedStartAt: SLOT_B,
      });
    } catch (error) {
      holdRejected = error instanceof SchedulerReservationError && error.code === 'SCHEDULING_DEMAND_INVALID';
    }
    assert(holdRejected, 'multi-resource hold consumption must remain explicitly outside G2-S8 claim');
    console.log('SCHEDULER_G2_S8_HOLD_BOUNDARY_PASS');

    console.log('SCHEDULER_G2_S8_MULTI_RESOURCE_PASS');
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error('SCHEDULER_G2_S8_MULTI_RESOURCE_FAILED', JSON.stringify({ error: String(error), stack: error instanceof Error ? error.stack : undefined }));
  process.exitCode = 1;
});
