import { Pool, type PoolClient } from 'pg';
import { loadRuntimeConfig } from '../../config/runtime-config.js';

let pool: Pool | undefined;

function db(): Pool {
  pool ??= new Pool({ connectionString: loadRuntimeConfig().postgresUrl, max: 4 });
  return pool;
}

export type AppointmentSchedulerCompensationResult = Readonly<{
  kind: 'NO_SCHEDULER_RESERVATION' | 'ALREADY_TERMINAL' | 'CANCELLED';
  reservationId?: string;
  previousStatus?: 'RESERVED' | 'CANCELLED' | 'COMPLETED';
}>;

async function lockCapacityAssignments(
  client: PoolClient,
  businessSlug: string,
  reservationId: string,
): Promise<void> {
  const assignments = await client.query<{ resource_id: string }>(
    `SELECT resource_id
       FROM scheduler_reservation_assignments
      WHERE business_slug = $1 AND reservation_id = $2
      ORDER BY resource_id ASC`,
    [businessSlug, reservationId],
  );
  for (const assignment of assignments.rows) {
    await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [
      `scheduler-capacity:${businessSlug}:${assignment.resource_id}`,
    ]);
  }
}

/**
 * G2-S7 saga compensation for a Temporal Appointment activity that exhausted
 * its retries after Scheduler confirmation but before Appointment persistence.
 *
 * This is intentionally narrower than a general reservation-cancellation API:
 * G2-S8/G2-S9 do not inherit a cancellation-lifecycle claim from this helper.
 * The Scheduler command ledger remains immutable evidence of the attempted
 * confirmation while the reservation is moved out of capacity-blocking
 * RESERVED state.
 */
export async function compensateFailedAppointmentSchedulerReservation(input: Readonly<{
  businessSlug: string;
  workflowId: string;
}>): Promise<AppointmentSchedulerCompensationResult> {
  const operationId = `appointment-finalize:${input.workflowId}`;
  const client = await db().connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [
      `scheduler-operation:${input.businessSlug}:${operationId}`,
    ]);

    const command = await client.query<{
      command_type: string;
      result_type: string | null;
      result_id: string | null;
    }>(
      `SELECT command_type, result_type, result_id
         FROM scheduler_commands
        WHERE business_slug = $1 AND operation_id = $2
        FOR UPDATE`,
      [input.businessSlug, operationId],
    );
    const row = command.rows[0];
    if (!row) {
      await client.query('COMMIT');
      return { kind: 'NO_SCHEDULER_RESERVATION' };
    }
    if (row.command_type !== 'ConfirmReservation' || row.result_type !== 'RESERVATION' || !row.result_id) {
      throw new Error('APPOINTMENT_SCHEDULER_COMPENSATION_COMMAND_IDENTITY_MISMATCH');
    }

    await lockCapacityAssignments(client, input.businessSlug, row.result_id);
    const reservation = await client.query<{ status: 'RESERVED' | 'CANCELLED' | 'COMPLETED' }>(
      `SELECT status
         FROM scheduler_reservations
        WHERE business_slug = $1 AND reservation_id = $2
        FOR UPDATE`,
      [input.businessSlug, row.result_id],
    );
    const reservationRow = reservation.rows[0];
    if (!reservationRow) {
      throw new Error('APPOINTMENT_SCHEDULER_COMPENSATION_RESERVATION_MISSING');
    }
    if (reservationRow.status !== 'RESERVED') {
      await client.query('COMMIT');
      return {
        kind: 'ALREADY_TERMINAL',
        reservationId: row.result_id,
        previousStatus: reservationRow.status,
      };
    }

    const appointment = await client.query(
      `SELECT 1
         FROM appointments
        WHERE business_slug = $1 AND scheduler_reservation_id = $2`,
      [input.businessSlug, row.result_id],
    );
    if ((appointment.rowCount ?? 0) > 0) {
      throw new Error('APPOINTMENT_SCHEDULER_COMPENSATION_APPOINTMENT_ALREADY_PERSISTED');
    }

    const cancelled = await client.query(
      `UPDATE scheduler_reservations
          SET status = 'CANCELLED', revision = revision + 1, updated_at = NOW()
        WHERE business_slug = $1 AND reservation_id = $2 AND status = 'RESERVED'`,
      [input.businessSlug, row.result_id],
    );
    if (cancelled.rowCount !== 1) {
      throw new Error('APPOINTMENT_SCHEDULER_COMPENSATION_REVISION_CONFLICT');
    }

    await client.query('COMMIT');
    return {
      kind: 'CANCELLED',
      reservationId: row.result_id,
      previousStatus: 'RESERVED',
    };
  } catch (error) {
    try { await client.query('ROLLBACK'); } catch { /* transaction may already be closed */ }
    throw error;
  } finally {
    client.release();
  }
}

export async function closeAppointmentSchedulerCompensation(): Promise<void> {
  const current = pool;
  pool = undefined;
  if (current) await current.end();
}
