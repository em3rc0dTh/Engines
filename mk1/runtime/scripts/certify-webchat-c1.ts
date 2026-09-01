const baseUrl = (process.env.ENGINES_WEBCHAT_URL ?? 'http://127.0.0.1:8790').replace(/\/$/, '');

type JsonRecord = Record<string, unknown>;

function record(value: unknown): JsonRecord | undefined {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as JsonRecord : undefined;
}

function list(value: unknown): JsonRecord[] {
  return Array.isArray(value) ? value.map((item) => record(item) ?? {}) : [];
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`WEBCHAT_C1_ASSERTION_FAILED:${message}`);
}

async function json(path: string, init?: RequestInit): Promise<JsonRecord> {
  const response = await fetch(`${baseUrl}${path}`, init);
  const raw = await response.json() as unknown;
  const body = record(raw) ?? {};
  if (!response.ok) throw new Error(`WEBCHAT_HTTP_${response.status}:${JSON.stringify(body)}`);
  return body;
}

async function post(path: string, body: JsonRecord): Promise<JsonRecord> {
  return json(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function state(body: JsonRecord): JsonRecord {
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

function token(label: string): string {
  return `c1-${label}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

async function getView(workflowId: string): Promise<JsonRecord> {
  return json(`/api/appointments/${encodeURIComponent(workflowId)}/view`);
}

async function waitFor(workflowId: string, predicate: (durable: JsonRecord) => boolean, label: string): Promise<JsonRecord> {
  const deadline = Date.now() + 20_000;
  let last: JsonRecord | undefined;
  while (Date.now() < deadline) {
    const body = await getView(workflowId);
    last = body;
    if (predicate(state(body))) return body;
    await new Promise((resolve) => setTimeout(resolve, 120));
  }
  throw new Error(`WEBCHAT_C1_TIMEOUT:${label}:${JSON.stringify(last)}`);
}

async function main(): Promise<void> {
  const health = await json('/health');
  assert(health.ok === true, 'WebChat health not ready');
  assert(health.agent === false, 'Agent must not be present');
  assert(health.mcp === false, 'MCP must not be present');

  const chatHtml = await fetch(`${baseUrl}/webchat/`).then((response) => response.text());
  const inspectorHtml = await fetch(`${baseUrl}/webchat/workflow.html`).then((response) => response.text());
  assert(chatHtml.includes('ENGINES · CTA WEBCHAT POC'), 'chat HTML not served');
  assert(inspectorHtml.includes('TEMPORAL WORKFLOW INSPECTOR'), 'inspector HTML not served');

  const startKey = token('start');
  const started = await post('/api/cta/mk0/register-new-appointment', {
    businessSlug: 'golden-business',
    idempotencyKey: startKey,
    correlationId: startKey,
  });
  assert(typeof started.workflowId === 'string', 'workflowId missing');
  const workflowId = String(started.workflowId);

  let body = await waitFor(workflowId, (durable) => durable.phase === 'WAITING_FOR_CUSTOMER', 'WAITING_FOR_CUSTOMER');
  assert(view(body).currentStepId === 'CUSTOMER_NAME', 'first visible capture step must be Customer name');
  assert(step(body, 'WORKFLOW_START').status === 'COMPLETE', 'Workflow start must be complete');

  await post(`/api/cta/mk0/register-new-appointment/${encodeURIComponent(workflowId)}/customer-data`, {
    inputId: token('name'),
    customerPatch: { name: 'WebChat Proof Customer' },
  });
  body = await getView(workflowId);
  assert(step(body, 'CUSTOMER_NAME').status === 'COMPLETE', 'Customer name not visible as complete');
  assert(step(body, 'CUSTOMER_EMAIL').status === 'ACTIVE', 'Customer email not active after name');

  await post(`/api/cta/mk0/register-new-appointment/${encodeURIComponent(workflowId)}/customer-data`, {
    inputId: token('email'),
    customerPatch: { contact: { email: `webchat-${Date.now()}@example.test` } },
  });
  await post(`/api/cta/mk0/register-new-appointment/${encodeURIComponent(workflowId)}/customer-data`, {
    inputId: token('phone'),
    customerPatch: { contact: { phones: [{ number: '+51 999 888 777', normalized: '51999888777', primary: true }] } },
  });
  body = await getView(workflowId);
  assert(step(body, 'CUSTOMER_EMAIL').status === 'COMPLETE', 'Customer email not complete');
  assert(step(body, 'CUSTOMER_PHONE').status === 'COMPLETE', 'Customer phone not complete');
  assert(step(body, 'CUSTOMER_RESOLUTION').status === 'ACTIVE', 'Customer resolution not active');

  await post(`/api/cta/mk0/register-new-appointment/${encodeURIComponent(workflowId)}/resolve-customer`, {
    inputId: token('resolve'),
  });
  body = await waitFor(workflowId, (durable) => durable.phase === 'WAITING_FOR_SERVICE', 'WAITING_FOR_SERVICE');
  assert(step(body, 'CUSTOMER_RESOLUTION').status === 'COMPLETE', 'Customer resolution not complete');
  assert(step(body, 'SERVICE_SELECTION').status === 'ACTIVE', 'Service selection not active');

  const services = list(state(body).services);
  assert(services.length > 0 && typeof services[0]?.serviceId === 'string', 'Services missing');
  await post(`/api/cta/mk0/register-new-appointment/${encodeURIComponent(workflowId)}/service`, {
    inputId: token('service'),
    serviceId: services[0]!.serviceId,
  });

  body = await waitFor(workflowId, (durable) => durable.phase === 'WAITING_FOR_PRODUCT', 'WAITING_FOR_PRODUCT');
  const products = list(state(body).products);
  assert(products.length > 0 && typeof products[0]?.productId === 'string', 'Offerings missing');
  assert(step(body, 'SERVICE_SELECTION').status === 'COMPLETE', 'Service selection not complete');
  assert(step(body, 'OFFERING_SELECTION').status === 'ACTIVE', 'Offering selection not active');

  await post(`/api/cta/mk0/register-new-appointment/${encodeURIComponent(workflowId)}/product`, {
    inputId: token('product'),
    productId: products[0]!.productId,
  });
  body = await waitFor(workflowId, (durable) => durable.phase === 'WAITING_FOR_DATE', 'WAITING_FOR_DATE');
  assert(step(body, 'OFFERING_SELECTION').status === 'COMPLETE', 'Offering selection not complete');
  assert(step(body, 'DATE_SELECTION').status === 'ACTIVE', 'Date selection not active');

  await post(`/api/cta/mk0/register-new-appointment/${encodeURIComponent(workflowId)}/date`, {
    inputId: token('date'),
    dateInput: 'viernes',
  });
  body = await waitFor(workflowId, (durable) => durable.phase === 'WAITING_FOR_SLOT', 'WAITING_FOR_SLOT');
  const slots = list(state(body).availableSlots);
  assert(slots.length > 0 && typeof slots[0]?.start === 'string', 'Slots missing');
  assert(step(body, 'DATE_SELECTION').status === 'COMPLETE', 'Date selection not complete');
  assert(step(body, 'SLOTS_LOADING').status === 'COMPLETE', 'Slots loading not complete');
  assert(step(body, 'SLOT_SELECTION').status === 'ACTIVE', 'Slot selection not active');

  const chosen = slots[Math.min(1, slots.length - 1)]!;
  await post(`/api/cta/mk0/register-new-appointment/${encodeURIComponent(workflowId)}/slot`, {
    inputId: token('slot'),
    slotStart: chosen.start,
  });
  body = await waitFor(workflowId, (durable) => durable.phase === 'READY_TO_FINALIZE', 'READY_TO_FINALIZE');
  assert(step(body, 'SLOT_SELECTION').status === 'COMPLETE', 'Slot selection not complete');
  assert(step(body, 'FINALIZE_APPOINTMENT').status === 'ACTIVE', 'Finalize not active');

  await post(`/api/cta/mk0/register-new-appointment/${encodeURIComponent(workflowId)}/finalize`, {
    inputId: token('finalize'),
  });
  body = await waitFor(workflowId, (durable) => durable.phase === 'CREATED' && durable.workflowStatus === 'COMPLETED', 'CREATED');
  assert(step(body, 'FINALIZE_APPOINTMENT').status === 'COMPLETE', 'Finalize not complete');
  assert(step(body, 'APPOINTMENT_CREATED').status === 'COMPLETE', 'Created step not complete');
  assert(view(body).currentStepId === 'APPOINTMENT_CREATED', 'terminal current step mismatch');

  console.log('WEBCHAT_C1_WORKFLOW_VISIBILITY_PASS', JSON.stringify({
    workflowId,
    runId: body.runId,
    finalPhase: state(body).phase,
    steps: list(view(body).steps).map((item) => `${String(item.number)}:${String(item.id)}:${String(item.status)}`),
    agent: false,
    mcp: false,
  }));
}

main().catch((error: unknown) => {
  console.error(`WEBCHAT_C1_WORKFLOW_VISIBILITY_FAILED ${error instanceof Error ? error.stack ?? error.message : String(error)}`);
  process.exitCode = 1;
});
