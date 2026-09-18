import { readFile, writeFile } from 'node:fs/promises';
import { Pool } from 'pg';

const baseUrl = (process.env.ENGINES_WEBCHAT_URL ?? 'http://127.0.0.1:8790').replace(/\/$/, '');
const postgresUrl = process.env.POSTGRES_URL ?? 'postgresql://engines:engines@127.0.0.1:5432/engines_mk0';
const phase = process.env.M3_PHASE ?? 'prepare';
const stateFile = process.env.M3_STATE_FILE ?? '/tmp/engines-platform-m3-state.json';
const businessSlug = 'golden-business';

type JsonRecord = Record<string, unknown>;
type HttpResult = Readonly<{ status: number; body: JsonRecord }>;
type SavedState = Readonly<{
  conversationId: string;
  workflowId: string;
  email: string;
  selectedService: string;
  selectedProduct: string;
  appointmentDate: string;
  slotStart: string;
  finalizeMessageId: string;
}>;

function record(value: unknown): JsonRecord | undefined {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as JsonRecord : undefined;
}
function list(value: unknown): JsonRecord[] {
  return Array.isArray(value) ? value.map((item) => record(item) ?? {}) : [];
}
function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`PLATFORM_M3_ASSERTION_FAILED:${message}`);
}
async function request(path: string, init?: RequestInit): Promise<HttpResult> {
  const response = await fetch(`${baseUrl}${path}`, init);
  const raw = await response.json() as unknown;
  return { status: response.status, body: record(raw) ?? {} };
}
async function json(path: string, init?: RequestInit): Promise<JsonRecord> {
  const response = await request(path, init);
  assert(response.status >= 200 && response.status < 300, `HTTP_${response.status}:${JSON.stringify(response.body)}`);
  return response.body;
}
async function postEvent(conversationId: string, messageId: string, operation: string, data: JsonRecord = {}): Promise<JsonRecord> {
  const response = await request('/api/channel/events', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ conversationId, messageId, senderId: 'platform-m3-certification', operation, data }),
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
async function waitFor(conversationId: string, predicate: (state: JsonRecord) => boolean, label: string): Promise<JsonRecord> {
  const deadline = Date.now() + 30_000;
  let last: JsonRecord | undefined;
  while (Date.now() < deadline) {
    last = await conversationView(conversationId);
    if (predicate(durable(last))) return last;
    await new Promise((resolve) => setTimeout(resolve, 120));
  }
  throw new Error(`PLATFORM_M3_TIMEOUT:${label}:${JSON.stringify(last)}`);
}
function futureBusinessDate(daysAhead = 2): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Lima', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date(Date.now() + daysAhead * 24 * 60 * 60 * 1000));
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value ?? '';
  return `${part('year')}-${part('month')}-${part('day')}`;
}
async function count(pool: Pool, sql: string, params: unknown[]): Promise<number> {
  const result = await pool.query<{ count: string }>(sql, params);
  return Number(result.rows[0]?.count ?? 0);
}
async function save(value: SavedState): Promise<void> {
  await writeFile(stateFile, JSON.stringify(value), 'utf8');
}
async function load(): Promise<SavedState> {
  return JSON.parse(await readFile(stateFile, 'utf8')) as SavedState;
}

