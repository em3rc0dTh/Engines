import { Pool } from 'pg';
import { loadRuntimeConfig } from '../src/config/runtime-config.js';
import type {
  ConfirmReservationInput,
  SchedulingDemand,
} from '../src/contracts/scheduler-engine/index.js';
import { confirmReservationAtomic } from '../src/scheduler/reservation-engine.js';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`SCHEDULER_G2_S7_ASSERTION_FAILED:${message}`);
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

async function run(): Promise<void> {
  const pool = new Pool({ connectionString: loadRuntimeConfig().postgresUrl, max: 4 });
  try {
    const graph = await pool.query<{
      appointment_id: string;
      workflow_id: string;
      service_id: string;
      product_id: string;
      resource_reservation_id: string | null;
      scheduler_reservation_id: string;
      reservation_status: string;
      demand_id: string;
      demand_service_id: string;
      demand_offering_id: string;
      service_revision: number;
      offering_revision: number;
      assignment_count: string;
      command_status: string;
      scheduler_operation_id: string | null;
      scheduler_result_id: string | null;
    }>(
      `SELECT
         a.appointment_id,
         a.workflow_id,
         a.service_id,
         a.product_id,
         a.resource_reservation_id,
         a.scheduler_reservation_id,
         sr.status AS reservation_status,
         sr.demand_id,
         sd.service_id AS demand_service_id,
         sd.offering_id AS demand_offering_id,
         sd.service_revision,
         sd.offering_revision,
         (SELECT COUNT(*)::text
            FROM scheduler_reservation_assignments sra
           WHERE sra.business_slug = a.business_slug
             AND sra.reservation_id = a.scheduler_reservation_id) AS assignment_count,
         ac.status AS command_status,
         sc.operation_id AS scheduler_operation_id,
         sc.result_id AS scheduler_result_id
       FROM appointments a
       JOIN scheduler_reservations sr
         ON sr.business_slug = a.business_slug
        AND sr.reservation_id = a.scheduler_reservation_id
       JOIN scheduler_demands sd
         ON sd.business_slug = sr.business_slug
        AND sd.demand_id = sr.demand_id
       JOIN appointment_commands ac
         ON ac.business_slug = a.business_slug
        AND ac.workflow_id = a.workflow_id
       LEFT JOIN scheduler_commands sc
         ON sc.business_slug = a.business_slug
        AND sc.operation_id = 'appointment-finalize:' || a.workflow_id
      WHERE a.business_slug = 'golden-business'
        AND a.scheduler_reservation_id IS NOT NULL
      ORDER BY a.created_at ASC`,
    );

    assert(graph.rows.length >= 4, `expected inherited + Services S7 Scheduler-backed Appointments, got ${graph.rows.length}`);
    for (const row of graph.rows) {
      assert(row.resource_reservation_id === null, `${row.appointment_id} still points at legacy ResourceReservation`);
      assert(row.reservation_status === 'RESERVED', `${row.appointment_id} Scheduler reservation is not RESERVED`);
      assert(row.service_id === row.demand_service_id, `${row.appointment_id} Service does not match frozen demand`);
      assert(row.product_id === row.demand_offering_id, `${row.appointment_id} Offering does not match frozen demand`);
      assert(Number(row.assignment_count) === 1, `${row.appointment_id} must have exactly one G2-S7 resource assignment`);
      assert(row.command_status === 'BOOKED', `${row.appointment_id} Appointment command is not BOOKED`);
      assert(row.scheduler_operation_id === `appointment-finalize:${row.workflow_id}`, `${row.appointment_id} Scheduler command identity mismatch`);
      assert(row.scheduler_result_id === row.scheduler_reservation_id, `${row.appointment_id} Scheduler command result mismatch`);
    }

    const legacy = await pool.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count
         FROM resource_reservations rr
         JOIN appointments a ON a.workflow_id = rr.workflow_id
        WHERE a.business_slug = 'golden-business'
          AND a.scheduler_reservation_id IS NOT NULL`,
    );
    assert(Number(legacy.rows[0]?.count ?? '0') === 0, 'G2-S7 wrote a legacy ResourceReservation shadow');

    console.log(`SCHEDULER_G2_S7_APPOINTMENT_SCHEDULER_LINK_PASS ${JSON.stringify({
      appointments: graph.rows.length,
      reservationIds: graph.rows.map((row) => row.scheduler_reservation_id),
      legacyResourceReservations: 0,
      assignmentsPerReservation: 1,
    })}`);

    const revisions = await pool.query<{ offering_revision: number }>(
      `SELECT DISTINCT sd.offering_revision
         FROM scheduler_demands sd
        WHERE sd.business_slug = 'golden-business'
          AND sd.offering_id = 'prd_car_wash_basic'
          AND sd.demand_id LIKE 'appointment-demand-%'
        ORDER BY sd.offering_revision ASC`,
    );
    const revisionValues = revisions.rows.map((row) => row.offering_revision);
    assert(revisionValues.length >= 2, `Services S7 did not prove Appointment demands across N/N+1: ${revisionValues.join(',')}`);
    assert(revisionValues.at(-1)! > revisionValues[0]!, `Appointment frozen demand revisions did not advance: ${revisionValues.join(',')}`);

    console.log(`SCHEDULER_G2_S7_FROZEN_SELECTION_PASS ${JSON.stringify({
      offeringId: 'prd_car_wash_basic',
      revisions: revisionValues,
    })}`);

    const replayTarget = graph.rows.at(-1)!;
    const ledger = await pool.query<{
      command_material: unknown;
      result_id: string | null;
    }>(
      `SELECT command_material, result_id
         FROM scheduler_commands
        WHERE business_slug = 'golden-business'
          AND operation_id = $1`,
      [`appointment-finalize:${replayTarget.workflow_id}`],
    );
    const material = record(ledger.rows[0]?.command_material);
    const demand = material.demand as SchedulingDemand | undefined;
    const candidateId = typeof material.candidateId === 'string' ? material.candidateId : undefined;
    const requestedStartAt = typeof material.requestedStartAt === 'string' ? material.requestedStartAt : undefined;
    assert(demand, 'Scheduler replay command lost immutable demand material');
    assert(candidateId, 'Scheduler replay command lost candidate identity');
    assert(requestedStartAt, 'Scheduler replay command lost requestedStartAt');

    const replayInput: ConfirmReservationInput = {
      businessSlug: 'golden-business',
      operationId: `appointment-finalize:${replayTarget.workflow_id}`,
      demand,
      candidateId,
      requestedStartAt,
    };
    const replay = await confirmReservationAtomic(pool, replayInput);
    assert(replay.replayed === true, 'same Appointment finalization operation did not replay');
    assert(replay.reservation.reservationId === replayTarget.scheduler_reservation_id, 'replay returned a different Scheduler reservation');

    const duplicateReservations = await pool.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count
         FROM scheduler_reservations
        WHERE business_slug = 'golden-business'
          AND reservation_id = $1`,
      [replayTarget.scheduler_reservation_id],
    );
    assert(Number(duplicateReservations.rows[0]?.count ?? '0') === 1, 'Scheduler replay duplicated reservation persistence');

    console.log(`SCHEDULER_G2_S7_REPLAY_PASS ${JSON.stringify({
      workflowId: replayTarget.workflow_id,
      operationId: replayInput.operationId,
      reservationId: replay.reservation.reservationId,
      replayed: replay.replayed,
    })}`);

    console.log(`SCHEDULER_G2_S7_APPOINTMENT_ORCHESTRATION_PASS ${JSON.stringify({
      schedulerBackedAppointments: graph.rows.length,
      frozenOfferingRevisions: revisionValues,
      legacyReservationShadow: false,
      oneResourcePath: true,
      replaySafe: true,
    })}`);
  } finally {
    await pool.end();
  }
}

run().catch((error: unknown) => {
  console.error(`SCHEDULER_G2_S7_APPOINTMENT_ORCHESTRATION_FAILED ${JSON.stringify({
    error: error instanceof Error ? error.stack ?? error.message : String(error),
  })}`);
  process.exitCode = 1;
});
