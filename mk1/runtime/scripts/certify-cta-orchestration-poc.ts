import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { loadRuntimeConfig } from '../src/config/runtime-config.js';

const baseUrl = (process.env.ENGINES_CHANNEL_URL ?? 'http://127.0.0.1:8788').replace(/\/$/, '');
const businessSlug = 'golden-business';
const channel = 'API';
type Json = Record<string, unknown>;

function record(value: unknown): Json { return value && typeof value === 'object' && !Array.isArray(value) ? value as Json : {}; }
function list(value: unknown): Json[] { return Array.isArray(value) ? value.map(record) : []; }
function assert(value: unknown, message: string): asserts value { if (!value) throw new Error(`CTA_POC_ASSERTION_FAILED:${message}`); }

async function request(path: string, init?: RequestInit): Promise<Json> {
  const response = await fetch(`${baseUrl}${path}`, init);
  const body = record(await response.json());
  if (!response.ok) throw new Error(`CTA_POC_HTTP_${response.status}:${JSON.stringify(body)}`);
  return body;
}

async function event(conversationId: string, messageId: string, action: string, payload: Json = {}): Promise<Json> {
  return request('/channel/events', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      version: 'v1', channel, businessSlug, externalConversationId: conversationId,
      externalMessageId: messageId, externalSenderId: `api:user:${conversationId}`, action, payload,
    }),
  });
}

async function state(conversationId: string): Promise<Json> {
  const body = await request(`/channel/conversations/${encodeURIComponent(conversationId)}?businessSlug=${businessSlug}&channel=${channel}`);
  return record(body.state);
}