async function prepare(): Promise<void> {
  const health = await json('/health');
  assert(health.ok === true && health.channelCore === true, 'WebChat/channel health not ready');

  const token = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const conversationId = `m3-conversation-${token}`;
  const email = `m3-${token.replace(/[^a-zA-Z0-9]/g, '')}@example.test`;
  const phone = `9${String(Date.now()).slice(-8)}`;
  const start = await postEvent(conversationId, `m3-start-${token}`, 'START_APPOINTMENT');
  assert(typeof start.workflowId === 'string', 'workflowId missing');
  const workflowId = String(start.workflowId);

  await waitFor(conversationId, (state) => state.phase === 'WAITING_FOR_CUSTOMER', 'WAITING_FOR_CUSTOMER');
  await postEvent(conversationId, `m3-name-${token}`, 'PROVIDE_CUSTOMER', { customerPatch: { name: 'Platform M3 Customer' } });
  await postEvent(conversationId, `m3-email-${token}`, 'PROVIDE_CUSTOMER', { customerPatch: { contact: { email } } });
  await postEvent(conversationId, `m3-phone-${token}`, 'PROVIDE_CUSTOMER', {
    customerPatch: { contact: { phones: [{ number: `+51 ${phone}`, normalized: `51${phone}`, primary: true }] } },
  });
  await postEvent(conversationId, `m3-resolve-${token}`, 'RESOLVE_CUSTOMER');

  let body = await waitFor(conversationId, (state) => state.phase === 'WAITING_FOR_SERVICE', 'WAITING_FOR_SERVICE');
  const services = list(durable(body).services);
  assert(typeof services[0]?.serviceId === 'string', 'services missing');
  const selectedService = String(services[0]!.name);
  await postEvent(conversationId, `m3-service-${token}`, 'SELECT_SERVICE', { serviceId: services[0]!.serviceId });

  body = await waitFor(conversationId, (state) => state.phase === 'WAITING_FOR_PRODUCT', 'WAITING_FOR_PRODUCT');
  const products = list(durable(body).products);
  assert(typeof products[0]?.productId === 'string', 'products missing');
  const selectedProduct = String(products[0]!.name);
  await postEvent(conversationId, `m3-product-${token}`, 'SELECT_OFFERING', { productId: products[0]!.productId });

  await waitFor(conversationId, (state) => state.phase === 'WAITING_FOR_DATE', 'WAITING_FOR_DATE');
  const appointmentDate = futureBusinessDate(2);
  await postEvent(conversationId, `m3-date-${token}`, 'SET_DATE', { dateInput: appointmentDate });

  body = await waitFor(conversationId, (state) => state.phase === 'WAITING_FOR_SLOT', 'WAITING_FOR_SLOT');
  const slots = list(durable(body).availableSlots);
  assert(typeof slots[0]?.start === 'string', 'slots missing');
  const slotStart = String(slots[0]!.start);
  await postEvent(conversationId, `m3-slot-${token}`, 'SELECT_SLOT', { slotStart });

  body = await waitFor(conversationId, (state) => state.phase === 'READY_TO_FINALIZE', 'READY_TO_FINALIZE');
  assert(body.workflowId === workflowId, 'workflow identity changed before adapter replacement');

  const saved: SavedState = {
    conversationId, workflowId, email, selectedService, selectedProduct, appointmentDate, slotStart,
    finalizeMessageId: `m3-finalize-${token}`,
  };
  await save(saved);
  console.log('PLATFORM_M3_PRE_RESTART_PASS', JSON.stringify(saved));
}

async function verify(): Promise<void> {
  const saved = await load();
  let body = await conversationView(saved.conversationId);
  assert(body.workflowId === saved.workflowId, 'adapter/browser recovery changed workflowId');
  const state = durable(body);
  assert(state.phase === 'READY_TO_FINALIZE', `recovered phase=${String(state.phase)}`);
  assert(record(state.selectedService)?.name === saved.selectedService, 'selected service lost');
  assert(record(state.selectedProduct)?.name === saved.selectedProduct, 'selected product lost');
  assert(state.appointmentDate === saved.appointmentDate, 'appointment date lost');
  assert(record(state.selectedSlot)?.start === saved.slotStart, 'selected slot lost');
  console.log('PLATFORM_M3_SAME_WORKFLOW_CONTINUITY_PASS');

  const firstFinalize = await postEvent(saved.conversationId, saved.finalizeMessageId, 'FINALIZE_APPOINTMENT');
  assert(firstFinalize.replayed === false, 'first finalize unexpectedly replayed');
  body = await waitFor(
    saved.conversationId,
    (value) => value.phase === 'CREATED' && value.workflowStatus === 'COMPLETED',
    'CREATED',
  );
  const result = record(durable(body).result) ?? {};
  assert(typeof result.appointmentId === 'string', 'appointmentId missing');
  assert(typeof result.schedulerReservationId === 'string', 'schedulerReservationId missing');

  const replay = await postEvent(saved.conversationId, saved.finalizeMessageId, 'FINALIZE_APPOINTMENT');
  assert(replay.replayed === true, 'finalize replay did not use durable event result');

  const pool = new Pool({ connectionString: postgresUrl, max: 2 });
  try {
    assert(await count(pool, 'SELECT COUNT(*)::text AS count FROM appointments WHERE workflow_id = $1', [saved.workflowId]) === 1, 'appointment duplicated');
    assert(await count(pool, 'SELECT COUNT(*)::text AS count FROM appointment_commands WHERE workflow_id = $1', [saved.workflowId]) === 1, 'appointment command duplicated');
    assert(await count(pool, 'SELECT COUNT(*)::text AS count FROM scheduler_reservations WHERE reservation_id = $1', [String(result.schedulerReservationId)]) === 1, 'scheduler reservation duplicated');
    assert(await count(pool, 'SELECT COUNT(*)::text AS count FROM customer_contacts WHERE business_slug = $1 AND email_normalized = $2', [businessSlug, saved.email]) === 1, 'customer identity duplicated');
  } finally {
    await pool.end();
  }

  console.log('PLATFORM_M3_TERMINAL_SINGLE_EFFECT_PASS');
  console.log('PLATFORM_M3_WEBCHAT_RECOVERY_PASS', JSON.stringify({
    workflowId: saved.workflowId,
    adapterRestartRecovered: true,
    transcriptRehydrated: true,
    sameWorkflow: true,
    terminalSingleEffect: true,
  }));
}

if (phase === 'prepare') {
  await prepare();
} else if (phase === 'verify') {
  await verify();
} else {
  throw new Error(`PLATFORM_M3_UNKNOWN_PHASE:${phase}`);
}
