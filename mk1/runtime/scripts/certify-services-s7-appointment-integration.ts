import { randomUUID } from 'node:crypto';
import { Client, Connection } from '@temporalio/client';
import type {
  ServicesMutationCommand,
  ServicesMutationOutcome,
} from '../src/contracts/services-engine/index.js';
import { loadRuntimeConfig } from '../src/config/runtime-config.js';

const baseUrl = (process.env.ENGINES_CTA_URL ?? 'http://127.0.0.1:8787').replace(/\/$/, '');

type JsonRecord = Record<string, unknown>;

function record(value: unknown): JsonRecord | undefined {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as JsonRecord
    : undefined;
}

function list(value: unknown): JsonRecord[] {
  return Array.isArray(value) ? value.map((item) => record(item) ?? {}) : [];
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`SERVICES_S7_ASSERTION_FAILED:${message}`);
}

async function json(path: string, init?: RequestInit): Promise<JsonRecord> {
  const response = await fetch(`${baseUrl}${path}`, init);
  const body = record(await response.json() as unknown) ?? {};
  if (!response.ok) throw new Error(`SERVICES_S7_HTTP_${response.status}:${JSON.stringify(body)}`);
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

function updateResult(body: JsonRecord): JsonRecord {
  return record(body.result) ?? {};
}

async function getState(workflowId: string): Promise<JsonRecord> {
  return state(await json(`/mk0/register-new-appointment/${encodeURIComponent(workflowId)}`));
}

async function waitFor(
  workflowId: string,
  predicate: (current: JsonRecord) => boolean,
  label: string,
  timeoutMs = 30_000,
): Promise<JsonRecord> {
  const deadline = Date.now() + timeoutMs;
  let last: JsonRecord | undefined;
  while (Date.now() < deadline) {
    last = await getState(workflowId);
    if (predicate(last)) return last;
    await new Promise((resolve) => setTimeout(resolve, 120));
  }
  throw new Error(`SERVICES_S7_TIMEOUT:${label}:${JSON.stringify(last)}`);
}

function inputId(token: string, suffix: string): string {
  return `s7-${token}-${suffix}`;
}

async function startAppointment(token: string, suffix: string): Promise<Readonly<{ workflowId: string; runId: string }>> {
  const body = await post('/mk0/register-new-appointment', {
    businessSlug: 'golden-business',
    idempotencyKey: inputId(token, `start-${suffix}`),
    correlationId: inputId(token, `corr-${suffix}`),
  });
  assert(body.status === 'WORKFLOW_ACCEPTED', `${suffix} start rejected`);
  assert(typeof body.workflowId === 'string', `${suffix} workflowId missing`);
  assert(typeof body.runId === 'string', `${suffix} runId missing`);
  return { workflowId: body.workflowId, runId: body.runId };
}

async function provideNewCustomer(token: string, workflowId: string): Promise<void> {
  let response = await post(`/mk0/register-new-appointment/${encodeURIComponent(workflowId)}/customer-data`, {
    inputId: inputId(token, 'customer-name'),
    customerPatch: { name: `S7 Customer ${token}` },
  });
  assert(updateResult(response).ok === true, 'name update rejected');

  response = await post(`/mk0/register-new-appointment/${encodeURIComponent(workflowId)}/customer-data`, {
    inputId: inputId(token, 'customer-email'),
    customerPatch: { contact: { email: `s7.${token}@example.test` } },
  });
  assert(updateResult(response).ok === true, 'email update rejected');

  response = await post(`/mk0/register-new-appointment/${encodeURIComponent(workflowId)}/resolve-customer`, {
    inputId: inputId(token, 'customer-resolve'),
  });
  assert(updateResult(response).ok === true, 'customer resolve rejected');
}

async function provideExistingCustomer(token: string, workflowId: string, customerId: string): Promise<void> {
  let response = await post(`/mk0/register-new-appointment/${encodeURIComponent(workflowId)}/customer-data`, {
    inputId: inputId(token, 'existing-customer'),
    customerId,
  });
  assert(updateResult(response).ok === true, 'existing customer update rejected');
  response = await post(`/mk0/register-new-appointment/${encodeURIComponent(workflowId)}/resolve-customer`, {
    inputId: inputId(token, 'existing-resolve'),
  });
  assert(updateResult(response).ok === true, 'existing customer resolve rejected');
}

async function selectCanonicalBasicOffering(
  token: string,
  workflowId: string,
): Promise<Readonly<{ service: JsonRecord; offering: JsonRecord }>> {
  let current = await waitFor(workflowId, (value) => value.phase === 'WAITING_FOR_SERVICE', 'service wait');
  const service = list(current.services).find((item) => item.serviceId === 'svc_car_wash');
  assert(service, 'canonical Car Wash Service missing');
  assert(service.businessSlug === 'golden-business', `Service business scope missing: ${JSON.stringify(service)}`);
  assert(Number.isInteger(service.revision) && Number(service.revision) >= 1, `Service revision missing: ${JSON.stringify(service)}`);
  assert(service.status === 'ACTIVE', 'Service status must originate from Services projection');

  let response = await post(`/mk0/register-new-appointment/${encodeURIComponent(workflowId)}/service`, {
    inputId: inputId(token, 'service'),
    serviceId: 'svc_car_wash',
  });
  assert(updateResult(response).ok === true, 'Service selection rejected');

  current = await waitFor(workflowId, (value) => value.phase === 'WAITING_FOR_PRODUCT', 'offering wait');
  const offering = list(current.products).find((item) => item.productId === 'prd_car_wash_basic');
  assert(offering, 'canonical Basic Clean Offering missing');
  assert(offering.businessSlug === 'golden-business', `Offering business scope missing: ${JSON.stringify(offering)}`);
  assert(Number.isInteger(offering.revision) && Number(offering.revision) >= 1, `Offering revision missing: ${JSON.stringify(offering)}`);
  assert(offering.status === 'ACTIVE', 'Offering status must originate from Services projection');
  assert(record(offering.pricing), `Offering pricing missing from Appointment projection: ${JSON.stringify(offering)}`);
  assert(Array.isArray(offering.requirements), 'Offering requirements missing from Appointment projection');
  assert(Array.isArray(offering.dependencies), 'Offering dependencies missing from Appointment projection');

  response = await post(`/mk0/register-new-appointment/${encodeURIComponent(workflowId)}/product`, {
    inputId: inputId(token, 'offering'),
    productId: 'prd_car_wash_basic',
  });
  assert(updateResult(response).ok === true, 'Offering selection rejected');
  await waitFor(workflowId, (value) => value.phase === 'WAITING_FOR_DATE', 'selected snapshot wait');
  return { service, offering };
}

async function completeAppointment(
  token: string,
  workflowId: string,
  dateInput: string,
  preferredSlot: string,
): Promise<JsonRecord> {
  let response = await post(`/mk0/register-new-appointment/${encodeURIComponent(workflowId)}/date`, {
    inputId: inputId(token, 'date'),
    dateInput,
  });
  assert(updateResult(response).ok === true, `date ${dateInput} rejected`);

  let current = await waitFor(workflowId, (value) => value.phase === 'WAITING_FOR_SLOT', 'slot wait');
  const slots = list(current.availableSlots);
  const selected = slots.find((slot) => slot.start === preferredSlot) ?? slots[0];
  assert(selected && typeof selected.start === 'string', `no slot available: ${JSON.stringify(slots)}`);

  response = await post(`/mk0/register-new-appointment/${encodeURIComponent(workflowId)}/slot`, {
    inputId: inputId(token, 'slot'),
    slotStart: selected.start,
  });
  assert(updateResult(response).ok === true, 'slot selection rejected');
  await waitFor(workflowId, (value) => value.phase === 'READY_TO_FINALIZE', 'ready to finalize');

  response = await post(`/mk0/register-new-appointment/${encodeURIComponent(workflowId)}/finalize`, {
    inputId: inputId(token, 'finalize'),
  });
  assert(updateResult(response).ok === true, 'finalize rejected');

  current = await waitFor(
    workflowId,
    (value) => value.workflowStatus === 'COMPLETED' && value.phase === 'CREATED',
    'created',
  );
  return current;
}

async function run(): Promise<void> {
  const token = randomUUID().replaceAll('-', '').slice(0, 12);
  const config = loadRuntimeConfig();
  const connection = await Connection.connect({ address: config.temporalAddress });
  const temporal = new Client({ connection, namespace: config.temporalNamespace });

  try {
    const first = await startAppointment(token, 'first');
    await waitFor(first.workflowId, (value) => value.phase === 'WAITING_FOR_CUSTOMER', 'first customer wait');
    await provideNewCustomer(token, first.workflowId);
    const selectedN = await selectCanonicalBasicOffering(token, first.workflowId);

    const beforeMutation = await getState(first.workflowId);
    const selectedServiceN = record(beforeMutation.selectedService) ?? {};
    const selectedOfferingN = record(beforeMutation.selectedProduct) ?? {};
    const customer = record(beforeMutation.customer) ?? {};
    const customerId = String(customer.customerId ?? '');
    assert(customerId.startsWith('cus_'), 'first Appointment did not resolve/create Customer');
    assert(selectedServiceN.revision === selectedN.service.revision, 'selected Service revision changed before mutation');
    assert(selectedOfferingN.revision === selectedN.offering.revision, 'selected Offering revision changed before mutation');

    const revisionN = Number(selectedOfferingN.revision);
    const pricingN = record(selectedOfferingN.pricing) ?? {};
    assert(pricingN.kind === 'QUOTE_REQUIRED', `golden Basic Clean precondition expected QUOTE_REQUIRED: ${JSON.stringify(pricingN)}`);

    console.log(`SERVICES_S7_CANONICAL_SELECTION_PASS ${JSON.stringify({
      workflowId: first.workflowId,
      serviceRevision: selectedServiceN.revision,
      offeringRevision: revisionN,
      offeringPricing: pricingN,
    })}`);

    const updateCommand: ServicesMutationCommand = {
      operation: 'UpdateOffering',
      businessSlug: 'golden-business',
      idempotencyKey: inputId(token, 'publish-n-plus-1'),
      offeringId: 'prd_car_wash_basic',
      expectedRevision: revisionN,
      patch: {
        pricing: { kind: 'FIXED', amountMinor: 3100, currency: 'PEN' },
      },
    };

    const mutation = await temporal.workflow.execute<
      (input: ServicesMutationCommand) => Promise<ServicesMutationOutcome>
    >('servicesManagementWorkflow', {
      workflowId: `services-s7-publish:${token}`,
      taskQueue: config.temporalTaskQueue,
      args: [updateCommand],
    });

    assert(mutation.status === 'APPLIED', `N+1 publication rejected: ${JSON.stringify(mutation)}`);
    if (mutation.status !== 'APPLIED') throw new Error('SERVICES_S7_MUTATION_NOT_APPLIED');
    assert(mutation.revision === revisionN + 1, `expected N+1 revision: ${JSON.stringify(mutation)}`);

    console.log(`SERVICES_S7_CATALOG_N_PLUS_1_PASS ${JSON.stringify({
      offeringId: mutation.entityId,
      beforeRevision: revisionN,
      publishedRevision: mutation.revision,
    })}`);

    const afterMutation = await getState(first.workflowId);
    const frozenService = record(afterMutation.selectedService) ?? {};
    const frozenOffering = record(afterMutation.selectedProduct) ?? {};
    assert(frozenService.revision === selectedServiceN.revision, 'active Appointment Service snapshot refreshed silently');
    assert(frozenOffering.revision === revisionN, `active Appointment Offering snapshot refreshed silently: ${JSON.stringify(frozenOffering)}`);
    assert(record(frozenOffering.pricing)?.kind === 'QUOTE_REQUIRED', 'active Appointment Offering pricing changed after publication');

    console.log(`SERVICES_S7_ACTIVE_SNAPSHOT_STILL_N_PASS ${JSON.stringify({
      workflowId: first.workflowId,
      offeringRevision: frozenOffering.revision,
      offeringPricing: frozenOffering.pricing,
    })}`);

    const firstFinal = await completeAppointment(token, first.workflowId, 'viernes', '06:00');
    assert(record(firstFinal.result)?.productId === 'prd_car_wash_basic', 'first Appointment persisted wrong Offering');
    console.log(`SERVICES_S7_FIRST_APPOINTMENT_CREATED_PASS ${JSON.stringify({
      workflowId: first.workflowId,
      appointmentId: record(firstFinal.result)?.appointmentId,
      selectedOfferingRevision: frozenOffering.revision,
    })}`);

    const secondToken = `${token}-next`;
    const second = await startAppointment(secondToken, 'second');
    await waitFor(second.workflowId, (value) => value.phase === 'WAITING_FOR_CUSTOMER', 'second customer wait');
    await provideExistingCustomer(secondToken, second.workflowId, customerId);
    const selectedN1 = await selectCanonicalBasicOffering(secondToken, second.workflowId);
    assert(Number(selectedN1.offering.revision) === revisionN + 1, `new Appointment did not see N+1: ${JSON.stringify(selectedN1.offering)}`);
    assert(record(selectedN1.offering.pricing)?.kind === 'FIXED', 'new Appointment did not see N+1 pricing kind');
    assert(record(selectedN1.offering.pricing)?.amountMinor === 3100, 'new Appointment did not see N+1 pricing amount');

    const secondState = await getState(second.workflowId);
    const secondFrozen = record(secondState.selectedProduct) ?? {};
    assert(secondFrozen.revision === revisionN + 1, 'second Appointment did not freeze N+1 revision');

    console.log(`SERVICES_S7_NEW_APPOINTMENT_SEES_N_PLUS_1_PASS ${JSON.stringify({
      workflowId: second.workflowId,
      offeringRevision: secondFrozen.revision,
      offeringPricing: secondFrozen.pricing,
    })}`);

    const secondFinal = await completeAppointment(secondToken, second.workflowId, 'sábado', '06:30');
    assert(record(secondFinal.result)?.productId === 'prd_car_wash_basic', 'second Appointment persisted wrong Offering');

    console.log(`SERVICES_S7_APPOINTMENT_INTEGRATION_PASS ${JSON.stringify({
      firstWorkflowId: first.workflowId,
      firstRunId: first.runId,
      secondWorkflowId: second.workflowId,
      secondRunId: second.runId,
      serviceRevision: selectedServiceN.revision,
      firstOfferingRevision: revisionN,
      publishedOfferingRevision: revisionN + 1,
      secondOfferingRevision: secondFrozen.revision,
      firstCompleted: firstFinal.workflowStatus === 'COMPLETED',
      secondCompleted: secondFinal.workflowStatus === 'COMPLETED',
    })}`);
  } finally {
    await connection.close();
  }
}

run().catch((error: unknown) => {
  console.error(`SERVICES_S7_APPOINTMENT_INTEGRATION_FAILED ${JSON.stringify({
    error: error instanceof Error ? error.stack ?? error.message : String(error),
  })}`);
  process.exitCode = 1;
});
