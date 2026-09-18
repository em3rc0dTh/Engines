import { Pool } from 'pg';

const baseUrl = (process.env.ENGINES_WEBCHAT_URL ?? 'http://127.0.0.1:8790').replace(/\/$/, '');
const postgresUrl = process.env.POSTGRES_URL ?? 'postgresql://engines:engines@127.0.0.1:5432/engines_mk0';
const businessSlug = 'golden-business';

type JsonRecord = Record<string, unknown>;
type HttpResult = Readonly<{ status: number; body: JsonRecord }>;

function record(value: unknown): JsonRecord | undefined {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as JsonRecord : undefined;
}

function list(value: unknown): JsonRecord[] {
  return Array.isArray(value) ? value.map((item) => record(item) ?? {}) : [];
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`PLATFORM_M2_ASSERTION_FAILED:${message}`);
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

async function postEvent(
  conversationId: string,
  messageId: string,
  operation: string,
  data: JsonRecord = {},
): Promise<HttpResult> {
  return request('/api/channel/events', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      conversationId,
      messageId,
      senderId: 'platform-m2-certification',
      operation,
      data,
    }),
  });
}

function durable(body: JsonRecord): JsonRecord {
  return record(body.state) ?? {};
}

function customerDraft(state: JsonRecord): JsonRecord {
  return record(record(state.customer)?.customer) ?? {};
}

function success(response: HttpResult, label: string): JsonRecord {
  assert(response.status >= 200 && response.status < 300, `${label} status=${response.status} body=${JSON.stringify(response.body)}`);
  assert(response.body.ok === true, `${label} not ok`);
  return response.body;
}

function rejected(response: HttpResult, code: string, label: string): JsonRecord {
  assert(response.status === 422, `${label} expected 422, got ${response.status}: ${JSON.stringify(response.body)}`);
  assert(response.body.ok === false, `${label} unexpectedly ok`);
  assert(response.body.code === code, `${label} code=${String(response.body.code)} expected=${code}`);
  return response.body;
}

async function conversationView(conversationId: string): Promise<JsonRecord> {
  return json(`/api/channel/conversations/${encodeURIComponent(conversationId)}/view`);
}

async function waitFor(
  conversationId: string,
  predicate: (state: JsonRecord) => boolean,
  label: string,
): Promise<JsonRecord> {
  const deadline = Date.now() + 30_000;
  let last: JsonRecord | undefined;
  while (Date.now() < deadline) {
    const body = await conversationView(conversationId);
    last = body;
    if (predicate(durable(body))) return body;
    await new Promise((resolve) => setTimeout(resolve, 120));
  }
  throw new Error(`PLATFORM_M2_TIMEOUT:${label}:${JSON.stringify(last)}`);
}

function futureBusinessDate(daysAhead = 2): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Lima',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(Date.now() + daysAhead * 24 * 60 * 60 * 1000));
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value ?? '';
  return `${part('year')}-${part('month')}-${part('day')}`;
}

async function count(pool: Pool, sql: string, params: unknown[]): Promise<number> {
  const result = await pool.query<{ count: string }>(sql, params);
  return Number(result.rows[0]?.count ?? 0);
}

