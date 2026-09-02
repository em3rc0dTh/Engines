import { readFile, writeFile } from 'node:fs/promises';

const baseUrl = (process.env.ENGINES_WEBCHAT_URL ?? 'http://127.0.0.1:8790').replace(/\/$/, '');
const phase = process.env.C1B_PHASE ?? 'full';
const stateFile = process.env.C1B_STATE_FILE ?? '/tmp/engines-c1b-state.json';

type JsonRecord = Record<string, unknown>;

type SavedState = Readonly<{
  conversationId: string;
  workflowId: string;
}>;

function record(value: unknown): JsonRecord | undefined {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as JsonRecord : undefined;
}

function list(value: unknown): JsonRecord[] {
  return Array.isArray(value) ? value.map((item) => record(item) ?? {}) : [];
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`WEBCHAT_C1B_ASSERTION_FAILED:${message}`);
}

async function request(path: string, init?: RequestInit): Promise<Readonly<{ status: number; body: JsonRecord }>> {
  const response = await fetch(`${baseUrl}${path}`, init);
  const raw = await response.json() as unknown;
  return { status: response.status, body: record(raw) ?? {} };
}

async function json(path: string, init?: RequestInit): Promise<JsonRecord> {
  const response = await request(path, init);
  if (response.status < 200 || response.status >= 300) {
    throw new Error(`WEBCHAT_C1B_HTTP_${response.status}:${JSON.stringify(response.body)}`);
  }
  return response.body;
}

async function postEvent(
  conversationId: string,
  messageId: string,
  operation: string,
  data: JsonRecord = {},
): Promise<Readonly<{ status: number; body: JsonRecord }>> {
  return request('/api/channel/events', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      conversationId,
      messageId,
      senderId: 'c1b-certification',
      operation,
      data,
    }),
  });
}

function durable(body: JsonRecord): JsonRecord {
  return record(body.state) ?? {};
}

function view(body: JsonRecord): JsonRecord {
  return record(body.view) ?? {};
}

function step(body: JsonRecord, id: string): JsonRecord {
  const match = list(view(body).steps).find((item) => item.id === id);
  assert(match, `step ${id} missing`);
  return match;
}

async function conversationView(conversationId: string): Promise<JsonRecord> {
  return json(`/api/channel/conversations/${encodeURIComponent(conversationId)}/view`);
}

async function waitFor(
  conversationId: string,
  predicate: (state: JsonRecord) => boolean,
  label: string,
): Promise<JsonRecord> {
  const deadline = Date.now() + 25_000;
  let last: JsonRecord | undefined;
  while (Date.now() < deadline) {
    const body = await conversationView(conversationId);
    last = body;
    if (predicate(durable(body))) return body;
    await new Promise((resolve) => setTimeout(resolve, 120));
  }
  throw new Error(`WEBCHAT_C1B_TIMEOUT:${label}:${JSON.stringify(last)}`);
}

function success(response: Readonly<{ status: number; body: JsonRecord }>, label: string): JsonRecord {
  assert(response.status >= 200 && response.status < 300, `${label} status=${response.status} body=${JSON.stringify(response.body)}`);
  assert(response.body.ok === true, `${label} not ok`);
  return response.body;
}

