import assert from 'node:assert/strict';

const baseUrl = (process.env.ENGINES_WEBCHAT_URL ?? 'http://127.0.0.1:8790').replace(/\/$/, '');

type JsonRecord = Record<string, unknown>;

function record(value: unknown): JsonRecord | undefined {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as JsonRecord : undefined;
}

function list(value: unknown): JsonRecord[] {
  return Array.isArray(value) ? value.map((item) => record(item) ?? {}) : [];
}

async function request(path: string, init?: RequestInit): Promise<Readonly<{ status: number; body: JsonRecord }>> {
  const response = await fetch(baseUrl + path, init);
  const raw = await response.json() as unknown;
  return { status: response.status, body: record(raw) ?? {} };
}

async function json(path: string, init?: RequestInit): Promise<JsonRecord> {
  const response = await request(path, init);
  assert.ok(response.status >= 200 && response.status < 300, path + ' status=' + response.status + ' body=' + JSON.stringify(response.body));
  return response.body;
}

async function postEvent(
  conversationId: string,
  messageId: string,
  operation: string,
  data: JsonRecord = {},
): Promise<JsonRecord> {
  return json('/api/channel/events', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      conversationId,
      messageId,
      senderId: 'a2-browser',
      operation,
      data,
    }),
  });
}

async function postAgent(
  conversationId: string,
  messageId: string,
  text: string,
): Promise<JsonRecord> {
  return json('/api/agent/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      conversationId,
      messageId,
      senderId: 'a2-browser',
      text,
    }),
  });
}

async function conversationView(conversationId: string): Promise<JsonRecord> {
  return json('/api/channel/conversations/' + encodeURIComponent(conversationId) + '/view');
}

function durable(body: JsonRecord): JsonRecord {
  return record(body.state) ?? {};
}

