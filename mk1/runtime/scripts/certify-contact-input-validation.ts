const baseUrl = process.env.ENGINES_CTA_URL ?? 'http://127.0.0.1:8787';

type JsonRecord = Record<string, unknown>;

function record(value: unknown): JsonRecord | undefined {
  return value && typeof value === 'object' ? value as JsonRecord : undefined;
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`CONTACT_VALIDATION_ASSERTION_FAILED:${message}`);
}

async function json(path: string, init?: RequestInit): Promise<JsonRecord> {
  const response = await fetch(`${baseUrl}${path}`, init);
  const body = record(await response.json()) ?? {};
  if (!response.ok) throw new Error(`HTTP_${response.status}:${JSON.stringify(body)}`);
  return body;
}

async function start(token: string): Promise<string> {
  const body = await json('/mk0/register-new-customer', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      businessSlug: 'golden-business',
      idempotencyKey: `contact-validation-${token}`,
      correlationId: `contact-validation-${token}`,
      completionMode: 'EXPLICIT_FINALIZE',
      draft: { customer: {} },
    }),
  });
  assert(body.status === 'WORKFLOW_ACCEPTED', 'workflow must be accepted');
  assert(typeof body.workflowId === 'string', 'workflowId missing');
  return body.workflowId;
}

async function update(workflowId: string, inputId: string, customerPatch: JsonRecord): Promise<JsonRecord> {
  const body = await json(`/mk0/register-new-customer/${encodeURIComponent(workflowId)}/customer-data`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ inputId, customerPatch }),
  });
  return record(body.result) ?? {};
}

async function trace(workflowId: string): Promise<JsonRecord> {
  const body = await json(`/mk0/executions/${encodeURIComponent(workflowId)}/trace`);
  const value = record(body.trace);
  assert(value, 'trace missing');
  return value;
}

async function waitFor(
  workflowId: string,
  predicate: (value: JsonRecord) => boolean,
  label: string,
  timeoutMs = 10_000,
): Promise<JsonRecord> {
  const deadline = Date.now() + timeoutMs;
  let last: JsonRecord | undefined;
  while (Date.now() < deadline) {
    last = await trace(workflowId);
    if (predicate(last)) return last;
    await new Promise((resolve) => setTimeout(resolve, 120));
  }
  throw new Error(`CONTACT_VALIDATION_TIMEOUT:${label}:${JSON.stringify(last)}`);
}

function workflow(value: JsonRecord): JsonRecord {
  return record(value.workflow) ?? {};
}

function conversation(value: JsonRecord): JsonRecord {
  return record(value.conversation) ?? {};
}

function contact(value: JsonRecord): JsonRecord {
  const draft = record(conversation(value).currentDraft) ?? {};
  const customer = record(draft.customer) ?? {};
  return record(customer.contact) ?? {};
}

function mongoAudit(value: JsonRecord): JsonRecord[] {
  const mongo = record(value.mongo) ?? {};
  return Array.isArray(mongo.audit) ? mongo.audit.map((item) => record(item) ?? {}) : [];
}

function temporalAcceptedUpdates(value: JsonRecord): number {
  const temporal = record(value.temporal) ?? {};
  return Number(temporal.updateAcceptedCount ?? 0);
}

const token = Date.now().toString();
const workflowId = await start(token);

await waitFor(
  workflowId,
  (value) => workflow(value).phase === 'WAITING_FOR_REQUIRED_DATA',
  'initial waiting',
);

const nameId = `name-${token}`;
const name = await update(workflowId, nameId, { name: 'Contact Validation' });
assert(name.ok === true, 'valid name must be applied');

let current = await waitFor(
  workflowId,
  (value) => temporalAcceptedUpdates(value) === 1,
  'valid name appears in Temporal history',
);
const acceptedBeforeInvalid = temporalAcceptedUpdates(current);

const invalidEmailId = `invalid-email-${token}`;
const invalidEmail = await update(workflowId, invalidEmailId, {
  contact: { email: 'Zavaleta' },
});
assert(invalidEmail.ok === false, 'email without @ and dotted domain must be rejected');

const invalidPhoneId = `invalid-phone-${token}`;
const invalidPhone = await update(workflowId, invalidPhoneId, {
  contact: {
    phones: [{ number: 'llslslsl', normalized: 'llslslsl', primary: true }],
  },
});
assert(invalidPhone.ok === false, 'alphabetic phone must be rejected');

current = await trace(workflowId);
assert(workflow(current).workflowStatus === 'RUNNING', 'invalid contact input must not terminate Workflow');
assert(workflow(current).phase === 'WAITING_FOR_REQUIRED_DATA', 'invalid contact input must not satisfy contact requirement');
assert(contact(current).email === undefined, 'invalid email must not enter durable draft');
assert(!Array.isArray(contact(current).phones) || (contact(current).phones as unknown[]).length === 0, 'invalid phone must not enter durable draft');
assert(
  temporalAcceptedUpdates(current) === acceptedBeforeInvalid,
  'CTA-rejected email/phone must not create Temporal UpdateAccepted history events',
);
assert(
  !mongoAudit(current).some((event) => event.logicalKey === `update:${invalidEmailId}` && event.eventType === 'CUSTOMER_DATA_ACCEPTED'),
  'invalid email must not be audited as CUSTOMER_DATA_ACCEPTED',
);
assert(
  !mongoAudit(current).some((event) => event.logicalKey === `update:${invalidPhoneId}` && event.eventType === 'CUSTOMER_DATA_ACCEPTED'),
  'invalid phone must not be audited as CUSTOMER_DATA_ACCEPTED',
);

const validPhoneId = `valid-phone-${token}`;
const validPhone = await update(workflowId, validPhoneId, {
  contact: {
    phones: [{ number: '2831400', normalized: '2831400', primary: true }],
  },
});
assert(validPhone.ok === true, 'seven-digit local phone must be accepted');

current = await waitFor(
  workflowId,
  (value) => workflow(value).phase === 'READY_TO_FINALIZE',
  'ready after valid phone',
);
assert(Array.isArray(contact(current).phones) && (contact(current).phones as unknown[]).length === 1, 'valid phone must enter durable draft');

const validEmailId = `valid-email-${token}`;
const validEmail = await update(workflowId, validEmailId, {
  contact: { email: `contact.${token}@company.pe` },
});
assert(validEmail.ok === true, '.pe email must be accepted; .com is not mandatory');

console.log('TRACE_CONTACT_VALIDATION_PASS', JSON.stringify({
  workflowId,
  invalidEmailRejected: true,
  invalidPhoneRejected: true,
  invalidInputsEnteredTemporal: false,
  invalidInputsAuditedAccepted: false,
  localPhoneAccepted: true,
  nonComEmailAccepted: true,
}));