async function prepare(): Promise<SavedState> {
  const health = await json('/health');
  assert(health.ok === true, 'WebChat/channel health not ready');
  assert(health.channelCore === true, 'durable channel core not ready');
  assert(health.agent === false, 'Agent must not be present');
  assert(health.mcp === false, 'MCP must not be present');

  const conversationId = `c1b-conversation-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const start = success(await postEvent(conversationId, 'c1b-start-001', 'START_APPOINTMENT'), 'start');
  assert(start.replayed === false, 'first start cannot be replay');
  assert(typeof start.workflowId === 'string', 'start workflowId missing');
  const workflowId = String(start.workflowId);

  const replayStart = success(await postEvent(conversationId, 'c1b-start-001', 'START_APPOINTMENT'), 'start replay');
  assert(replayStart.replayed === true, 'exact start replay not identified');
  assert(replayStart.workflowId === workflowId, 'exact start replay changed workflowId');

  let body = await waitFor(conversationId, (value) => value.phase === 'WAITING_FOR_CUSTOMER', 'WAITING_FOR_CUSTOMER');
  assert(body.workflowId === workflowId, 'binding query workflow mismatch');
  assert(step(body, 'WORKFLOW_START').status === 'COMPLETE', 'workflow start step incomplete');

  const nameEvent = await postEvent(conversationId, 'c1b-name-001', 'PROVIDE_CUSTOMER', {
    customerPatch: { name: 'C1B Durable Customer' },
  });
  success(nameEvent, 'name');
  const replayName = success(await postEvent(conversationId, 'c1b-name-001', 'PROVIDE_CUSTOMER', {
    customerPatch: { name: 'C1B Durable Customer' },
  }), 'name replay');
  assert(replayName.replayed === true, 'exact update replay not identified');

  body = await conversationView(conversationId);
  const nameBeforeConflict = record(record(durable(body).customer)?.customer)?.name;
  assert(nameBeforeConflict === 'C1B Durable Customer', 'name missing before conflict');

  const conflict = await postEvent(conversationId, 'c1b-name-001', 'PROVIDE_CUSTOMER', {
    customerPatch: { name: 'MATERIAL CONFLICT MUST NOT APPLY' },
  });
  assert(conflict.status === 409, `material conflict status ${conflict.status}`);
  assert(conflict.body.code === 'CHANNEL_EVENT_IDENTITY_CONFLICT', 'material conflict code mismatch');

  body = await conversationView(conversationId);
  const nameAfterConflict = record(record(durable(body).customer)?.customer)?.name;
  assert(nameAfterConflict === nameBeforeConflict, 'conflicting material mutated Workflow state');

  const saved = { conversationId, workflowId };
  await writeFile(stateFile, JSON.stringify(saved), 'utf8');
  console.log('WEBCHAT_C1B_PRE_RESTART_PASS', JSON.stringify({
    conversationId,
    workflowId,
    exactStartReplay: true,
    exactUpdateReplay: true,
    materialConflictRejected: true,
    conflictMutationFree: true,
    agent: false,
    mcp: false,
  }));
  return saved;
}

async function loadSaved(): Promise<SavedState> {
  const raw = JSON.parse(await readFile(stateFile, 'utf8')) as unknown;
  const body = record(raw) ?? {};
  assert(typeof body.conversationId === 'string', 'saved conversationId missing');
  assert(typeof body.workflowId === 'string', 'saved workflowId missing');
  return { conversationId: body.conversationId, workflowId: body.workflowId };
}

async function complete(saved: SavedState): Promise<void> {
  const health = await json('/health');
  assert(health.ok === true && health.channelCore === true, 'post-restart channel health not ready');

  let body = await conversationView(saved.conversationId);
  assert(body.workflowId === saved.workflowId, 'adapter restart lost durable Workflow binding');
  assert(record(record(durable(body).customer)?.customer)?.name === 'C1B Durable Customer', 'durable Customer draft lost after restart');

  success(await postEvent(saved.conversationId, 'c1b-email-001', 'PROVIDE_CUSTOMER', {
    customerPatch: { contact: { email: `c1b-${Date.now()}@example.test` } },
  }), 'email');
  success(await postEvent(saved.conversationId, 'c1b-phone-001', 'PROVIDE_CUSTOMER', {
    customerPatch: { contact: { phones: [{ number: '+51 999 777 666', normalized: '51999777666', primary: true }] } },
  }), 'phone');
  success(await postEvent(saved.conversationId, 'c1b-resolve-001', 'RESOLVE_CUSTOMER'), 'resolve');

  body = await waitFor(saved.conversationId, (value) => value.phase === 'WAITING_FOR_SERVICE', 'WAITING_FOR_SERVICE');
  const services = list(durable(body).services);
  assert(typeof services[0]?.serviceId === 'string', 'services missing');
  success(await postEvent(saved.conversationId, 'c1b-service-001', 'SELECT_SERVICE', {
    serviceId: services[0]!.serviceId,
  }), 'service');

  body = await waitFor(saved.conversationId, (value) => value.phase === 'WAITING_FOR_PRODUCT', 'WAITING_FOR_PRODUCT');
  const products = list(durable(body).products);
  assert(typeof products[0]?.productId === 'string', 'offerings missing');
  success(await postEvent(saved.conversationId, 'c1b-offering-001', 'SELECT_OFFERING', {
    productId: products[0]!.productId,
  }), 'offering');

  await waitFor(saved.conversationId, (value) => value.phase === 'WAITING_FOR_DATE', 'WAITING_FOR_DATE');
  success(await postEvent(saved.conversationId, 'c1b-date-001', 'SET_DATE', { dateInput: 'viernes' }), 'date');

  body = await waitFor(saved.conversationId, (value) => value.phase === 'WAITING_FOR_SLOT', 'WAITING_FOR_SLOT');
  const slots = list(durable(body).availableSlots);
  assert(typeof slots[0]?.start === 'string', 'slots missing');
  const chosen = slots[Math.min(1, slots.length - 1)]!;
  success(await postEvent(saved.conversationId, 'c1b-slot-001', 'SELECT_SLOT', { slotStart: chosen.start }), 'slot');

  await waitFor(saved.conversationId, (value) => value.phase === 'READY_TO_FINALIZE', 'READY_TO_FINALIZE');
  const finalize = success(await postEvent(saved.conversationId, 'c1b-finalize-001', 'FINALIZE_APPOINTMENT'), 'finalize');
  assert(finalize.replayed === false, 'first finalize cannot be replay');

  body = await waitFor(saved.conversationId, (value) => value.phase === 'CREATED' && value.workflowStatus === 'COMPLETED', 'CREATED');
  assert(body.workflowId === saved.workflowId, 'terminal workflowId changed');
  assert(step(body, 'APPOINTMENT_CREATED').status === 'COMPLETE', 'terminal visible step incomplete');
  assert(Array.isArray(durable(body).issues) && (durable(body).issues as unknown[]).length === 0, 'terminal issues present');

  const replayFinalize = success(await postEvent(saved.conversationId, 'c1b-finalize-001', 'FINALIZE_APPOINTMENT'), 'finalize replay');
  assert(replayFinalize.replayed === true, 'terminal exact replay not served from durable event result');
  assert(replayFinalize.workflowId === saved.workflowId, 'terminal replay workflow mismatch');

  console.log('WEBCHAT_C1B_DURABLE_CHANNEL_PASS', JSON.stringify({
    conversationId: saved.conversationId,
    workflowId: saved.workflowId,
    finalPhase: durable(body).phase,
    workflowStatus: durable(body).workflowStatus,
    allVisibleStepsComplete: list(view(body).steps).every((item) => item.status === 'COMPLETE'),
    bindingRecoveredAfterAdapterRestart: true,
    exactStartReplay: true,
    exactUpdateReplay: true,
    materialConflictRejected: true,
    conflictMutationFree: true,
    terminalReplayFromDurableLedger: true,
    agent: false,
    mcp: false,
  }));
}

async function main(): Promise<void> {
  if (phase === 'prepare') {
    await prepare();
    return;
  }
  if (phase === 'complete') {
    await complete(await loadSaved());
    return;
  }
  const saved = await prepare();
  await complete(saved);
}

main().catch((error: unknown) => {
  console.error(`WEBCHAT_C1B_DURABLE_CHANNEL_FAILED ${error instanceof Error ? error.stack ?? error.message : String(error)}`);
  process.exitCode = 1;
});
