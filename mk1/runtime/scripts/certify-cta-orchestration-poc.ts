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

function nextBookableDate(): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + 2);
  while (date.getUTCDay() === 0) date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
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
  await event(conversationId, `${token}:date`, 'SET_DATE', { dateInput: nextBookableDate() });
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
      const released = await pool.query<{ status: string }>(
        `SELECT status FROM resource_reservations WHERE workflow_id=$1`, [started.workflowId],
      );
      if (released.rows[0]?.status === 'RELEASED') {
        return { workflowId: started.workflowId, workflowStatus: 'FAILED' };
      }
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
    throw new Error('CTA_POC_TIMEOUT:compensation');
  } finally { await pool.end(); }
}

async function verifyGraph(result: Json, workflowId: string, eventId: string): Promise<void> {
  const appointment = record(result.result);
  for (const key of ['appointmentId','customerId','managedEntityId','caseId','resourceReservationId']) {
    assert(typeof appointment[key] === 'string', `${key} missing from workflow result`);
  }
  const pool = new Pool({ connectionString: loadRuntimeConfig().postgresUrl });
  try {
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
    assert(row, 'persistence graph missing');
    assert(row.business_slug === businessSlug, 'business scope mismatch');
    assert(row.customer_id === row.case_customer_id, 'Case customer mismatch');
    assert(row.reservation_status === 'BOOKED', 'ResourceReservation is not BOOKED');
    assert(row.ingress_status === 'COMPLETED', 'CTA ingress is not COMPLETED');
    assert(row.ingress_workflow_id === workflowId, 'ingress workflow mismatch');
    assert(row.ingress_case_id === appointment.caseId, 'ingress Case mismatch');
    assert(row.ingress_appointment_id === appointment.appointmentId, 'ingress Appointment mismatch');
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

  const failureToken = randomUUID();
  const failed = await drive(`api:conversation:${failureToken}`, failureToken, true);
  assert(record(failed.failure).code || failed.workflowStatus === 'FAILED', 'failure projection missing');
  const pool = new Pool({ connectionString: loadRuntimeConfig().postgresUrl });
  try {
    const released = await pool.query<{ status: string; release_reason: string }>(
      `SELECT status,release_reason FROM resource_reservations WHERE workflow_id=$1`, [failed.workflowId],
    );
    assert(released.rows[0]?.status === 'RELEASED', 'failed Appointment did not release HELD capacity');
  } finally { await pool.end(); }

  console.log(`CTA_ORCHESTRATION_POC_PASS ${JSON.stringify({
    workflowId, appointmentId: completedResult.appointmentId, caseId: completedResult.caseId,
    resourceReservationId: completedResult.resourceReservationId,
  })}`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exitCode = 1;
});
