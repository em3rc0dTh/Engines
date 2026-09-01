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
  if (!condition) throw new Error(`APPOINTMENT_CERT_ASSERTION_FAILED:${message}`);
}

async function json(path: string, init?: RequestInit): Promise<JsonRecord> {
  const response = await fetch(`${baseUrl}${path}`, init);
  const body = record(await response.json() as unknown) ?? {};
  if (!response.ok) throw new Error(`HTTP_${response.status}:${JSON.stringify(body)}`);
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

function result(body: JsonRecord): JsonRecord {
  return record(body.result) ?? {};
}

function customer(stateValue: JsonRecord): JsonRecord {
  return record(stateValue.customer) ?? {};
}

async function getState(workflowId: string): Promise<JsonRecord> {
  return json(`/mk0/register-new-appointment/${encodeURIComponent(workflowId)}`);
}

async function waitFor(
  workflowId: string,
  predicate: (stateValue: JsonRecord) => boolean,
  label: string,
  timeoutMs = 20_000,
): Promise<JsonRecord> {
  const deadline = Date.now() + timeoutMs;
  let last: JsonRecord | undefined;
  while (Date.now() < deadline) {
    const body = await getState(workflowId);
    last = state(body);
    if (predicate(last)) return last;
    await new Promise((resolve) => setTimeout(resolve, 120));
  }
  throw new Error(`APPOINTMENT_CERT_TIMEOUT:${label}:${JSON.stringify(last)}`);
}

function id(token: string, suffix: string): string {
  return `appt-cert-${token}-${suffix}`;
}

async function start(token: string, suffix: string, idempotencyKey?: string): Promise<Readonly<{ workflowId: string; runId: string; key: string }>> {
  const key = idempotencyKey ?? id(token, `start-${suffix}`);
  const body = await post('/mk0/register-new-appointment', {
    businessSlug: 'golden-business',
    idempotencyKey: key,
    correlationId: id(token, `corr-${suffix}`),
  });
  assert(body.status === 'WORKFLOW_ACCEPTED', `${suffix} Workflow was not accepted`);
  assert(typeof body.workflowId === 'string', `${suffix} workflowId missing`);
  assert(typeof body.runId === 'string', `${suffix} runId missing`);
  return { workflowId: body.workflowId, runId: body.runId, key } as Readonly<{ workflowId: string; runId: string; key: string }>;
}

async function provideCustomer(workflowId: string, inputId: string, patch: JsonRecord): Promise<JsonRecord> {
  return post(`/mk0/register-new-appointment/${encodeURIComponent(workflowId)}/customer-data`, {
    inputId,
    customerPatch: patch,
  });
}

async function provideCustomerId(workflowId: string, inputId: string, customerId: string): Promise<JsonRecord> {
  return post(`/mk0/register-new-appointment/${encodeURIComponent(workflowId)}/customer-data`, {
    inputId,
    customerId,
  });
}

async function resolveCustomer(workflowId: string, inputId: string): Promise<JsonRecord> {
  return post(`/mk0/register-new-appointment/${encodeURIComponent(workflowId)}/resolve-customer`, { inputId });
}

async function selectService(workflowId: string, inputId: string, serviceId: string): Promise<JsonRecord> {
  return post(`/mk0/register-new-appointment/${encodeURIComponent(workflowId)}/service`, { inputId, serviceId });
}

async function selectProduct(workflowId: string, inputId: string, productId: string): Promise<JsonRecord> {
  return post(`/mk0/register-new-appointment/${encodeURIComponent(workflowId)}/product`, { inputId, productId });
}

async function setDate(workflowId: string, inputId: string, dateInput: string): Promise<JsonRecord> {
  return post(`/mk0/register-new-appointment/${encodeURIComponent(workflowId)}/date`, { inputId, dateInput });
}

async function selectSlot(workflowId: string, inputId: string, slotStart: string): Promise<JsonRecord> {
  return post(`/mk0/register-new-appointment/${encodeURIComponent(workflowId)}/slot`, { inputId, slotStart });
}

async function finalize(workflowId: string, inputId: string): Promise<JsonRecord> {
  return post(`/mk0/register-new-appointment/${encodeURIComponent(workflowId)}/finalize`, { inputId });
}

async function bringExistingCustomerAppointmentToSlots(
  token: string,
  suffix: string,
  customerId: string,
  dateInput: string,
): Promise<Readonly<{ workflowId: string; runId: string; appointmentDate: string; slots: JsonRecord[] }>> {
  const execution = await start(token, suffix);
  await waitFor(execution.workflowId, (value) => value.phase === 'WAITING_FOR_CUSTOMER', `${suffix} initial customer wait`);
  const customerUpdate = await provideCustomerId(execution.workflowId, id(token, `${suffix}-customer-id`), customerId);
  assert(result(customerUpdate).ok === true, `${suffix} customerId Update rejected`);
  const customerResolution = await resolveCustomer(execution.workflowId, id(token, `${suffix}-resolve`));
  assert(result(customerResolution).ok === true, `${suffix} resolve Update rejected`);

  let current = await waitFor(execution.workflowId, (value) => value.phase === 'WAITING_FOR_SERVICE', `${suffix} service wait`);
  assert(customer(current).status === 'EXISTING', `${suffix} must resolve existing Customer`);
  assert(customer(current).customerId === customerId, `${suffix} resolved wrong Customer`);

  const services = list(current.services);
  const carWash = services.find((service) => service.serviceId === 'svc_car_wash');
  assert(carWash, `${suffix} Car Wash missing`);
  const serviceUpdate = await selectService(execution.workflowId, id(token, `${suffix}-service`), 'svc_car_wash');
  assert(result(serviceUpdate).ok === true, `${suffix} service selection rejected`);

  current = await waitFor(execution.workflowId, (value) => value.phase === 'WAITING_FOR_PRODUCT', `${suffix} product wait`);
  assert(list(current.products).some((product) => product.productId === 'prd_car_wash_basic'), `${suffix} Basic Clean missing`);
  const productUpdate = await selectProduct(execution.workflowId, id(token, `${suffix}-product`), 'prd_car_wash_basic');
  assert(result(productUpdate).ok === true, `${suffix} product selection rejected`);

  await waitFor(execution.workflowId, (value) => value.phase === 'WAITING_FOR_DATE', `${suffix} date wait`);
  const dateResponse = await setDate(execution.workflowId, id(token, `${suffix}-date`), dateInput);
  assert(result(dateResponse).ok === true, `${suffix} date selection rejected`);
  assert(typeof dateResponse.normalizedAppointmentDate === 'string', `${suffix} normalized date missing`);
  const appointmentDate = String(dateResponse.normalizedAppointmentDate);

  current = await waitFor(execution.workflowId, (value) => value.phase === 'WAITING_FOR_SLOT', `${suffix} slot wait`);
  const slots = list(current.availableSlots);
  return { workflowId: execution.workflowId, runId: execution.runId, appointmentDate, slots };
}

async function certifyHappyPath(token: string): Promise<Readonly<{ customerId: string; appointmentId: string; appointmentDate: string; workflowId: string; runId: string; idempotencyKey: string }>> {
  const execution = await start(token, 'happy');
  let current = await waitFor(execution.workflowId, (value) => value.phase === 'WAITING_FOR_CUSTOMER', 'happy initial customer wait');
  assert(customer(current).status === 'EMPTY', 'intent-only appointment must begin without Customer');

  const email = `appointment.${token}@example.test`;
  let response = await provideCustomer(execution.workflowId, id(token, 'happy-name'), { name: `Appointment Customer ${token}` });
  assert(result(response).ok === true, 'customer name Update rejected');
  response = await provideCustomer(execution.workflowId, id(token, 'happy-email'), { contact: { email } });
  assert(result(response).ok === true, 'customer email Update rejected');
  response = await resolveCustomer(execution.workflowId, id(token, 'happy-resolve'));
  assert(result(response).ok === true, 'resolve customer Update rejected');

  current = await waitFor(execution.workflowId, (value) => value.phase === 'WAITING_FOR_SERVICE', 'happy service wait', 30_000);
  assert(customer(current).status === 'CREATED', `new Customer must be created through child Workflow: ${JSON.stringify(customer(current))}`);
  const customerId = String(customer(current).customerId ?? '');
  assert(customerId.startsWith('cus_'), 'child RegisterNewCustomer did not return Customer ID');
  console.log(`APPOINTMENT_NEW_CUSTOMER_CHILD_PASS ${JSON.stringify({ workflowId: execution.workflowId, customerId })}`);

  const services = list(current.services);
  assert(services.some((service) => service.serviceId === 'svc_car_wash' && service.name === 'Car Wash'), 'Car Wash service not loaded from catalog');
  response = await selectService(execution.workflowId, id(token, 'happy-service'), 'svc_car_wash');
  assert(result(response).ok === true, 'Car Wash selection rejected');

  current = await waitFor(execution.workflowId, (value) => value.phase === 'WAITING_FOR_PRODUCT', 'happy product wait');
  const products = list(current.products);
  assert(products.length === 3, `expected 3 Car Wash products: ${JSON.stringify(products)}`);
  for (const productId of ['prd_car_wash_basic', 'prd_car_wash_executive', 'prd_car_wash_salon']) {
    assert(products.some((product) => product.productId === productId), `catalog product missing: ${productId}`);
  }
  console.log(`APPOINTMENT_CATALOG_PASS ${JSON.stringify({ services: services.length, products: products.map((product) => product.name) })}`);

  response = await selectProduct(execution.workflowId, id(token, 'happy-product'), 'prd_car_wash_basic');
  assert(result(response).ok === true, 'Basic Clean selection rejected');
  await waitFor(execution.workflowId, (value) => value.phase === 'WAITING_FOR_DATE', 'happy date wait');

  const beforePast = await getState(execution.workflowId);
  const pastResponse = await setDate(execution.workflowId, id(token, 'happy-past-date'), 'ayer');
  assert(result(pastResponse).ok === false, 'ayer must be rejected');
  const pastIssues = list(result(pastResponse).issues);
  assert(pastIssues.some((item) => item.code === 'PAST_DATE'), `past-date rejection must be typed: ${JSON.stringify(pastResponse)}`);
  const afterPast = state(await getState(execution.workflowId));
  assert(afterPast.phase === 'WAITING_FOR_DATE', 'past date must not advance Workflow');
  assert(afterPast.appointmentDate === undefined, 'past date must not enter durable appointment state');
  assert(state(beforePast).appointmentDate === undefined, 'precondition: no date before past-date test');
  console.log('APPOINTMENT_PAST_DATE_REJECTED');

  const dateResponse = await setDate(execution.workflowId, id(token, 'happy-date'), 'viernes');
  assert(result(dateResponse).ok === true, `viernes was rejected: ${JSON.stringify(dateResponse)}`);
  const appointmentDate = String(dateResponse.normalizedAppointmentDate ?? '');
  assert(/^\d{4}-\d{2}-\d{2}$/.test(appointmentDate), 'viernes did not normalize to canonical date');

  current = await waitFor(execution.workflowId, (value) => value.phase === 'WAITING_FOR_SLOT', 'happy slot wait');
  const slots = list(current.availableSlots);
  assert(slots.length === 3, `expected 3 fixture slots before booking: ${JSON.stringify(slots)}`);
  assert(slots.map((slot) => slot.start).join(',') === '06:00,06:30,07:00', `unexpected fixture slots: ${JSON.stringify(slots)}`);
  console.log(`APPOINTMENT_DATE_AND_SLOTS_PASS ${JSON.stringify({ input: 'viernes', appointmentDate, slots })}`);

  response = await selectSlot(execution.workflowId, id(token, 'happy-slot'), '06:30');
  assert(result(response).ok === true, '06:30 slot selection rejected');
  current = await waitFor(execution.workflowId, (value) => value.phase === 'READY_TO_FINALIZE', 'happy ready to finalize');
  assert(current.workflowStatus === 'RUNNING', 'appointment must still be RUNNING before explicit finalize');
  assert(current.result === undefined, 'appointment must not exist before explicit finalize');

  response = await finalize(execution.workflowId, id(token, 'happy-finalize'));
  assert(result(response).ok === true, 'FinalizeAppointment rejected');
  current = await waitFor(
    execution.workflowId,
    (value) => value.workflowStatus === 'COMPLETED' && value.phase === 'CREATED',
    'happy appointment completion',
    20_000,
  );
  const appointmentResult = record(current.result) ?? {};
  const appointmentId = String(appointmentResult.appointmentId ?? '');
  assert(appointmentId.startsWith('apt_'), `appointmentId missing: ${JSON.stringify(current)}`);
  assert(appointmentResult.customerId === customerId, 'appointment persisted against wrong Customer');
  assert(appointmentResult.serviceId === 'svc_car_wash', 'wrong persisted Service');
  assert(appointmentResult.productId === 'prd_car_wash_basic', 'wrong persisted Product');
  assert(record(appointmentResult.slot)?.start === '06:30', 'wrong persisted slot');
  console.log(`APPOINTMENT_BOOKING_PASS ${JSON.stringify({ workflowId: execution.workflowId, appointmentId, customerId, appointmentDate, slot: appointmentResult.slot })}`);

  const replay = await post('/mk0/register-new-appointment', {
    businessSlug: 'golden-business',
    idempotencyKey: execution.key,
    correlationId: id(token, 'different-correlation-is-transport-only'),
  });
  assert(replay.workflowId === execution.workflowId, 'exact appointment idempotency replay returned different Workflow');
  assert(replay.runId === execution.runId, 'exact appointment idempotency replay returned different Run');
  console.log(`APPOINTMENT_IDEMPOTENCY_REPLAY_PASS ${JSON.stringify({ workflowId: execution.workflowId, runId: execution.runId })}`);

  return { customerId, appointmentId, appointmentDate, workflowId: execution.workflowId, runId: execution.runId, idempotencyKey: execution.key };
}

async function certifySlotRace(token: string, customerId: string): Promise<void> {
  const left = await bringExistingCustomerAppointmentToSlots(token, 'race-left', customerId, 'viernes');
  const right = await bringExistingCustomerAppointmentToSlots(token, 'race-right', customerId, 'viernes');
  assert(left.appointmentDate === right.appointmentDate, 'race Workflows must target same date');

  const leftStarts = left.slots.map((slot) => slot.start);
  const rightStarts = right.slots.map((slot) => slot.start);
  assert(leftStarts.includes('07:00') && rightStarts.includes('07:00'), `race precondition slot 07:00 missing: ${JSON.stringify({ leftStarts, rightStarts })}`);

  let response = await selectSlot(left.workflowId, id(token, 'race-left-slot'), '07:00');
  assert(result(response).ok === true, 'left race slot selection rejected');
  response = await selectSlot(right.workflowId, id(token, 'race-right-slot'), '07:00');
  assert(result(response).ok === true, 'right race slot selection rejected');
  await waitFor(left.workflowId, (value) => value.phase === 'READY_TO_FINALIZE', 'left race ready');
  await waitFor(right.workflowId, (value) => value.phase === 'READY_TO_FINALIZE', 'right race ready');

  response = await finalize(left.workflowId, id(token, 'race-left-finalize'));
  assert(result(response).ok === true, 'left race finalize rejected');
  const leftCompleted = await waitFor(
    left.workflowId,
    (value) => value.workflowStatus === 'COMPLETED' && value.phase === 'CREATED',
    'left race completion',
  );
  assert(record(leftCompleted.result)?.appointmentId, 'left race appointment missing');

  response = await finalize(right.workflowId, id(token, 'race-right-finalize'));
  assert(result(response).ok === true, 'right race finalize Update itself should be accepted');
  const rightAfterConflict = await waitFor(
    right.workflowId,
    (value) => value.workflowStatus === 'RUNNING'
      && value.phase === 'WAITING_FOR_SLOT'
      && list(value.issues).some((item) => item.code === 'SLOT_NOT_AVAILABLE'),
    'right race conflict return to slot selection',
  );
  assert(!list(rightAfterConflict.availableSlots).some((slot) => slot.start === '07:00'), 'lost race slot must disappear from refreshed availability');
  assert(rightAfterConflict.result === undefined, 'losing race must not persist appointment');

  console.log(`APPOINTMENT_SLOT_CONFLICT_PASS ${JSON.stringify({
    date: left.appointmentDate,
    winningWorkflowId: left.workflowId,
    losingWorkflowId: right.workflowId,
    remainingSlots: list(rightAfterConflict.availableSlots).map((slot) => slot.start),
  })}`);
}

async function main(): Promise<void> {
  const health = await json('/health');
  assert(health.ok === true, 'CTA health failed');
  assert(list(health.operations).length === 0 || (Array.isArray(health.operations) && health.operations.includes('RegisterNewAppointment')), 'health does not advertise RegisterNewAppointment');

  const token = `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
  const happy = await certifyHappyPath(token);
  await certifySlotRace(token, happy.customerId);
  console.log(`MK0_REGISTER_NEW_APPOINTMENT_PASS ${JSON.stringify({ token, customerId: happy.customerId, firstAppointmentId: happy.appointmentId })}`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exitCode = 1;
});
