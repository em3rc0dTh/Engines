import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

const baseUrl = process.env.ENGINES_CTA_URL ?? 'http://127.0.0.1:8787';

type JsonRecord = Record<string, unknown>;

function record(value: unknown): JsonRecord | undefined {
  return value && typeof value === 'object' ? value as JsonRecord : undefined;
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`TRACE_CERT_ASSERTION_FAILED:${message}`);
}

async function json(path: string, init?: RequestInit): Promise<JsonRecord> {
  const response = await fetch(`${baseUrl}${path}`, init);
  const body = await response.json() as unknown;
  const parsed = record(body) ?? {};
  if (!response.ok) throw new Error(`HTTP_${response.status}:${JSON.stringify(parsed)}`);
  return parsed;
}

async function start(
  idempotencyKey: string,
  draft: JsonRecord = { customer: {} },
): Promise<Readonly<{ workflowId: string; runId: string }>> {
  const body = await json('/mk0/register-new-customer', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      businessSlug: 'golden-business',
      idempotencyKey,
      correlationId: idempotencyKey,
      draft,
    }),
  });
  assert(body.status === 'WORKFLOW_ACCEPTED', 'workflow was not accepted');
  assert(typeof body.workflowId === 'string', 'workflowId missing');
  assert(typeof body.runId === 'string', 'runId missing');
  return { workflowId: body.workflowId, runId: body.runId };
}

async function update(workflowId: string, inputId: string, customerPatch: JsonRecord): Promise<void> {
  const body = await json(`/mk0/register-new-customer/${encodeURIComponent(workflowId)}/customer-data`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ inputId, customerPatch }),
  });
  const result = record(body.result);
  assert(result?.ok === true, `update ${inputId} was not accepted: ${JSON.stringify(body)}`);
}

async function trace(workflowId: string): Promise<JsonRecord> {
  const body = await json(`/mk0/executions/${encodeURIComponent(workflowId)}/trace`);
  const value = record(body.trace);
  assert(value, 'trace missing');
  assert(value.schemaVersion === 'mk0.execution-trace.v1', 'trace schema mismatch');
  return value;
}

