const baseUrl = process.env.ENGINES_CTA_URL ?? 'http://127.0.0.1:8787';

type JsonRecord = Record<string, unknown>;

function record(value: unknown): JsonRecord | undefined {
  return value && typeof value === 'object' ? value as JsonRecord : undefined;
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`PHONE_SLOT_CERT_ASSERTION_FAILED:${message}`);
}

async function json(path: string, init?: RequestInit): Promise<JsonRecord> {
  const response = await fetch(`${baseUrl}${path}`, init);
  const payload = await response.json() as unknown;
  const body = record(payload) ?? {};
  if (!response.ok) throw new Error(`HTTP_${response.status}:${JSON.stringify(body)}`);
  return body;
}

async function trace(workflowId: string): Promise<JsonRecord> {
  const body = await json(`/mk0/executions/${encodeURIComponent(workflowId)}/trace`);
  const value = record(body.trace);
  assert(value, 'trace missing');
  return value;
}

function workflow(traceValue: JsonRecord): JsonRecord {
  return record(traceValue.workflow) ?? {};
}

function contact(traceValue: JsonRecord): JsonRecord {
  const conversation = record(traceValue.conversation) ?? {};
  const currentDraft = record(conversation.currentDraft) ?? {};
  const customer = record(currentDraft.customer) ?? {};
  return record(customer.contact) ?? {};
}

function phones(traceValue: JsonRecord): JsonRecord[] {
  const values = contact(traceValue).phones;
  return Array.isArray(values) ? values.map((phone) => ({ ...(record(phone) ?? {}) })) : [];
}

async function waitFor(
  workflowId: string,
  predicate: (value: JsonRecord) => boolean,
  label: string,
  timeoutMs = 12_000,
): Promise<JsonRecord> {
  const deadline = Date.now() + timeoutMs;
  let last: JsonRecord | undefined;
  while (Date.now() < deadline) {
    last = await trace(workflowId);
    if (predicate(last)) return last;
    await new Promise((resolve) => setTimeout(resolve, 120));
  }
  throw new Error(`PHONE_SLOT_CERT_TIMEOUT:${label}:${JSON.stringify(last)}`);
}

async function update(workflowId: string, inputId: string, customerPatch: JsonRecord): Promise<void> {
  const body = await json(`/mk0/register-new-customer/${encodeURIComponent(workflowId)}/customer-data`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ inputId, customerPatch }),
  });
  const result = record(body.result) ?? {};
  assert(result.ok === true, `update rejected ${inputId}: ${JSON.stringify(result)}`);
}

async function finalize(workflowId: string, inputId: string): Promise<void> {
  const body = await json(`/mk0/register-new-customer/${encodeURIComponent(workflowId)}/finalize`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ inputId }),
  });
  const result = record(body.result) ?? {};
  assert(result.ok === true, `finalize rejected: ${JSON.stringify(result)}`);
}

function assertPhoneOrder(values: readonly JsonRecord[], expected: readonly string[], label: string): void {
  assert(values.length === expected.length, `${label} length expected ${expected.length}, got ${values.length}`);
  expected.forEach((number, index) => {
    assert(values[index]?.normalized === number, `${label} phone[${index + 1}] expected ${number}, got ${String(values[index]?.normalized)}`);
  });
}

async function main(): Promise<void> {
  const token = Date.now().toString();
  const start = await json('/mk0/register-new-customer', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      businessSlug: 'golden-business',
      idempotencyKey: `phone-slot-${token}`,
      correlationId: `phone-slot-${token}`,
      completionMode: 'EXPLICIT_FINALIZE',
      draft: { customer: {} },
    }),
  });

  assert(start.status === 'WORKFLOW_ACCEPTED', 'workflow was not accepted');
  assert(typeof start.workflowId === 'string', 'workflowId missing');
  const workflowId = start.workflowId;

  await update(workflowId, `name-${token}`, { name: 'Ronald Slot Proof' });

  const firstPhone: JsonRecord = {
    number: '933075200',
    normalized: '933075200',
    primary: true,
  };
  await update(workflowId, `phone-1-${token}`, { contact: { phones: [firstPhone] } });
  let current = await waitFor(
    workflowId,
    (value) => workflow(value).phase === 'READY_TO_FINALIZE' && phones(value).length === 1,
    'first phone ready',
  );
  assertPhoneOrder(phones(current), ['933075200'], 'durable draft after phone[1]');

  // Mirror Lab Console behavior: read the durable array, append slot 2, then
  // submit the whole phone collection as one Customer patch.
  const afterFirst = phones(current);
  afterFirst[1] = { number: '2831400', normalized: '2831400' };
  await update(workflowId, `phone-2-${token}`, { contact: { phones: afterFirst } });
  current = await waitFor(workflowId, (value) => phones(value).length === 2, 'second phone visible');
  assertPhoneOrder(phones(current), ['933075200', '2831400'], 'durable draft after phone[2]');

  // Read the durable array again and replace only slot 2. If normalization had
  // silently canonical-sorted by number, this step would mutate the wrong slot.
  const beforeReplace = phones(current);
  beforeReplace[1] = { ...beforeReplace[1], number: '2831500', normalized: '2831500' };
  await update(workflowId, `phone-2-replace-${token}`, { contact: { phones: beforeReplace } });
  current = await waitFor(
    workflowId,
    (value) => phones(value)[1]?.normalized === '2831500',
    'second phone replacement visible',
  );
  assertPhoneOrder(phones(current), ['933075200', '2831500'], 'durable draft after replacing phone[2]');
  assert(workflow(current).phase === 'READY_TO_FINALIZE', 'slot edits must not auto-finalize explicit session');

  await finalize(workflowId, `finish-${token}`);
  current = await waitFor(
    workflowId,
    (value) => workflow(value).workflowStatus === 'COMPLETED' && workflow(value).phase === 'CREATED',
    'completed created',
  );
  assertPhoneOrder(phones(current), ['933075200', '2831500'], 'final durable draft');

  const postgres = record(current.postgres) ?? {};
  const snapshot = record(postgres.snapshot) ?? {};
  const customer = record(snapshot.customer) ?? {};
  const persistedPhones = Array.isArray(customer.phones)
    ? customer.phones.map((phone) => ({ ...(record(phone) ?? {}) }))
    : [];
  assertPhoneOrder(persistedPhones, ['933075200', '2831500'], 'PostgreSQL phone_index order');
  assert(persistedPhones[0]?.primary === true, 'phone[1] must remain primary');

  console.log(`TRACE_PHONE_SLOT_ORDER_PASS ${JSON.stringify({
    workflowId,
    durableOrder: phones(current).map((phone) => phone.normalized),
    postgresOrder: persistedPhones.map((phone) => phone.normalized),
  })}`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exitCode = 1;
});