async function waitFor(conversationId: string, predicate: (value: Json) => boolean, label: string): Promise<Json> {
  const deadline = Date.now() + 30_000;
  let current: Json = {};
  while (Date.now() < deadline) {
    current = await state(conversationId);
    if (predicate(current)) return current;
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  throw new Error(`CTA_POC_TIMEOUT:${label}:${JSON.stringify(current)}`);
}

function isolatedBookableDate(): string {
  // Keep CTA certification capacity isolated from the inherited Appointment/Services
  // probes, which intentionally consume the nearest Friday/Saturday fixture slots.
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + 14);
  while (date.getUTCDay() === 0) date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

async function schedulerReservationForWorkflow(
  pool: Pool,
  workflowId: string,
): Promise<Readonly<{ reservation_id: string; status: string }> | undefined> {
  const result = await pool.query<{ reservation_id: string; status: string }>(
    `SELECT r.reservation_id, r.status
       FROM scheduler_commands c
       JOIN scheduler_reservations r
         ON r.business_slug = c.business_slug AND r.reservation_id = c.result_id
      WHERE c.business_slug = $1
        AND c.operation_id = $2
        AND c.command_type = 'ConfirmReservation'
        AND c.result_type = 'RESERVATION'`,
    [businessSlug, `appointment-finalize:${workflowId}`],
  );
  return result.rows[0];
}

async function drive(conversationId: string, token: string, failBeforeFinalize = false): Promise<Json> {
  const started = await event(conversationId, `${token}:start`, 'START_APPOINTMENT');
  assert(typeof started.workflowId === 'string', 'workflow identity missing');
  await waitFor(conversationId, (v) => v.phase === 'WAITING_FOR_CUSTOMER', 'customer');
  await event(conversationId, `${token}:name`, 'PROVIDE_CUSTOMER', { customerPatch: { name: `CTA ${token}` } });
  await event(conversationId, `${token}:email`, 'PROVIDE_CUSTOMER', { customerPatch: { contact: { email: `${token}@example.test` } } });
  await event(conversationId, `${token}:resolve`, 'RESOLVE_CUSTOMER');
  let current = await waitFor(conversationId, (v) => v.phase === 'WAITING_FOR_SERVICE', 'service');
  assert(list(current.services).some((v) => v.serviceId === 'svc_car_wash'), 'service fixture missing');
  await event(conversationId, `${token}:offering`, 'SELECT_OFFERING', { catalogOfferingId: 'prd_car_wash_basic' });
  await waitFor(conversationId, (v) => v.phase === 'WAITING_FOR_DATE', 'date');
  await event(conversationId, `${token}:date`, 'SET_DATE', { dateInput: isolatedBookableDate() });
  current = await waitFor(conversationId, (v) => v.phase === 'WAITING_FOR_SLOT', 'slot');
  const slot = list(current.availableSlots)[0];
  assert(typeof slot?.start === 'string', 'slot fixture missing');
  await event(conversationId, `${token}:slot`, 'SELECT_SLOT', { slotStart: slot.start });
  await waitFor(conversationId, (v) => v.phase === 'READY_TO_FINALIZE', 'finalize');

  if (failBeforeFinalize) {
    const customer = record(current.customer);
    const customerId = String(customer.customerId ?? record((await state(conversationId)).customer).customerId ?? '');
    assert(customerId, 'compensation customer missing');
    const pool = new Pool({ connectionString: loadRuntimeConfig().postgresUrl });
    try {
      const managedEntityId = `men_fixture_${randomUUID()}`;
      await pool.query(
        `INSERT INTO managed_entities(managed_entity_id,business_slug,customer_id,entity_type,external_ref)
         VALUES($1,$2,$3,'COMPENSATION_FIXTURE',$4)`,
        [managedEntityId,businessSlug,customerId,token],
      );
      await pool.query(
        `INSERT INTO operational_cases(case_id,business_slug,customer_id,managed_entity_id,workflow_id,status)
         VALUES($1,$2,$3,$4,$5,'FAILURE_FIXTURE')`,
        [`case_fixture_${randomUUID()}`,businessSlug,customerId,managedEntityId,started.workflowId],
      );
    } finally { await pool.end(); }
  }

  await event(conversationId, `${token}:finalize`, 'FINALIZE_APPOINTMENT');
  if (!failBeforeFinalize) return waitFor(conversationId, (v) => v.workflowStatus === 'COMPLETED', 'terminal');

  const pool = new Pool({ connectionString: loadRuntimeConfig().postgresUrl });
  try {
    const deadline = Date.now() + 30_000;
    while (Date.now() < deadline) {
      const schedulerReservation = await schedulerReservationForWorkflow(pool, String(started.workflowId));
      if (schedulerReservation?.status === 'CANCELLED') {
        return waitFor(conversationId, (v) => v.workflowStatus === 'FAILED', 'scheduler-failure-terminal');
      }

      // Backward-compatible evidence for pre-G2 Appointment implementations.
      const released = await pool.query<{ status: string }>(
        `SELECT status FROM resource_reservations WHERE workflow_id=$1`, [started.workflowId],
      );
      if (released.rows[0]?.status === 'RELEASED') {
        return waitFor(conversationId, (v) => v.workflowStatus === 'FAILED', 'legacy-failure-terminal');
      }
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
    throw new Error('CTA_POC_TIMEOUT:compensation');
  } finally { await pool.end(); }
}

async function verifyGraph(result: Json, workflowId: string, eventId: string): Promise<void> {
  const appointment = record(result.result);
  for (const key of ['appointmentId','customerId','managedEntityId','caseId']) {
    assert(typeof appointment[key] === 'string', `${key} missing from workflow result`);
  }

  const pool = new Pool({ connectionString: loadRuntimeConfig().postgresUrl });
  try {
    if (typeof appointment.schedulerReservationId === 'string') {
      assert(appointment.resourceReservationId === undefined, 'Scheduler-backed Appointment emitted legacy ResourceReservation identity');
      const graph = await pool.query<Json>(
        `SELECT a.business_slug,a.customer_id,a.managed_entity_id,a.case_id,
                a.resource_reservation_id,a.scheduler_reservation_id,
                r.status AS scheduler_reservation_status,
                (SELECT COUNT(*)::int
                   FROM scheduler_reservation_assignments ra
                  WHERE ra.business_slug=r.business_slug AND ra.reservation_id=r.reservation_id) AS assignment_count,
                c.customer_id AS case_customer_id,t.event_type,i.status AS ingress_status,
                i.workflow_id AS ingress_workflow_id,i.case_id AS ingress_case_id,i.appointment_id AS ingress_appointment_id
           FROM appointments a
           JOIN scheduler_reservations r
             ON r.business_slug=a.business_slug AND r.reservation_id=a.scheduler_reservation_id
           JOIN operational_cases c ON c.case_id=a.case_id
           JOIN operational_timeline_events t ON t.appointment_id=a.appointment_id
           JOIN cta_ingress_records i ON i.event_id=$2
          WHERE a.workflow_id=$1`,
        [workflowId,eventId],
      );
      const row = graph.rows[0];
      assert(row, 'Scheduler-backed persistence graph missing');
      assert(row.business_slug === businessSlug, 'business scope mismatch');
      assert(row.customer_id === row.case_customer_id, 'Case customer mismatch');
      assert(row.scheduler_reservation_id === appointment.schedulerReservationId, 'Scheduler reservation link mismatch');
      assert(row.resource_reservation_id === null, 'legacy ResourceReservation shadow write detected');
      assert(row.scheduler_reservation_status === 'RESERVED', 'Scheduler reservation is not RESERVED');
      assert(Number(row.assignment_count) === 1, 'G2-S7 Scheduler reservation is not one-resource');
      assert(row.ingress_status === 'COMPLETED', 'CTA ingress is not COMPLETED');
      assert(row.ingress_workflow_id === workflowId, 'ingress workflow mismatch');
      assert(row.ingress_case_id === appointment.caseId, 'ingress Case mismatch');
      assert(row.ingress_appointment_id === appointment.appointmentId, 'ingress Appointment mismatch');
      return;
    }

    assert(typeof appointment.resourceReservationId === 'string', 'capacity reservation identity missing from workflow result');
    const graph = await pool.query<Json>(
      `SELECT a.business_slug,a.customer_id,a.managed_entity_id,a.case_id,a.resource_reservation_id,
       r.status AS reservation_status,r.appointment_id AS reservation_appointment_id,
       c.customer_id AS case_customer_id,t.event_type,i.status AS ingress_status,
       i.workflow_id AS ingress_workflow_id,i.case_id AS ingress_case_id,i.appointment_id AS ingress_appointment_id
       FROM appointments a
       JOIN resource_reservations r ON r.resource_reservation_id=a.resource_reservation_id
       JOIN operational_cases c ON c.case_id=a.case_id
       JOIN operational_timeline_events t ON t.appointment_id=a.appointment_id
       JOIN cta_ingress_records i ON i.event_id=$2
       WHERE a.workflow_id=$1`,
      [workflowId,eventId],
    );
    const row = graph.rows[0];
    assert(row, 'legacy persistence graph missing');
    assert(row.business_slug === businessSlug, 'business scope mismatch');
    assert(row.customer_id === row.case_customer_id, 'Case customer mismatch');
    assert(row.reservation_status === 'BOOKED', 'ResourceReservation is not BOOKED');
    assert(row.ingress_status === 'COMPLETED', 'CTA ingress is not COMPLETED');
    assert(row.ingress_workflow_id === workflowId, 'ingress workflow mismatch');
    assert(row.ingress_case_id === appointment.caseId, 'ingress Case mismatch');
    assert(row.ingress_appointment_id === appointment.appointmentId, 'ingress Appointment mismatch');
  } finally { await pool.end(); }
}

async function verifySequentialConversation(
  conversationId: string,
  first: Json,
  second: Json,
): Promise<void> {
  const firstResult = record(first.result);
  const secondResult = record(second.result);
  assert(first.workflowId !== second.workflowId, 'sequential appointment reused workflow identity');
  assert(firstResult.appointmentId !== secondResult.appointmentId, 'sequential appointment reused Appointment identity');

  const pool = new Pool({ connectionString: loadRuntimeConfig().postgresUrl });
  try {
    const ingress = await pool.query<Json>(
      `SELECT workflow_id,appointment_id,status
       FROM cta_ingress_records
       WHERE business_slug=$1 AND correlation_id=$2 AND action='register_appointment'
       ORDER BY created_at`,
      [businessSlug, conversationId],
    );
    assert(ingress.rows.length === 2, 'same conversation did not retain two distinct CTA ingress records');
    assert(ingress.rows[0]?.workflow_id === first.workflowId, 'first ingress workflow was overwritten');
    assert(ingress.rows[0]?.appointment_id === firstResult.appointmentId, 'first ingress Appointment was overwritten');
    assert(ingress.rows[0]?.status === 'COMPLETED', 'first ingress lost terminal state');
    assert(ingress.rows[1]?.workflow_id === second.workflowId, 'second ingress workflow mismatch');
    assert(ingress.rows[1]?.appointment_id === secondResult.appointmentId, 'second ingress Appointment was overwritten');
    assert(ingress.rows[1]?.status === 'COMPLETED', 'second ingress did not complete');

    const binding = await pool.query<Json>(
      `SELECT workflow_id,binding_status
       FROM channel_conversation_bindings
       WHERE business_slug=$1 AND channel=$2 AND external_conversation_id=$3`,
      [businessSlug, channel, conversationId],
    );
    assert(binding.rows[0]?.workflow_id === second.workflowId, 'terminal binding did not rebind to second workflow');
    assert(binding.rows[0]?.binding_status === 'COMPLETED', 'second workflow binding did not reach COMPLETED');
  } finally { await pool.end(); }
}

async function verifyFailureCompensation(failed: Json): Promise<void> {
  const workflowId = String(failed.workflowId);
  const pool = new Pool({ connectionString: loadRuntimeConfig().postgresUrl });
  try {
    const schedulerReservation = await schedulerReservationForWorkflow(pool, workflowId);
    if (schedulerReservation) {
      assert(schedulerReservation.status === 'CANCELLED', 'failed Scheduler-backed Appointment retained blocking RESERVED capacity');
      const appointment = await pool.query(
        `SELECT 1 FROM appointments WHERE business_slug=$1 AND scheduler_reservation_id=$2`,
        [businessSlug, schedulerReservation.reservation_id],
      );
      assert((appointment.rowCount ?? 0) === 0, 'compensated Scheduler reservation is linked to an Appointment');
    } else {
      const released = await pool.query<{ status: string; release_reason: string }>(
        `SELECT status,release_reason FROM resource_reservations WHERE workflow_id=$1`, [workflowId],
      );
      assert(released.rows[0]?.status === 'RELEASED', 'failed legacy Appointment did not release HELD capacity');
    }

    const ingress = await pool.query<{ status: string; error_code: string | null }>(
      `SELECT status,error_code FROM cta_ingress_records
       WHERE workflow_id=$1 AND action='register_appointment'
       ORDER BY created_at LIMIT 1`,
      [workflowId],
    );
    assert(ingress.rows[0]?.status === 'FAILED', 'failed workflow ingress did not reach FAILED');
    assert(Boolean(ingress.rows[0]?.error_code), 'failed workflow ingress error code missing');
  } finally { await pool.end(); }
}

async function main(): Promise<void> {
  const health = await request('/health');
  assert(health.ok === true, 'channel core health failed');
  const token = randomUUID();
  const conversationId = `api:conversation:${token}`;
  const completed = await drive(conversationId, token);
  const completedResult = record(completed.result);
  const workflowId = String(completed.workflowId);
  const startReplay = await event(conversationId, `${token}:start`, 'START_APPOINTMENT');
  assert(startReplay.replayed === true, 'provider event replay was not deduplicated');

  const startEnvelope = record(startReplay.ingress);
  await verifyGraph(completed, workflowId, String(startEnvelope.eventId));

  const secondToken = randomUUID();
  const secondCompleted = await drive(conversationId, secondToken);
  const secondReplay = await event(conversationId, `${secondToken}:start`, 'START_APPOINTMENT');
  assert(secondReplay.replayed === true, 'second provider event replay was not deduplicated');
  const secondEnvelope = record(secondReplay.ingress);
  await verifyGraph(secondCompleted, String(secondCompleted.workflowId), String(secondEnvelope.eventId));
  await verifyGraph(completed, workflowId, String(startEnvelope.eventId));
  await verifySequentialConversation(conversationId, completed, secondCompleted);

  const failureToken = randomUUID();
  const failed = await drive(`api:conversation:${failureToken}`, failureToken, true);
  assert(record(failed.failure).code || failed.workflowStatus === 'FAILED', 'failure projection missing');
  await verifyFailureCompensation(failed);

  console.log(`CTA_ORCHESTRATION_POC_PASS ${JSON.stringify({
    workflowId,
    appointmentId: completedResult.appointmentId,
    caseId: completedResult.caseId,
    schedulerReservationId: completedResult.schedulerReservationId ?? null,
    resourceReservationId: completedResult.resourceReservationId ?? null,
    capacityAuthority: completedResult.schedulerReservationId ? 'SCHEDULER' : 'LEGACY_RESOURCE_RESERVATION',
    secondWorkflowId: secondCompleted.workflowId,
    secondAppointmentId: record(secondCompleted.result).appointmentId,
    sequentialConversation: true,
    failureCompensation: true,
  })}`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exitCode = 1;
});