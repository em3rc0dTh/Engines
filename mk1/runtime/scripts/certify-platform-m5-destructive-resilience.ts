import { readFile, writeFile } from 'node:fs/promises';
import { Pool } from 'pg';

const baseUrl = (process.env.ENGINES_WEBCHAT_URL ?? 'http://127.0.0.1:8790').replace(/\/$/, '');
const postgresUrl = process.env.POSTGRES_URL ?? 'postgresql://engines:engines@127.0.0.1:5432/engines_mk0';
const stateFile = process.env.M5_STATE_FILE ?? '/tmp/engines-platform-m5-state.json';
const phase = process.env.M5_PHASE ?? 'prepare';
const businessSlug = 'golden-business';

type JsonRecord = Record<string, unknown>;
type HttpResult = Readonly<{ status: number; body: JsonRecord }>;
type SavedState = {
  conversationId: string;
  workflowId: string;
  email: string;
  productId: string;
  productMessageId: string;
  dateInput: string;
  dateMessageId: string;
  slotStart?: string;
  slotMessageId?: string;
  finalizeMessageId: string;
};

function record(value: unknown): JsonRecord | undefined {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as JsonRecord : undefined;
}
function list(value: unknown): JsonRecord[] {
  return Array.isArray(value) ? value.map((item) => record(item) ?? {}) : [];
}
function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`PLATFORM_M5_ASSERTION_FAILED:${message}`);
}
async function request(path: string, init?: RequestInit): Promise<HttpResult> {
  const response = await fetch(`${baseUrl}${path}`, init);
  let raw: unknown = {};
  try { raw = await response.json(); } catch { raw = {}; }
  return { status: response.status, body: record(raw) ?? {} };
}
async function json(path: string): Promise<JsonRecord> {
  const response = await request(path);
  assert(response.status >= 200 && response.status < 300, `HTTP_${response.status}:${JSON.stringify(response.body)}`);
  return response.body;
}
async function postEvent(conversationId: string, messageId: string, operation: string, data: JsonRecord = {}): Promise<JsonRecord> {
  const response = await request('/api/channel/events', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ conversationId, messageId, senderId: 'platform-m5-certification', operation, data }),
  });
  assert(response.status >= 200 && response.status < 300, `${operation} status=${response.status} body=${JSON.stringify(response.body)}`);
  assert(response.body.ok === true, `${operation} not ok`);
  return response.body;
}
function durable(body: JsonRecord): JsonRecord {
  return record(body.state) ?? {};
}
async function conversationView(conversationId: string): Promise<JsonRecord> {
  return json(`/api/channel/conversations/${encodeURIComponent(conversationId)}/view`);
}
async function waitFor(conversationId: string, predicate: (state: JsonRecord) => boolean, label: string, timeoutMs = 45_000): Promise<JsonRecord> {
  const deadline = Date.now() + timeoutMs;
  let last: JsonRecord | undefined;
  while (Date.now() < deadline) {
    try {
      last = await conversationView(conversationId);
      if (predicate(durable(last))) return last;
    } catch {
      // Outage/reconnect windows are intentional in M5.
    }
    await new Promise((resolve) => setTimeout(resolve, 180));
  }
  throw new Error(`PLATFORM_M5_TIMEOUT:${label}:${JSON.stringify(last)}`);
}
function futureBusinessDate(daysAhead = 2): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Lima', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date(Date.now() + daysAhead * 24 * 60 * 60 * 1000));
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value ?? '';
  return `${part('year')}-${part('month')}-${part('day')}`;
}
async function save(value: SavedState): Promise<void> {
  await writeFile(stateFile, JSON.stringify(value), 'utf8');
}
async function load(): Promise<SavedState> {
  return JSON.parse(await readFile(stateFile, 'utf8')) as SavedState;
}
async function count(pool: Pool, sql: string, params: unknown[]): Promise<number> {
  const result = await pool.query<{ count: string }>(sql, params);
  return Number(result.rows[0]?.count ?? 0);
}