async function waitFor(
  conversationId: string,
  predicate: (state: JsonRecord) => boolean,
  label: string,
): Promise<JsonRecord> {
  const deadline = Date.now() + 35_000;
  let last: JsonRecord | undefined;
  while (Date.now() < deadline) {
    const body = await conversationView(conversationId);
    last = body;
    if (predicate(durable(body))) return body;
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  throw new Error('AGENT_A2_TIMEOUT:' + label + ':' + JSON.stringify(last));
}

function interpretation(body: JsonRecord): JsonRecord {
  return record(body.interpretation) ?? {};
}

function proposedAction(body: JsonRecord): JsonRecord {
  return record(interpretation(body).proposedAction) ?? {};
}

function reply(body: JsonRecord): string {
  const value = body.reply;
  assert.equal(typeof value, 'string', 'agent reply missing');
  assert.ok(value.trim().length > 0, 'agent reply empty');
  assert.doesNotMatch(value, /SET_DATE|SELECT_SLOT|FINALIZE_APPOINTMENT|men_|off_|svc_|apt_|schedres_/i);
  return value;
}

async function main(): Promise<void> {
  const health = await json('/health');
  assert.equal(health.ok, true);
  assert.equal(health.channelCore, true);
  assert.equal(health.agent, true);
  assert.equal(health.mcp, false);

  const conversationId = 'a2-agent-' + Date.now();

  const start = await postEvent(conversationId, 'a2-start', 'START_APPOINTMENT');
  assert.equal(start.ok, true);
  assert.equal(typeof start.workflowId, 'string');

  await waitFor(conversationId, (state) => state.phase === 'WAITING_FOR_CUSTOMER', 'WAITING_FOR_CUSTOMER');

  await postEvent(conversationId, 'a2-customer', 'PROVIDE_CUSTOMER', {
    customerId: 'cus_me1_phys_unique',
  });

  let view = await waitFor(
    conversationId,
    (state) => state.phase === 'WAITING_FOR_MANAGED_ENTITY',
    'WAITING_FOR_MANAGED_ENTITY',
  );
  const candidates = list(record(durable(view).managedEntity)?.candidates);
  assert.ok(candidates.some((item) => item.managedEntityId === 'men_me1_phys_logan'), 'Logan candidate missing');

  await postEvent(conversationId, 'a2-managed-entity', 'SELECT_MANAGED_ENTITY', {
    managedEntityId: 'men_me1_phys_logan',
  });

  view = await waitFor(conversationId, (state) => state.phase === 'WAITING_FOR_SERVICE', 'WAITING_FOR_SERVICE');
  const services = list(durable(view).services);
  assert.equal(typeof services[0]?.serviceId, 'string', 'service missing');
  await postEvent(conversationId, 'a2-service', 'SELECT_SERVICE', {
    serviceId: services[0]!.serviceId,
  });

  view = await waitFor(conversationId, (state) => state.phase === 'WAITING_FOR_PRODUCT', 'WAITING_FOR_PRODUCT');
  const offerings = list(durable(view).products);
  assert.equal(typeof offerings[0]?.productId, 'string', 'offering missing');
  await postEvent(conversationId, 'a2-offering', 'SELECT_OFFERING', {
    productId: offerings[0]!.productId,
  });

  await waitFor(conversationId, (state) => state.phase === 'WAITING_FOR_DATE', 'WAITING_FOR_DATE');

  const date = await postAgent(conversationId, 'a2-agent-date', 'Mejor el viernes.');
  assert.equal(interpretation(date).kind, 'PROPOSE_ACTION');
  assert.equal(proposedAction(date).action, 'SET_DATE');
  const dateReply = reply(date);
  assert.match(dateReply, /horario|hora|disponib|elige|prefier/i, 'date narration must move conversation to slot choice');
  assert.doesNotMatch(dateReply, /basic clean|executive clean|limpieza/i, 'date narration reopened an already selected offering');

  view = await waitFor(conversationId, (state) => state.phase === 'WAITING_FOR_SLOT', 'WAITING_FOR_SLOT');
  const stateAfterDate = durable(view);
  assert.equal(typeof stateAfterDate.appointmentDate, 'string', 'appointment date not stored');
  const slots = list(stateAfterDate.availableSlots);
  assert.ok(slots.length > 0, 'slots missing after Agent SET_DATE');
  const chosen = slots[0]!;
  assert.equal(typeof chosen.start, 'string');

  const slot = await postAgent(
    conversationId,
    'a2-agent-slot',
    'A las ' + String(chosen.start) + '.',
  );
  assert.equal(interpretation(slot).kind, 'PROPOSE_ACTION');
  assert.equal(proposedAction(slot).action, 'SELECT_SLOT');
  assert.equal(record(proposedAction(slot).arguments)?.slotStart, chosen.start);
  const slotReply = reply(slot);
  assert.match(slotReply, /confirm|cita|reserva/i, 'slot narration must move conversation to confirmation');
  assert.doesNotMatch(slotReply, /basic clean|executive clean|limpieza/i, 'slot narration reopened an already selected offering');

  await waitFor(conversationId, (state) => state.phase === 'READY_TO_FINALIZE', 'READY_TO_FINALIZE');

  const finalize = await postAgent(conversationId, 'a2-agent-finalize', 'Sí, confirma.');
  assert.equal(interpretation(finalize).kind, 'PROPOSE_ACTION');
  assert.equal(proposedAction(finalize).action, 'FINALIZE_APPOINTMENT');
  const finalReply = reply(finalize);
  assert.match(finalReply, /confirmad|reservad|agendad|cread|lista/i, 'terminal narration must state confirmed completion');
  assert.doesNotMatch(finalReply, /confirmemos|quieres confirmar|deseas confirmar/i, 'terminal narration asked to confirm an already created appointment');

  view = await waitFor(
    conversationId,
    (state) => state.phase === 'CREATED' && state.workflowStatus === 'COMPLETED',
    'CREATED',
  );
  const terminal = durable(view);
  const result = record(terminal.result);
  assert.ok(result);
  assert.equal(result.managedEntityId, 'men_me1_phys_logan');
  assert.equal(typeof result.appointmentId, 'string');
  assert.equal(typeof result.schedulerReservationId, 'string');
  assert.equal(result.resourceReservationId, undefined);

  console.log('AGENT_A2_WEBCHAT_CHANNEL_PASS');
  console.log('AGENT_A2_LOCAL_MODEL_ENGINE_ACTION_PASS');
  console.log('AGENT_A2_TEMPORAL_DURABLE_STATE_PASS');
  console.log('AGENT_A2_SCHEDULER_RESERVATION_PASS');
  console.log('AGENT_A2_NATURAL_REPLY_PASS');
  console.log(JSON.stringify({
    conversationId,
    workflowId: view.workflowId,
    appointmentId: result.appointmentId,
    schedulerReservationId: result.schedulerReservationId,
    dateReply,
    slotReply,
    finalReply,
    appointmentDate: result.appointmentDate,
    slot: result.slot,
  }));
  console.log('AGENT_A2_INTEGRATED_JOURNEY_PASS');
}

main().catch((error: unknown) => {
  console.error('AGENT_A2_INTEGRATED_JOURNEY_FAILED ' + (error instanceof Error ? error.stack ?? error.message : String(error)));
  process.exitCode = 1;
});