async function waitFor(
  workflowId: string,
  predicate: (traceValue: JsonRecord) => boolean,
  label: string,
  timeoutMs = 12_000,
): Promise<JsonRecord> {
  const deadline = Date.now() + timeoutMs;
  let last: JsonRecord | undefined;
  while (Date.now() < deadline) {
    last = await trace(workflowId);
    if (predicate(last)) return last;
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  throw new Error(`TRACE_CERT_TIMEOUT:${label}:${JSON.stringify(last)}`);
}

function workflow(traceValue: JsonRecord): JsonRecord {
  return record(traceValue.workflow) ?? {};
}

function conversation(traceValue: JsonRecord): JsonRecord {
  return record(traceValue.conversation) ?? {};
}

function customerDraft(traceValue: JsonRecord): JsonRecord {
  return record(record(conversation(traceValue).currentDraft)?.customer) ?? {};
}

function postgresSnapshot(traceValue: JsonRecord): JsonRecord {
  return record(record(traceValue.postgres)?.snapshot) ?? {};
}

async function certifyPingPong(): Promise<void> {
  const token = Date.now().toString();
  const execution = await start(`trace-ping-pong-${token}`);

  let current = await waitFor(
    execution.workflowId,
    (value) => workflow(value).phase === 'WAITING_FOR_REQUIRED_DATA',
    'initial waiting',
  );
  assert((conversation(current).missingFields as unknown[] | undefined)?.includes('customer.name'), 'name should initially be missing');
  assert((conversation(current).missingFields as unknown[] | undefined)?.includes('customer.contact.phoneOrEmail'), 'contact should initially be missing');

  await update(execution.workflowId, `name-pepito-${token}`, { name: 'Pepito' });
  current = await waitFor(
    execution.workflowId,
    (value) => customerDraft(value).name === 'Pepito',
    'Pepito visible in durable history projection',
  );
  assert(workflow(current).phase === 'WAITING_FOR_REQUIRED_DATA', 'Pepito stage should still wait');

  await update(execution.workflowId, `name-juancito-${token}`, { name: 'Juancito' });
  current = await waitFor(
    execution.workflowId,
    (value) => customerDraft(value).name === 'Juancito',
    'Juancito visible in durable history projection',
  );
  assert(workflow(current).phase === 'WAITING_FOR_REQUIRED_DATA', 'Juancito stage should still wait');

  await update(execution.workflowId, `name-andresito-${token}`, { name: 'Andresito' });
  current = await waitFor(
    execution.workflowId,
    (value) => customerDraft(value).name === 'Andresito',
    'Andresito visible in durable history projection',
  );
  assert(workflow(current).phase === 'WAITING_FOR_REQUIRED_DATA', 'Andresito stage should still wait');

  await update(execution.workflowId, `email-andresito-${token}`, {
    contact: { email: `andresito.${token}@example.test` },
  });
  current = await waitFor(
    execution.workflowId,
    (value) => workflow(value).workflowStatus === 'COMPLETED' && workflow(value).phase === 'CREATED',
    'workflow completed',
  );

  const conv = conversation(current);
  const updates = Array.isArray(conv.updates) ? conv.updates : [];
  assert(updates.length >= 4, 'all four Update events must be visible');
  assert(
    updates.every((item) => record(item)?.application === 'APPLIED'),
    `all expected Updates must be APPLIED: ${JSON.stringify(updates)}`,
  );
  assert(customerDraft(current).name === 'Andresito', 'final durable draft must contain last name update');

  const temporal = record(current.temporal) ?? {};
  assert(Number(temporal.eventCount ?? 0) > 0, 'Temporal Event History missing');
  assert(Number(temporal.updateAcceptedCount ?? 0) >= 4, 'Temporal Update evidence missing');
  assert(Number(temporal.activityScheduledCount ?? 0) > 0, 'Temporal Activity evidence missing');

  const mongo = record(current.mongo) ?? {};
  const audit = Array.isArray(mongo.audit) ? mongo.audit : [];
  assert(mongo.availability === 'AVAILABLE', `Mongo evidence unavailable: ${JSON.stringify(mongo)}`);
  assert(audit.some((item) => record(item)?.eventType === 'REGISTRATION_COMPLETED'), 'Mongo terminal audit missing');
  assert(
    audit.filter((item) => record(item)?.eventType === 'CUSTOMER_DATA_ACCEPTED').length >= 5,
    'Mongo customer data audit incomplete',
  );

  const postgres = record(current.postgres) ?? {};
  assert(postgres.availability === 'AVAILABLE', `PostgreSQL evidence unavailable: ${JSON.stringify(postgres)}`);
  const snapshot = postgresSnapshot(current);
  const registration = record(snapshot.registration) ?? {};
  const customer = record(snapshot.customer) ?? {};
  assert(registration.status === 'COMPLETED_CREATED', 'PostgreSQL registration not terminal created');
  assert(customer.name === 'Andresito', 'PostgreSQL final customer name mismatch');
  assert(customer.email === `andresito.${token}@example.test`, 'PostgreSQL final email mismatch');

  const evidence = record(current.evidence) ?? {};
  assert(evidence.temporal === true, 'Temporal evidence flag false');
  assert(evidence.mongo === true, 'Mongo evidence flag false');
  assert(evidence.postgres === true, 'PostgreSQL evidence flag false');
  assert(evidence.attachmentStore === 'NOT_APPLICABLE', 'AttachmentStore should be N/A for ping-pong case');
  assert(Array.isArray(evidence.warnings) && evidence.warnings.length === 0, `unexpected ping-pong warnings: ${JSON.stringify(evidence.warnings)}`);

  console.log(`TRACE_PING_PONG_PASS ${JSON.stringify({
    workflowId: execution.workflowId,
    runId: execution.runId,
    updates: updates.length,
    finalName: customer.name,
  })}`);
}

async function certifyAttachmentTrace(): Promise<void> {
  const token = Date.now().toString();
  const fixturePath = new URL('../../golden-dataset/fixtures/synthetic-supporting-document-v1.txt', import.meta.url);
  const fixture = await readFile(fixturePath);
  const sha256 = createHash('sha256').update(fixture).digest('hex');
  const ingressRef = `ing_trace_${token}`;

  const stageResponse = await fetch(`${baseUrl}/mk0/attachments/stage`, {
    method: 'POST',
    headers: {
      'content-type': 'text/plain',
      'x-media-type': 'text/plain',
      'x-ingress-ref': ingressRef,
      'x-expected-sha256': sha256,
      'x-file-name': 'synthetic-supporting-document-v1.txt',
    },
    body: fixture,
  });
  const staged = record(await stageResponse.json() as unknown) ?? {};
  assert(stageResponse.status === 201, `attachment stage failed: ${JSON.stringify(staged)}`);

  const execution = await start(`trace-attachment-${token}`, {
    customer: {
      name: `Trace Attachment ${token}`,
      contact: { email: `trace.attachment.${token}@example.test` },
    },
    attachments: [{
      ingressRef,
      kind: 'supporting_document',
      displayName: 'Synthetic supporting document',
      mediaType: 'text/plain',
      sha256,
      byteLength: fixture.byteLength,
    }],
  });

  const completed = await waitFor(
    execution.workflowId,
    (value) => workflow(value).workflowStatus === 'COMPLETED' && workflow(value).phase === 'CREATED',
    'attachment workflow completed',
  );

  const attachmentStore = record(completed.attachmentStore) ?? {};
  const committed = Array.isArray(attachmentStore.committed) ? attachmentStore.committed : [];
  assert(attachmentStore.applicable === true, 'AttachmentStore should be applicable');
  assert(attachmentStore.availability === 'AVAILABLE', `AttachmentStore evidence not available: ${JSON.stringify(attachmentStore)}`);
  assert(committed.length === 1, 'exactly one committed attachment expected');
  assert(record(committed[0])?.storeMetadataFound === true, 'committed store metadata missing');

  const snapshot = postgresSnapshot(completed);
  const customer = record(snapshot.customer) ?? {};
  const refs = Array.isArray(customer.attachments) ? customer.attachments : [];
  assert(refs.length === 1, 'PostgreSQL attachment link missing');

  const mongo = record(completed.mongo) ?? {};
  const audit = Array.isArray(mongo.audit) ? mongo.audit : [];
  assert(audit.some((item) => record(item)?.eventType === 'ATTACHMENT_COMMITTED'), 'Mongo ATTACHMENT_COMMITTED missing');

  const evidence = record(completed.evidence) ?? {};
  assert(evidence.attachmentStore === 'COMPLETE', 'AttachmentStore evidence should be COMPLETE');
  assert(Array.isArray(evidence.warnings) && evidence.warnings.length === 0, `unexpected evidence warnings: ${JSON.stringify(evidence.warnings)}`);

  console.log(`TRACE_ATTACHMENT_PASS ${JSON.stringify({
    workflowId: execution.workflowId,
    runId: execution.runId,
    sha256,
  })}`);
}

async function main(): Promise<void> {
  const health = await json('/health');
  assert(health.ok === true, 'CTA health failed');
  await certifyPingPong();
  await certifyAttachmentTrace();
  console.log('MK0_LAB_TRACE_CERTIFICATION_PASS');
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exitCode = 1;
});