async function prepare(): Promise<void> {
  const health = await json('/health');
  assert(health.ok === true && health.channelCore === true, 'WebChat/channel health not ready');

  const token = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const conversationId = `m5-conversation-${token}`;
  const email = `m5-${token.replace(/[^a-zA-Z0-9]/g, '')}@example.test`;
  const phone = `9${String(Date.now()).slice(-8)}`;
  const start = await postEvent(conversationId, `m5-start-${token}`, 'START_APPOINTMENT');
  assert(typeof start.workflowId === 'string', 'workflowId missing');
  const workflowId = String(start.workflowId);

  await waitFor(conversationId, (state) => state.phase === 'WAITING_FOR_CUSTOMER', 'WAITING_FOR_CUSTOMER');
  await postEvent(conversationId, `m5-name-${token}`, 'PROVIDE_CUSTOMER', { customerPatch: { name: 'Platform M5 Customer' } });
  await postEvent(conversationId, `m5-email-${token}`, 'PROVIDE_CUSTOMER', { customerPatch: { contact: { email } } });
  await postEvent(conversationId, `m5-phone-${token}`, 'PROVIDE_CUSTOMER', {
    customerPatch: { contact: { phones: [{ number: `+51 ${phone}`, normalized: `51${phone}`, primary: true }] } },
  });
  await postEvent(conversationId, `m5-resolve-${token}`, 'RESOLVE_CUSTOMER');

  let body = await waitFor(conversationId, (state) => state.phase === 'WAITING_FOR_SERVICE', 'WAITING_FOR_SERVICE');
  const services = list(durable(body).services);
  assert(typeof services[0]?.serviceId === 'string', 'services missing');
  await postEvent(conversationId, `m5-service-${token}`, 'SELECT_SERVICE', { serviceId: services[0]!.serviceId });

  body = await waitFor(conversationId, (state) => state.phase === 'WAITING_FOR_PRODUCT', 'WAITING_FOR_PRODUCT');
  const products = list(durable(body).products);
  assert(typeof products[0]?.productId === 'string', 'products missing');

  const saved: SavedState = {
    conversationId,
    workflowId,
    email,
    productId: String(products[0]!.productId),
    productMessageId: `m5-product-${token}`,
    dateInput: futureBusinessDate(2),
    dateMessageId: `m5-date-${token}`,
    finalizeMessageId: `m5-finalize-${token}`,
  };
  await save(saved);
  console.log('PLATFORM_M5_PREPARED_AT_PRODUCT_PASS', JSON.stringify({ workflowId, conversationId }));
}

async function submitProduct(): Promise<void> {
  const saved = await load();
  await postEvent(saved.conversationId, saved.productMessageId, 'SELECT_OFFERING', { productId: saved.productId });
  const body = await waitFor(saved.conversationId, (state) => state.phase === 'WAITING_FOR_DATE', 'WAITING_FOR_DATE_AFTER_WORKER_RECOVERY');
  assert(body.workflowId === saved.workflowId, 'worker recovery changed workflowId');
  console.log('PLATFORM_M5_WORKER_LOSS_RECOVERY_PASS');
}

async function expectDateTransportFailure(): Promise<void> {
  const saved = await load();
  try {
    const response = await request('/api/channel/events', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        conversationId: saved.conversationId,
        messageId: saved.dateMessageId,
        senderId: 'platform-m5-certification',
        operation: 'SET_DATE',
        data: { dateInput: saved.dateInput },
      }),
    });
    assert(response.status >= 500, `channel outage unexpectedly accepted event: ${response.status} ${JSON.stringify(response.body)}`);
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('PLATFORM_M5_ASSERTION_FAILED:')) throw error;
  }
  console.log('PLATFORM_M5_CHANNEL_OUTAGE_OBSERVED_PASS');
}

async function submitDate(): Promise<void> {
  const saved = await load();
  await postEvent(saved.conversationId, saved.dateMessageId, 'SET_DATE', { dateInput: saved.dateInput });
  const body = await waitFor(saved.conversationId, (state) => state.phase === 'WAITING_FOR_SLOT', 'WAITING_FOR_SLOT_AFTER_CHANNEL_RECOVERY');
  assert(body.workflowId === saved.workflowId, 'channel recovery changed workflowId');
  const slots = list(durable(body).availableSlots);
  assert(typeof slots[0]?.start === 'string', 'slots missing after channel recovery');
  saved.slotStart = String(slots[0]!.start);
  saved.slotMessageId = `m5-slot-${Date.now()}`;
  await save(saved);
  console.log('PLATFORM_M5_CHANNEL_CORE_RECOVERY_PASS');
}

