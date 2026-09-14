import { Pool } from 'pg';
import { loadRuntimeConfig } from '../src/config/runtime-config.js';

const BUSINESS_SLUG = 'golden-business';
const CASE_A_CUSTOMER_ID = 'cus_me1_phys_unique';
const CASE_A_LOGAN_ID = 'men_me1_phys_logan';
const CASE_B_NAME = 'ME1 New Customer 20260914';
const CASE_B_EMAIL = 'me1.new.20260914@example.test';
const CASE_C_NAME = 'ME1 Duplicate Customer';
const CASE_C_EMAIL = 'me1.duplicate.b@example.test';
const CASE_C_EXPECTED_CUSTOMER_ID = 'cus_me1_phys_duplicate_b';

function requireWorkflowId(): string {
  const value = process.env.ME1_PHYSICAL_WORKFLOW_ID?.trim();
  if (!value) {
    throw new Error(
      'ME1_PHYSICAL_WORKFLOW_ID is required. Use the Workflow id from the completed Case A browser run.',
    );
  }
  return value;
}

async function run(): Promise<void> {
  const workflowId = requireWorkflowId();
  const config = loadRuntimeConfig();
  const pool = new Pool({ connectionString: config.postgresUrl, max: 1 });

  try {
    const booking = await pool.query<{
      appointment_id: string;
      customer_id: string;
      appointment_managed_entity_id: string | null;
      case_id: string | null;
      case_managed_entity_id: string | null;
      resource_reservation_id: string | null;
      reservation_managed_entity_id: string | null;
      reservation_status: string | null;
      service_id: string;
      product_id: string;
      entity_display_name: string | null;
      timeline_count: string;
    }>(
      `SELECT
         a.appointment_id,
         a.customer_id,
         a.managed_entity_id AS appointment_managed_entity_id,
         a.case_id,
         c.managed_entity_id AS case_managed_entity_id,
         a.resource_reservation_id,
         r.managed_entity_id AS reservation_managed_entity_id,
         r.status AS reservation_status,
         a.service_id,
         a.product_id,
         me.display_name AS entity_display_name,
         (
           SELECT COUNT(*)::text
             FROM operational_timeline_events tle
            WHERE tle.workflow_id = a.workflow_id
              AND tle.event_type = 'APPOINTMENT_REGISTERED'
         ) AS timeline_count
       FROM appointments a
       LEFT JOIN operational_cases c ON c.case_id = a.case_id
       LEFT JOIN resource_reservations r ON r.resource_reservation_id = a.resource_reservation_id
       LEFT JOIN managed_entities me ON me.managed_entity_id = a.managed_entity_id
      WHERE a.business_slug = $1
        AND a.workflow_id = $2`,
      [BUSINESS_SLUG, workflowId],
    );

    if (booking.rows.length !== 1) {
      throw new Error(`ME1_PHYSICAL_BOOKING_EXPECTED_ONE:${booking.rows.length}`);
    }
    const row = booking.rows[0]!;
    if (row.customer_id !== CASE_A_CUSTOMER_ID) {
      throw new Error(`ME1_PHYSICAL_CASE_A_CUSTOMER_MISMATCH:${row.customer_id}`);
    }
    if (row.appointment_managed_entity_id !== CASE_A_LOGAN_ID) {
      throw new Error(`ME1_PHYSICAL_APPOINTMENT_ENTITY_MISMATCH:${row.appointment_managed_entity_id}`);
    }
    if (row.case_managed_entity_id !== CASE_A_LOGAN_ID) {
      throw new Error(`ME1_PHYSICAL_CASE_ENTITY_MISMATCH:${row.case_managed_entity_id}`);
    }
    if (row.reservation_managed_entity_id !== CASE_A_LOGAN_ID) {
      throw new Error(`ME1_PHYSICAL_RESERVATION_ENTITY_MISMATCH:${row.reservation_managed_entity_id}`);
    }
    if (row.reservation_status !== 'BOOKED') {
      throw new Error(`ME1_PHYSICAL_RESERVATION_NOT_BOOKED:${row.reservation_status}`);
    }
    if (row.service_id !== 'svc_car_wash') {
      throw new Error(`ME1_PHYSICAL_SERVICE_MISMATCH:${row.service_id}`);
    }
    if (Number.parseInt(row.timeline_count, 10) !== 1) {
      throw new Error(`ME1_PHYSICAL_TIMELINE_EXPECTED_ONE:${row.timeline_count}`);
    }

    const caseB = await pool.query<{ customer_id: string; customer_name: string | null; email_normalized: string | null }>(
      `SELECT c.customer_id, c.customer_name, cc.email_normalized
         FROM customers c
         JOIN customer_contacts cc ON cc.customer_id = c.customer_id AND cc.business_slug = c.business_slug
        WHERE c.business_slug = $1
          AND c.status = 'ACTIVE'
          AND regexp_replace(lower(btrim(c.customer_name)), '[[:space:]]+', ' ', 'g') =
              regexp_replace(lower(btrim($2::text)), '[[:space:]]+', ' ', 'g')
          AND lower(btrim(cc.email_normalized)) = lower(btrim($3))
        ORDER BY c.customer_id`,
      [BUSINESS_SLUG, CASE_B_NAME, CASE_B_EMAIL],
    );
    if (caseB.rows.length !== 1) {
      throw new Error(`ME1_PHYSICAL_CASE_B_EXPECTED_CREATED_CUSTOMER:${caseB.rows.length}`);
    }

    const caseCNameCount = await pool.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count
         FROM customers
        WHERE business_slug = $1
          AND status = 'ACTIVE'
          AND regexp_replace(lower(btrim(customer_name)), '[[:space:]]+', ' ', 'g') =
              regexp_replace(lower(btrim($2::text)), '[[:space:]]+', ' ', 'g')`,
      [BUSINESS_SLUG, CASE_C_NAME],
    );
    if (Number.parseInt(caseCNameCount.rows[0]?.count ?? '0', 10) !== 2) {
      throw new Error(`ME1_PHYSICAL_CASE_C_DUPLICATE_SET_CHANGED:${caseCNameCount.rows[0]?.count ?? '0'}`);
    }

    const caseCEmail = await pool.query<{ customer_id: string }>(
      `SELECT customer_id
         FROM customer_contacts
        WHERE business_slug = $1
          AND lower(btrim(email_normalized)) = lower(btrim($2))
        ORDER BY customer_id`,
      [BUSINESS_SLUG, CASE_C_EMAIL],
    );
    if (caseCEmail.rows.length !== 1 || caseCEmail.rows[0]!.customer_id !== CASE_C_EXPECTED_CUSTOMER_ID) {
      throw new Error(
        `ME1_PHYSICAL_CASE_C_EMAIL_MISMATCH:${caseCEmail.rows.map((item) => item.customer_id).join(',')}`,
      );
    }

    console.log('ME1_PHYSICAL_CUSTOMER_PATHS_PASS');
    console.log('ME1_PHYSICAL_CAR_WASH_PASS');
    console.log(JSON.stringify({
      workflowId,
      appointmentId: row.appointment_id,
      customerId: row.customer_id,
      managedEntityId: row.appointment_managed_entity_id,
      managedEntity: row.entity_display_name,
      caseId: row.case_id,
      resourceReservationId: row.resource_reservation_id,
      reservationStatus: row.reservation_status,
      serviceId: row.service_id,
      productId: row.product_id,
      caseBCreatedCustomerId: caseB.rows[0]!.customer_id,
      caseCResolvedCustomerId: CASE_C_EXPECTED_CUSTOMER_ID,
    }, null, 2));
  } finally {
    await pool.end();
  }
}

run().catch((error: unknown) => {
  console.error(`ME1_PHYSICAL_VERIFY_FAILED ${JSON.stringify({
    error: error instanceof Error ? error.message : String(error),
  })}`);
  process.exitCode = 1;
});
