import { Pool } from 'pg';
import { loadRuntimeConfig } from '../src/config/runtime-config.js';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`SCHEDULER_G2_S9_ASSERTION_FAILED:${message}`);
}

async function scalar(pool: Pool, sql: string, params: unknown[] = []): Promise<number> {
  const result = await pool.query<{ count: string }>(sql, params);
  return Number(result.rows[0]?.count ?? '0');
}

async function main(): Promise<void> {
  const pool = new Pool({ connectionString: loadRuntimeConfig().postgresUrl, max: 4 });
  try {
    const [resources, reservations, assignments, holds, demands, commands] = await Promise.all([
      scalar(pool, 'SELECT COUNT(*)::text AS count FROM scheduler_resources'),
      scalar(pool, 'SELECT COUNT(*)::text AS count FROM scheduler_reservations'),
      scalar(pool, 'SELECT COUNT(*)::text AS count FROM scheduler_reservation_assignments'),
      scalar(pool, 'SELECT COUNT(*)::text AS count FROM scheduler_holds'),
      scalar(pool, 'SELECT COUNT(*)::text AS count FROM scheduler_demands'),
      scalar(pool, 'SELECT COUNT(*)::text AS count FROM scheduler_commands'),
    ]);

    assert(resources > 0, 'no Scheduler resources survived the full-gate run');
    assert(reservations > 0, 'no Scheduler reservations survived the full-gate run');
    assert(assignments >= reservations, 'reservation assignments are fewer than reservations');
    assert(holds > 0, 'G2-S4 hold lifecycle evidence is absent');
    assert(demands > 0, 'frozen Scheduler demand evidence is absent');
    assert(commands > 0, 'durable Scheduler command evidence is absent');

    const orphanAssignments = await scalar(
      pool,
      `SELECT COUNT(*)::text AS count
         FROM scheduler_reservation_assignments a
         LEFT JOIN scheduler_reservations r
           ON r.business_slug = a.business_slug
          AND r.reservation_id = a.reservation_id
        WHERE r.reservation_id IS NULL`,
    );
    assert(orphanAssignments === 0, `orphan reservation assignments found: ${orphanAssignments}`);

    console.log('SCHEDULER_G2_S9_PERSISTENCE_TRUTH_PASS', JSON.stringify({
      resources,
      reservations,
      assignments,
      holds,
      demands,
      commands,
      orphanAssignments,
    }));

    const appointmentGraph = await pool.query<{
      appointment_id: string;
      resource_reservation_id: string | null;
      scheduler_reservation_id: string | null;
      status: string | null;
      assignment_count: string;
    }>(
      `SELECT a.appointment_id,
              a.resource_reservation_id,
              a.scheduler_reservation_id,
              sr.status,
              (SELECT COUNT(*)::text
                 FROM scheduler_reservation_assignments sra
                WHERE sra.business_slug = a.business_slug
                  AND sra.reservation_id = a.scheduler_reservation_id) AS assignment_count
         FROM appointments a
         LEFT JOIN scheduler_reservations sr
           ON sr.business_slug = a.business_slug
          AND sr.reservation_id = a.scheduler_reservation_id
        WHERE a.business_slug = 'golden-business'
          AND a.scheduler_reservation_id IS NOT NULL
        ORDER BY a.created_at ASC`,
    );
    assert(appointmentGraph.rows.length >= 4, `expected >=4 Scheduler-backed golden Appointments, got ${appointmentGraph.rows.length}`);
    for (const row of appointmentGraph.rows) {
      assert(row.resource_reservation_id === null, `${row.appointment_id} has a legacy ResourceReservation shadow`);
      assert(row.scheduler_reservation_id, `${row.appointment_id} lost Scheduler reservation identity`);
      assert(row.status === 'RESERVED', `${row.appointment_id} points at non-RESERVED Scheduler capacity: ${String(row.status)}`);
      assert(Number(row.assignment_count) === 1, `${row.appointment_id} must remain the protected one-resource G2-S7 path`);
    }
    const legacyAppointmentShadows = await scalar(
      pool,
      `SELECT COUNT(*)::text AS count
         FROM resource_reservations rr
         JOIN appointments a ON a.workflow_id = rr.workflow_id
        WHERE a.business_slug = 'golden-business'
          AND a.scheduler_reservation_id IS NOT NULL`,
    );
    assert(legacyAppointmentShadows === 0, `legacy Appointment capacity shadows found: ${legacyAppointmentShadows}`);
    console.log('SCHEDULER_G2_S9_APPOINTMENT_AUTHORITY_PASS', JSON.stringify({
      schedulerBackedAppointments: appointmentGraph.rows.length,
      legacyAppointmentShadows,
      capacityAuthority: 'SCHEDULER',
    }));

    const s8Rows = await pool.query<{ reservation_id: string; assignment_count: string; kinds: string[] }>(
      `SELECT r.reservation_id,
              COUNT(a.resource_id)::text AS assignment_count,
              ARRAY_AGG(DISTINCT sr.resource_kind ORDER BY sr.resource_kind) AS kinds
         FROM scheduler_reservations r
         JOIN scheduler_reservation_assignments a
           ON a.business_slug = r.business_slug
          AND a.reservation_id = r.reservation_id
         JOIN scheduler_resources sr
           ON sr.business_slug = a.business_slug
          AND sr.resource_id = a.resource_id
        WHERE r.business_slug = 'g2-s8-multi-resource'
          AND r.status = 'RESERVED'
        GROUP BY r.reservation_id
        ORDER BY r.reservation_id`,
    );
    assert(s8Rows.rows.length >= 2, `expected >=2 G2-S8 reservations, got ${s8Rows.rows.length}`);
    for (const row of s8Rows.rows) {
      assert(Number(row.assignment_count) === 2, `${row.reservation_id} is not atomically two-resource`);
      assert(row.kinds.includes('BAY') && row.kinds.includes('TECHNICIAN'), `${row.reservation_id} lost BAY+TECHNICIAN binding`);
    }
    console.log('SCHEDULER_G2_S9_MULTI_RESOURCE_INTEGRITY_PASS', JSON.stringify({
      reservations: s8Rows.rows.map((row) => ({ reservationId: row.reservation_id, kinds: row.kinds })),
    }));

    const businessIsolation = await pool.query<{ business_slug: string; resource_count: string }>(
      `SELECT business_slug, COUNT(*)::text AS resource_count
         FROM scheduler_resources
        WHERE business_slug IN ('g2-s5-business-alpha','g2-s5-business-beta')
        GROUP BY business_slug
        ORDER BY business_slug`,
    );
    assert(businessIsolation.rows.length === 2, 'G2-S5 two-business fixture is incomplete');
    assert(businessIsolation.rows.every((row) => Number(row.resource_count) > 0), 'one G2-S5 business lost its Scheduler resources');
    console.log('SCHEDULER_G2_S9_MULTIBUSINESS_INTEGRITY_PASS', JSON.stringify(businessIsolation.rows));

    const duplicateCommands = await scalar(
      pool,
      `SELECT COUNT(*)::text AS count
         FROM (
           SELECT business_slug, operation_id
             FROM scheduler_commands
            GROUP BY business_slug, operation_id
           HAVING COUNT(*) > 1
         ) duplicates`,
    );
    const nullCommandResults = await scalar(
      pool,
      `SELECT COUNT(*)::text AS count
         FROM scheduler_commands
        WHERE result_type = 'RESERVATION'
          AND result_id IS NULL`,
    );
    assert(duplicateCommands === 0, `duplicate durable command identities found: ${duplicateCommands}`);
    assert(nullCommandResults === 0, `reservation commands with null result identity found: ${nullCommandResults}`);
    console.log('SCHEDULER_G2_S9_COMMAND_LEDGER_INTEGRITY_PASS', JSON.stringify({ duplicateCommands, nullCommandResults }));

    console.log('SCHEDULER_G2_S9_FINAL_AUDIT_PASS');
  } finally {
    await pool.end();
  }
}

main().catch((error: unknown) => {
  console.error('SCHEDULER_G2_S9_FINAL_AUDIT_FAILED', JSON.stringify({
    error: error instanceof Error ? error.stack ?? error.message : String(error),
  }));
  process.exitCode = 1;
});