async function submitSlot(): Promise<void> {
  const saved = await load();
  assert(saved.slotStart && saved.slotMessageId, 'slot state missing');
  await postEvent(saved.conversationId, saved.slotMessageId, 'SELECT_SLOT', { slotStart: saved.slotStart });
  const body = await waitFor(saved.conversationId, (state) => state.phase === 'READY_TO_FINALIZE', 'READY_TO_FINALIZE_AFTER_POSTGRES_RECOVERY');
  assert(body.workflowId === saved.workflowId, 'PostgreSQL recovery changed workflowId');
  console.log('PLATFORM_M5_POSTGRES_RESTART_RECOVERY_PASS');
}

async function verifyReady(): Promise<void> {
  const saved = await load();
  const body = await waitFor(saved.conversationId, (state) => state.phase === 'READY_TO_FINALIZE', 'READY_AFTER_TEMPORAL_RESTART', 60_000);
  assert(body.workflowId === saved.workflowId, 'Temporal restart changed workflowId');
  const state = durable(body);
  assert(record(state.selectedSlot)?.start === saved.slotStart, 'selected slot lost across Temporal restart');
  console.log('PLATFORM_M5_TEMPORAL_RESTART_RECOVERY_PASS');
}

async function finalize(): Promise<void> {
  const saved = await load();
  const first = await postEvent(saved.conversationId, saved.finalizeMessageId, 'FINALIZE_APPOINTMENT');
  assert(first.replayed === false, 'first finalize unexpectedly replayed');
  const body = await waitFor(
    saved.conversationId,
    (state) => state.phase === 'CREATED' && state.workflowStatus === 'COMPLETED',
    'CREATED_AFTER_DESTRUCTIVE_CAMPAIGN',
    60_000,
  );
  assert(body.workflowId === saved.workflowId, 'terminal workflowId changed');
  const result = record(durable(body).result) ?? {};
  assert(typeof result.appointmentId === 'string', 'appointmentId missing');
  assert(typeof result.schedulerReservationId === 'string', 'schedulerReservationId missing');

  const replay = await postEvent(saved.conversationId, saved.finalizeMessageId, 'FINALIZE_APPOINTMENT');
  assert(replay.replayed === true, 'terminal finalize replay not durable');

  const pool = new Pool({ connectionString: postgresUrl, max: 2 });
  try {
    assert(await count(pool, 'SELECT COUNT(*)::text AS count FROM appointments WHERE workflow_id = $1', [saved.workflowId]) === 1, 'appointment duplicated');
    assert(await count(pool, 'SELECT COUNT(*)::text AS count FROM appointment_commands WHERE workflow_id = $1', [saved.workflowId]) === 1, 'appointment command duplicated');
    assert(await count(pool, 'SELECT COUNT(*)::text AS count FROM scheduler_reservations WHERE reservation_id = $1', [String(result.schedulerReservationId)]) === 1, 'scheduler reservation duplicated');
    assert(await count(pool, 'SELECT COUNT(*)::text AS count FROM channel_conversation_bindings WHERE business_slug = $1 AND channel = $2 AND external_conversation_id = $3 AND workflow_id = $4', [businessSlug, 'WEBCHAT', saved.conversationId, saved.workflowId]) === 1, 'conversation binding duplicated');
    assert(await count(pool, 'SELECT COUNT(*)::text AS count FROM customer_contacts WHERE business_slug = $1 AND email_normalized = $2', [businessSlug, saved.email]) === 1, 'customer identity duplicated');
  } finally {
    await pool.end();
  }
  console.log('PLATFORM_M5_TERMINAL_SINGLE_EFFECT_PASS');
  console.log('PLATFORM_M5_DESTRUCTIVE_RESILIENCE_PASS', JSON.stringify({
    workflowId: saved.workflowId,
    workerLoss: true,
    channelCoreLoss: true,
    postgresRestart: true,
    temporalRestart: true,
    terminalSingleEffect: true,
  }));
}

switch (phase) {
  case 'prepare': await prepare(); break;
  case 'submit-product': await submitProduct(); break;
  case 'expect-date-transport-failure': await expectDateTransportFailure(); break;
  case 'submit-date': await submitDate(); break;
  case 'submit-slot': await submitSlot(); break;
  case 'verify-ready': await verifyReady(); break;
  case 'finalize': await finalize(); break;
  default: throw new Error(`PLATFORM_M5_UNKNOWN_PHASE:${phase}`);
}