async function main(): Promise<void> {
  const health = await json('/health');
  assert(health.ok === true && health.channelCore === true, 'WebChat/channel health not ready');

  const token = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const conversationId = `m2-conversation-${token}`;
  const email = `m2-${token.replace(/[^a-zA-Z0-9]/g, '')}@example.test`;
  const localPhone = `9${String(Date.now()).slice(-8)}`;
  const normalizedPhone = `51${localPhone}`;
  const pool = new Pool({ connectionString: postgresUrl, max: 2 });

  try {
    const start = success(await postEvent(conversationId, `m2-start-${token}`, 'START_APPOINTMENT'), 'start');
    assert(typeof start.workflowId === 'string', 'workflowId missing');
    const workflowId = String(start.workflowId);

    let body = await waitFor(conversationId, (state) => state.phase === 'WAITING_FOR_CUSTOMER', 'WAITING_FOR_CUSTOMER');
    assert(body.workflowId === workflowId, 'initial conversation binding mismatch');

    success(await postEvent(conversationId, `m2-name-${token}`, 'PROVIDE_CUSTOMER', {
      customerPatch: { name: 'Platform M2 Customer' },
    }), 'valid name');

    const invalidEmailId = `m2-invalid-email-${token}`;
    const invalidEmailPayload = { customerPatch: { contact: { email: 'not-an-email' } } };
    rejected(await postEvent(conversationId, invalidEmailId, 'PROVIDE_CUSTOMER', invalidEmailPayload), 'CHANNEL_EVENT_INVALID', 'invalid email');
    const invalidEmailReplay = rejected(
      await postEvent(conversationId, invalidEmailId, 'PROVIDE_CUSTOMER', invalidEmailPayload),
      'CHANNEL_EVENT_INVALID',
      'invalid email replay',
    );
    assert(invalidEmailReplay.replayed === true, 'rejected email replay not served from durable ledger');

    const emailConflict = await postEvent(conversationId, invalidEmailId, 'PROVIDE_CUSTOMER', {
      customerPatch: { contact: { email } },
    });
    assert(emailConflict.status === 409, `invalid-email identity conflict status=${emailConflict.status}`);
    assert(emailConflict.body.code === 'CHANNEL_EVENT_IDENTITY_CONFLICT', 'invalid-email identity conflict code mismatch');

    body = await conversationView(conversationId);
    assert(body.workflowId === workflowId, 'invalid email changed workflowId');
    assert(durable(body).phase === 'WAITING_FOR_CUSTOMER', 'invalid email advanced workflow phase');
    const afterBadEmail = record(customerDraft(durable(body)).contact) ?? {};
    assert(afterBadEmail.email === undefined, 'invalid email entered durable state');
    console.log('PLATFORM_M2_INVALID_EMAIL_REJECTION_PASS');

    success(await postEvent(conversationId, `m2-valid-email-${token}`, 'PROVIDE_CUSTOMER', {
      customerPatch: { contact: { email } },
    }), 'valid email correction');

    const invalidPhoneId = `m2-invalid-phone-${token}`;
    const invalidPhonePayload = {
      customerPatch: {
        contact: {
          phones: [{ number: 'abc123', normalized: 'abc123', primary: true }],
        },
      },
    };
    rejected(await postEvent(conversationId, invalidPhoneId, 'PROVIDE_CUSTOMER', invalidPhonePayload), 'CHANNEL_EVENT_INVALID', 'invalid phone');
    const invalidPhoneReplay = rejected(
      await postEvent(conversationId, invalidPhoneId, 'PROVIDE_CUSTOMER', invalidPhonePayload),
      'CHANNEL_EVENT_INVALID',
      'invalid phone replay',
    );
    assert(invalidPhoneReplay.replayed === true, 'rejected phone replay not served from durable ledger');

    body = await conversationView(conversationId);
    assert(body.workflowId === workflowId, 'invalid phone changed workflowId');
    assert(durable(body).phase === 'WAITING_FOR_CUSTOMER', 'invalid phone advanced workflow phase');
    const afterBadPhone = record(customerDraft(durable(body)).contact) ?? {};
    assert(afterBadPhone.email === email, 'valid email lost after invalid phone');
    assert(!Array.isArray(afterBadPhone.phones) || (afterBadPhone.phones as unknown[]).length === 0, 'invalid phone entered durable state');
    console.log('PLATFORM_M2_INVALID_PHONE_REJECTION_PASS');

    success(await postEvent(conversationId, `m2-valid-phone-${token}`, 'PROVIDE_CUSTOMER', {
      customerPatch: {
        contact: {
          phones: [{ number: `+51 ${localPhone}`, normalized: normalizedPhone, primary: true }],
        },
      },
    }), 'valid phone correction');
    success(await postEvent(conversationId, `m2-resolve-${token}`, 'RESOLVE_CUSTOMER'), 'resolve customer');

    body = await waitFor(conversationId, (state) => state.phase === 'WAITING_FOR_SERVICE', 'WAITING_FOR_SERVICE');
    assert(body.workflowId === workflowId, 'corrected customer flow changed workflowId');
    const services = list(durable(body).services);
    assert(typeof services[0]?.serviceId === 'string', 'services missing');
    success(await postEvent(conversationId, `m2-service-${token}`, 'SELECT_SERVICE', {
      serviceId: services[0]!.serviceId,
    }), 'select service');

    body = await waitFor(conversationId, (state) => state.phase === 'WAITING_FOR_PRODUCT', 'WAITING_FOR_PRODUCT');
    const products = list(durable(body).products);
    assert(typeof products[0]?.productId === 'string', 'products missing');
    success(await postEvent(conversationId, `m2-product-${token}`, 'SELECT_OFFERING', {
      productId: products[0]!.productId,
    }), 'select offering');

    await waitFor(conversationId, (state) => state.phase === 'WAITING_FOR_DATE', 'WAITING_FOR_DATE');
    const invalidDateId = `m2-invalid-date-${token}`;
    const invalidDatePayload = { dateInput: '2026-99-99' };
    rejected(await postEvent(conversationId, invalidDateId, 'SET_DATE', invalidDatePayload), 'INVALID_DATE', 'invalid date');
    const invalidDateReplay = rejected(
      await postEvent(conversationId, invalidDateId, 'SET_DATE', invalidDatePayload),
      'INVALID_DATE',
      'invalid date replay',
    );
    assert(invalidDateReplay.replayed === true, 'rejected date replay not served from durable ledger');

    body = await conversationView(conversationId);
    assert(body.workflowId === workflowId, 'invalid date changed workflowId');
    assert(durable(body).phase === 'WAITING_FOR_DATE', 'invalid date advanced workflow phase');
    assert(durable(body).appointmentDate === undefined, 'invalid date entered durable state');
    console.log('PLATFORM_M2_INVALID_DATE_REJECTION_PASS');

    const validDate = futureBusinessDate(2);
    success(await postEvent(conversationId, `m2-valid-date-${token}`, 'SET_DATE', { dateInput: validDate }), 'valid date correction');

    body = await waitFor(conversationId, (state) => state.phase === 'WAITING_FOR_SLOT', 'WAITING_FOR_SLOT');
    assert(body.workflowId === workflowId, 'valid corrections changed workflowId');
    const slots = list(durable(body).availableSlots);
    assert(typeof slots[0]?.start === 'string', 'available slots missing after corrected date');
    success(await postEvent(conversationId, `m2-slot-${token}`, 'SELECT_SLOT', { slotStart: slots[0]!.start }), 'select slot');

    body = await waitFor(conversationId, (state) => state.phase === 'READY_TO_FINALIZE', 'READY_TO_FINALIZE');
    assert(body.workflowId === workflowId, 'workflow identity changed before finalize');
    assert(await count(pool, 'SELECT COUNT(*)::text AS count FROM appointments WHERE workflow_id = $1', [workflowId]) === 0, 'appointment persisted before explicit finalize');
    console.log('PLATFORM_M2_CORRECTION_CONTINUITY_PASS');

    const finalizeId = `m2-finalize-${token}`;
    const finalize = success(await postEvent(conversationId, finalizeId, 'FINALIZE_APPOINTMENT'), 'finalize');
    assert(finalize.replayed === false, 'first finalize unexpectedly replayed');

    body = await waitFor(
      conversationId,
      (state) => state.phase === 'CREATED' && state.workflowStatus === 'COMPLETED',
      'CREATED',
    );
    assert(body.workflowId === workflowId, 'terminal workflow identity changed');
    const terminal = durable(body);
    const result = record(terminal.result) ?? {};
    assert(typeof result.appointmentId === 'string', 'terminal appointmentId missing');
    assert(typeof result.schedulerReservationId === 'string', 'terminal schedulerReservationId missing');
    assert(Array.isArray(terminal.issues) && (terminal.issues as unknown[]).length === 0, 'terminal issues present');

    const replayFinalize = success(await postEvent(conversationId, finalizeId, 'FINALIZE_APPOINTMENT'), 'finalize replay');
    assert(replayFinalize.replayed === true, 'terminal exact replay not served from durable ledger');
    assert(replayFinalize.workflowId === workflowId, 'terminal replay workflow mismatch');

    const appointmentId = String(result.appointmentId);
    const reservationId = String(result.schedulerReservationId);
    const invalidIds = [invalidEmailId, invalidPhoneId, invalidDateId];

    assert(await count(pool, 'SELECT COUNT(*)::text AS count FROM channel_conversation_bindings WHERE business_slug = $1 AND channel = $2 AND external_conversation_id = $3 AND workflow_id = $4', [businessSlug, 'WEBCHAT', conversationId, workflowId]) === 1, 'durable conversation binding duplicated or changed');
    assert(await count(pool, 'SELECT COUNT(*)::text AS count FROM appointments WHERE workflow_id = $1 AND appointment_id = $2', [workflowId, appointmentId]) === 1, 'appointment durable effect duplicated');
    assert(await count(pool, 'SELECT COUNT(*)::text AS count FROM appointment_commands WHERE workflow_id = $1', [workflowId]) === 1, 'appointment command duplicated');
    assert(await count(pool, 'SELECT COUNT(*)::text AS count FROM scheduler_reservations WHERE reservation_id = $1', [reservationId]) === 1, 'scheduler reservation duplicated');
    assert(await count(pool, 'SELECT COUNT(*)::text AS count FROM customer_contacts WHERE business_slug = $1 AND email_normalized = $2', [businessSlug, email]) === 1, 'customer durable identity duplicated');
    assert(await count(pool, 'SELECT COUNT(*)::text AS count FROM channel_inbound_events WHERE business_slug = $1 AND channel = $2 AND external_message_id = ANY($3::text[]) AND status = $4', [businessSlug, 'WEBCHAT', invalidIds, 'REJECTED']) === 3, 'invalid events were not durably rejected exactly once');

    const afterReplay = await conversationView(conversationId);
    const afterReplayResult = record(durable(afterReplay).result) ?? {};
    assert(afterReplay.workflowId === workflowId, 'terminal refresh changed workflowId');
    assert(afterReplayResult.appointmentId === appointmentId, 'terminal refresh changed appointmentId');
    assert(afterReplayResult.schedulerReservationId === reservationId, 'terminal refresh changed schedulerReservationId');

    console.log('PLATFORM_M2_NO_DUPLICATE_DURABLE_EFFECT_PASS');
    console.log('PLATFORM_M2_INVALID_INPUT_RECOVERY_PASS', JSON.stringify({
      workflowId,
      invalidEmailRejected: true,
      invalidPhoneRejected: true,
      invalidDateRejected: true,
      rejectedReplayStable: true,
      identityConflictProtected: true,
      correctionContinuity: true,
      appointmentCount: 1,
      schedulerReservationCount: 1,
      customerIdentityCount: 1,
    }));
  } finally {
    await pool.end();
  }
}

main().catch((error: unknown) => {
  console.error(`PLATFORM_M2_INVALID_INPUT_RECOVERY_FAILED ${error instanceof Error ? error.stack ?? error.message : String(error)}`);
  process.exitCode = 1;
});
