import { createHash, randomUUID } from 'node:crypto';
import { Pool, type PoolClient } from 'pg';
import { loadRuntimeConfig } from '../../config/runtime-config.js';
import {
  todayInTimeZone,
  type AppointmentProduct,
  type AppointmentService,
  type AppointmentSlot,
  type RegisterNewAppointmentStartEnvelope,
} from '../../contracts/register-new-appointment/index.js';
import {
  canonicalJson,
  normalizeCustomerDraft,
  type CustomerDraft,
} from '../../contracts/register-new-customer/index.js';

let pool: Pool | undefined;

function db(): Pool {
  pool ??= new Pool({ connectionString: loadRuntimeConfig().postgresUrl, max: 8 });
  return pool;
}

function sha256(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

function startFingerprint(start: RegisterNewAppointmentStartEnvelope): string {
  return sha256(canonicalJson({
    operation: start.operation,
    businessSlug: start.businessSlug,
    schemaVersion: start.schemaVersion,
    draft: start.draft ?? {},
  }));
}

function idempotencyHash(start: RegisterNewAppointmentStartEnvelope): string {
  return sha256(start.request.idempotencyKey);
}

export type ReserveAppointmentCommandResult =
  | Readonly<{ kind: 'RESERVED' | 'REPLAY'; appointmentCommandId: string; appointmentId?: string }>
  | Readonly<{ kind: 'CONFLICT'; appointmentCommandId: string }>;

export type ResolveAppointmentCustomerResult =
  | Readonly<{ kind: 'EXISTING'; customerId: string }>
  | Readonly<{ kind: 'NONE' }>
  | Readonly<{ kind: 'AMBIGUOUS'; candidateCustomerIds: readonly string[] }>;

export type BookAppointmentInput = Readonly<{
  appointmentCommandId: string;
  workflowId: string;
  businessSlug: string;
  customerId: string;
  serviceId: string;
  productId: string;
  appointmentDate: string;
  slotStart: string;
  timezone?: string;
}>;

export type AppointmentRecord = Readonly<{
  appointmentId: string;
  customerId: string;
  serviceId: string;
  productId: string;
  appointmentDate: string;
  slot: AppointmentSlot;
}>;

export type BookAppointmentResult =
  | Readonly<{ kind: 'BOOKED'; appointment: AppointmentRecord; replay: boolean }>
  | Readonly<{ kind: 'SLOT_CONFLICT'; availableSlots: readonly AppointmentSlot[] }>;

function normalizeDate(value: unknown): string {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
}

function normalizeTime(value: unknown): string {
  return String(value).slice(0, 5);
}

function minutesFromTime(value: string): number {
  const [hour, minute] = value.split(':').map(Number);
  return (hour ?? 0) * 60 + (minute ?? 0);
}

function timeFromMinutes(value: number): string {
  const hour = Math.floor(value / 60);
  const minute = value % 60;
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

function weekday(date: string): number {
  const [year, month, day] = date.split('-').map(Number);
  return new Date(Date.UTC(year!, month! - 1, day!)).getUTCDay();
}

async function commandByIdentity(
  client: PoolClient,
  start: RegisterNewAppointmentStartEnvelope,
): Promise<Readonly<{
  appointment_command_id: string;
  command_fingerprint: string;
  status: 'RESERVED' | 'BOOKED';
  appointment_id: string | null;
}>> {
  const result = await client.query<{
    appointment_command_id: string;
    command_fingerprint: string;
    status: 'RESERVED' | 'BOOKED';
    appointment_id: string | null;
  }>(
    `SELECT appointment_command_id, command_fingerprint, status, appointment_id
       FROM appointment_commands
      WHERE operation = $1 AND business_slug = $2 AND idempotency_key_hash = $3`,
    [start.operation, start.businessSlug, idempotencyHash(start)],
  );
  const row = result.rows[0];
  if (!row) throw new Error('appointment command disappeared after reservation attempt');
  return row;
}

export async function reserveAppointmentCommand(
  start: RegisterNewAppointmentStartEnvelope,
  workflowId: string,
): Promise<ReserveAppointmentCommandResult> {
  const client = await db().connect();
  const commandId = `apc_${randomUUID()}`;
  const fingerprint = startFingerprint(start);
  try {
    await client.query('BEGIN');
    const inserted = await client.query<{
      appointment_command_id: string;
      command_fingerprint: string;
      status: 'RESERVED' | 'BOOKED';
      appointment_id: string | null;
    }>(
      `INSERT INTO appointment_commands (
         appointment_command_id, operation, business_slug, idempotency_key_hash,
         command_fingerprint, workflow_id, status
       ) VALUES ($1, $2, $3, $4, $5, $6, 'RESERVED')
       ON CONFLICT (operation, business_slug, idempotency_key_hash) DO NOTHING
       RETURNING appointment_command_id, command_fingerprint, status, appointment_id`,
      [commandId, start.operation, start.businessSlug, idempotencyHash(start), fingerprint, workflowId],
    );
    const row = inserted.rows[0] ?? await commandByIdentity(client, start);
    await client.query('COMMIT');

    if (row.command_fingerprint !== fingerprint) {
      return { kind: 'CONFLICT', appointmentCommandId: row.appointment_command_id };
    }
    return {
      kind: inserted.rowCount === 1 ? 'RESERVED' : 'REPLAY',
      appointmentCommandId: row.appointment_command_id,
      ...(row.appointment_id ? { appointmentId: row.appointment_id } : {}),
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function customerExists(businessSlug: string, customerId: string): Promise<boolean> {
  const result = await db().query(
    `SELECT 1 FROM customers WHERE business_slug = $1 AND customer_id = $2 AND status = 'ACTIVE'`,
    [businessSlug, customerId],
  );
  return (result.rowCount ?? 0) > 0;
}

export async function resolveAppointmentCustomer(
  businessSlug: string,
  customerId: string | undefined,
  rawCustomer: CustomerDraft | undefined,
): Promise<ResolveAppointmentCustomerResult> {
  if (customerId) {
    return await customerExists(businessSlug, customerId)
      ? { kind: 'EXISTING', customerId }
      : { kind: 'NONE' };
  }

  const customer = normalizeCustomerDraft(rawCustomer);
  const document = customer.document;
  if (document?.type && document.country && document.value) {
    const result = await db().query<{ customer_id: string }>(
      `SELECT customer_id
         FROM customer_documents
        WHERE business_slug = $1 AND document_type = $2 AND country = $3 AND document_value = $4
        ORDER BY customer_id`,
      [businessSlug, document.type, document.country, document.value],
    );
    if (result.rows.length === 1) return { kind: 'EXISTING', customerId: result.rows[0]!.customer_id };
    if (result.rows.length > 1) return { kind: 'AMBIGUOUS', candidateCustomerIds: result.rows.map((row) => row.customer_id) };
  }

  const candidates = new Set<string>();
  if (customer.contact?.email) {
    const result = await db().query<{ customer_id: string }>(
      `SELECT customer_id FROM customer_contacts WHERE business_slug = $1 AND email_normalized = $2`,
      [businessSlug, customer.contact.email],
    );
    for (const row of result.rows) candidates.add(row.customer_id);
  }
  const phones = (customer.contact?.phones ?? [])
    .map((phone) => phone.normalized)
    .filter((value): value is string => Boolean(value));
  if (phones.length > 0) {
    const result = await db().query<{ customer_id: string }>(
      `SELECT DISTINCT customer_id
         FROM customer_phones
        WHERE business_slug = $1 AND normalized = ANY($2::text[])`,
      [businessSlug, phones],
    );
    for (const row of result.rows) candidates.add(row.customer_id);
  }

  if (candidates.size === 1) return { kind: 'EXISTING', customerId: [...candidates][0]! };
  if (candidates.size > 1) return { kind: 'AMBIGUOUS', candidateCustomerIds: [...candidates].sort() };
  return { kind: 'NONE' };
}

export async function listAppointmentServices(businessSlug: string): Promise<readonly AppointmentService[]> {
  const result = await db().query<{
    service_id: string;
    service_code: string;
    service_name: string;
  }>(
    `SELECT service_id, service_code, service_name
       FROM service_catalog
      WHERE business_slug = $1 AND active = TRUE
      ORDER BY service_name, service_id`,
    [businessSlug],
  );
  return result.rows.map((row) => ({
    serviceId: row.service_id,
    code: row.service_code,
    name: row.service_name,
  }));
}

export async function listAppointmentProducts(
  businessSlug: string,
  serviceId: string,
): Promise<readonly AppointmentProduct[]> {
  const result = await db().query<{
    product_id: string;
    service_id: string;
    product_code: string;
    product_name: string;
    description: string | null;
    duration_minutes: number;
  }>(
    `SELECT product_id, service_id, product_code, product_name, description, duration_minutes
       FROM service_products
      WHERE business_slug = $1 AND service_id = $2 AND active = TRUE
      ORDER BY product_name, product_id`,
    [businessSlug, serviceId],
  );
  return result.rows.map((row) => ({
    productId: row.product_id,
    serviceId: row.service_id,
    code: row.product_code,
    name: row.product_name,
    ...(row.description ? { description: row.description } : {}),
    durationMinutes: row.duration_minutes,
  }));
}

async function slotsWithClient(
  client: PoolClient,
  businessSlug: string,
  productId: string,
  appointmentDate: string,
): Promise<readonly AppointmentSlot[]> {
  const ruleResult = await client.query<{
    opens_at: string;
    closes_at: string;
    slot_minutes: number;
    resource_key: string;
    duration_minutes: number;
  }>(
    `SELECT r.opens_at::text, r.closes_at::text, r.slot_minutes, r.resource_key, p.duration_minutes
       FROM service_availability_rules r
       JOIN service_products p ON p.product_id = r.product_id
      WHERE r.business_slug = $1
        AND r.product_id = $2
        AND r.weekday = $3
        AND r.active = TRUE
        AND p.active = TRUE
      LIMIT 1`,
    [businessSlug, productId, weekday(appointmentDate)],
  );
  const rule = ruleResult.rows[0];
  if (!rule) return [];

  const occupiedResult = await client.query<{ start_time: string }>(
    `SELECT start_time::text
       FROM appointments
      WHERE business_slug = $1
        AND resource_key = $2
        AND appointment_date = $3::date
        AND status = 'BOOKED'`,
    [businessSlug, rule.resource_key, appointmentDate],
  );
  const occupied = new Set(occupiedResult.rows.map((row) => normalizeTime(row.start_time)));

  const opening = minutesFromTime(rule.opens_at);
  const closing = minutesFromTime(rule.closes_at);
  const slots: AppointmentSlot[] = [];
  for (let start = opening; start + rule.duration_minutes <= closing; start += rule.slot_minutes) {
    const startText = timeFromMinutes(start);
    if (occupied.has(startText)) continue;
    slots.push({
      start: startText,
      end: timeFromMinutes(start + rule.duration_minutes),
      durationMinutes: rule.duration_minutes,
    });
  }
  return slots;
}

export async function listAppointmentSlots(
  businessSlug: string,
  productId: string,
  appointmentDate: string,
): Promise<readonly AppointmentSlot[]> {
  const client = await db().connect();
  try {
    return await slotsWithClient(client, businessSlug, productId, appointmentDate);
  } finally {
    client.release();
  }
}

async function appointmentById(client: PoolClient, appointmentId: string): Promise<AppointmentRecord | undefined> {
  const result = await client.query<{
    appointment_id: string;
    customer_id: string;
    service_id: string;
    product_id: string;
    appointment_date: Date | string;
    start_time: string;
    end_time: string;
  }>(
    `SELECT appointment_id, customer_id, service_id, product_id, appointment_date,
            start_time::text, end_time::text
       FROM appointments
      WHERE appointment_id = $1`,
    [appointmentId],
  );
  const row = result.rows[0];
  if (!row) return undefined;
  const start = normalizeTime(row.start_time);
  const end = normalizeTime(row.end_time);
  return {
    appointmentId: row.appointment_id,
    customerId: row.customer_id,
    serviceId: row.service_id,
    productId: row.product_id,
    appointmentDate: normalizeDate(row.appointment_date),
    slot: { start, end, durationMinutes: minutesFromTime(end) - minutesFromTime(start) },
  };
}

export async function getAppointmentById(appointmentId: string): Promise<AppointmentRecord | undefined> {
  const client = await db().connect();
  try {
    return await appointmentById(client, appointmentId);
  } finally {
    client.release();
  }
}

export async function bookAppointment(input: BookAppointmentInput): Promise<BookAppointmentResult> {
  const client = await db().connect();
  try {
    await client.query('BEGIN');
    const commandResult = await client.query<{
      status: 'RESERVED' | 'BOOKED';
      appointment_id: string | null;
    }>(
      `SELECT status, appointment_id
         FROM appointment_commands
        WHERE appointment_command_id = $1 AND business_slug = $2
        FOR UPDATE`,
      [input.appointmentCommandId, input.businessSlug],
    );
    const command = commandResult.rows[0];
    if (!command) throw new Error('APPOINTMENT_COMMAND_NOT_FOUND');

    if (command.status === 'BOOKED' && command.appointment_id) {
      const existing = await appointmentById(client, command.appointment_id);
      if (!existing) throw new Error('APPOINTMENT_BOOKED_COMMAND_WITHOUT_APPOINTMENT');
      await client.query('COMMIT');
      return { kind: 'BOOKED', appointment: existing, replay: true };
    }

    if (input.appointmentDate < todayInTimeZone(input.timezone ?? 'America/Lima')) {
      throw new Error(`PAST_DATE:${input.appointmentDate}`);
    }

    const customerOk = await client.query(
      `SELECT 1 FROM customers WHERE business_slug = $1 AND customer_id = $2 AND status = 'ACTIVE'`,
      [input.businessSlug, input.customerId],
    );
    if ((customerOk.rowCount ?? 0) === 0) throw new Error('CUSTOMER_NOT_FOUND');

    const productOk = await client.query(
      `SELECT 1
         FROM service_products p
         JOIN service_catalog s ON s.service_id = p.service_id
        WHERE p.business_slug = $1
          AND p.product_id = $2
          AND p.service_id = $3
          AND p.active = TRUE
          AND s.active = TRUE`,
      [input.businessSlug, input.productId, input.serviceId],
    );
    if ((productOk.rowCount ?? 0) === 0) throw new Error('PRODUCT_SERVICE_MISMATCH');

    const available = await slotsWithClient(client, input.businessSlug, input.productId, input.appointmentDate);
    const selected = available.find((slot) => slot.start === input.slotStart);
    if (!selected) {
      await client.query('ROLLBACK');
      return { kind: 'SLOT_CONFLICT', availableSlots: available };
    }

    const appointmentId = `apt_${randomUUID()}`;
    try {
      await client.query(
        `INSERT INTO appointments (
           appointment_id, business_slug, workflow_id, customer_id, service_id, product_id,
           appointment_date, start_time, end_time, timezone, resource_key, status
         )
         SELECT $1, $2, $3, $4, $5, $6, $7::date, $8::time, $9::time, $10, r.resource_key, 'BOOKED'
           FROM service_availability_rules r
          WHERE r.business_slug = $2
            AND r.product_id = $6
            AND r.weekday = $11
            AND r.active = TRUE
          LIMIT 1`,
        [
          appointmentId,
          input.businessSlug,
          input.workflowId,
          input.customerId,
          input.serviceId,
          input.productId,
          input.appointmentDate,
          selected.start,
          selected.end,
          input.timezone ?? 'America/Lima',
          weekday(input.appointmentDate),
        ],
      );
    } catch (error) {
      const pgError = error as { code?: string };
      if (pgError.code === '23505') {
        await client.query('ROLLBACK');
        return {
          kind: 'SLOT_CONFLICT',
          availableSlots: await listAppointmentSlots(input.businessSlug, input.productId, input.appointmentDate),
        };
      }
      throw error;
    }

    await client.query(
      `UPDATE appointment_commands
          SET status = 'BOOKED', appointment_id = $2, updated_at = NOW()
        WHERE appointment_command_id = $1`,
      [input.appointmentCommandId, appointmentId],
    );
    await client.query('COMMIT');

    return {
      kind: 'BOOKED',
      replay: false,
      appointment: {
        appointmentId,
        customerId: input.customerId,
        serviceId: input.serviceId,
        productId: input.productId,
        appointmentDate: input.appointmentDate,
        slot: selected,
      },
    };
  } catch (error) {
    try { await client.query('ROLLBACK'); } catch { /* already closed/rolled back */ }
    throw error;
  } finally {
    client.release();
  }
}

export async function closeAppointmentRepository(): Promise<void> {
  const current = pool;
  pool = undefined;
  if (current) await current.end();
}
