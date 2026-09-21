import { createHash, randomUUID } from 'node:crypto';
import { Pool, type PoolClient } from 'pg';
import {
  normalizeCustomerDraft,
  serializeInitialStartFingerprintMaterial,
  type CustomerDraft,
  type RegisterNewCustomerStartEnvelope,
  type RegistrationPolicy,
} from '../../contracts/register-new-customer/index.js';
import { loadRuntimeConfig } from '../../config/runtime-config.js';
import type {
  CheckDuplicateResult,
  CreateCustomerResult,
  RegistrationCommandStatus,
  ReserveRegistrationResult,
} from '../../orchestration/temporal/activities/postgres-registration.types.js';

const DOCUMENT_SELECTOR =
  'customer.document.type+customer.document.country+customer.document.value' as const;
const PHONE_SELECTOR = 'customer.contact.phones[].normalized' as const;
const EMAIL_SELECTOR = 'customer.contact.email' as const;

let pool: Pool | undefined;

function db(): Pool {
  pool ??= new Pool({ connectionString: loadRuntimeConfig().postgresUrl, max: 8 });
  return pool;
}

function sha256(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

function completeDocument(customer: CustomerDraft) {
  const document = customer.document;
  if (!document?.type || !document.country || !document.value) return undefined;
  return { type: document.type, country: document.country, value: document.value };
}

export function registrationIdentityHash(start: RegisterNewCustomerStartEnvelope): string {
  return sha256(start.request.idempotencyKey);
}

export function initialStartFingerprintHash(start: RegisterNewCustomerStartEnvelope): string {
  return sha256(serializeInitialStartFingerprintMaterial(start));
}

type RegistrationRow = Readonly<{
  registration_id: string;
  command_fingerprint: string;
  workflow_id: string;
  customer_id: string | null;
  status: RegistrationCommandStatus;
}>;

async function registrationByIdentity(
  client: PoolClient,
  start: RegisterNewCustomerStartEnvelope,
  idempotencyKeyHash: string,
): Promise<RegistrationRow> {
  const result = await client.query<RegistrationRow>(
    `SELECT registration_id, command_fingerprint, workflow_id, customer_id, status
       FROM registration_commands
      WHERE operation = $1 AND business_slug = $2 AND idempotency_key_hash = $3`,
    [start.operation, start.businessSlug, idempotencyKeyHash],
  );
  const row = result.rows[0];
  if (!row) throw new Error('registration command disappeared after reservation attempt');
  return row;
}

export async function reserveRegistration(
  start: RegisterNewCustomerStartEnvelope,
  workflowId: string,
): Promise<ReserveRegistrationResult> {
  const client = await db().connect();
  const registrationId = `reg_${randomUUID()}`;
  const idempotencyKeyHash = registrationIdentityHash(start);
  const commandFingerprint = initialStartFingerprintHash(start);

  try {
    await client.query('BEGIN');
    const inserted = await client.query<RegistrationRow>(
      `INSERT INTO registration_commands (
         registration_id, operation, business_slug, idempotency_key_hash,
         command_fingerprint, workflow_id, status
       ) VALUES ($1, $2, $3, $4, $5, $6, 'RESERVED')
       ON CONFLICT (operation, business_slug, idempotency_key_hash) DO NOTHING
       RETURNING registration_id, command_fingerprint, workflow_id, customer_id, status`,
      [
        registrationId,
        start.operation,
        start.businessSlug,
        idempotencyKeyHash,
        commandFingerprint,
        workflowId,
      ],
    );

    const row = inserted.rows[0] ?? (await registrationByIdentity(client, start, idempotencyKeyHash));
    await client.query('COMMIT');

    if (row.command_fingerprint !== commandFingerprint) {
      return {
        kind: 'CONFLICT',
        registrationId: row.registration_id,
        workflowId: row.workflow_id,
        status: row.status,
      };
    }

    if (inserted.rowCount === 1) {
      return {
        kind: 'RESERVED',
        registrationId: row.registration_id,
        workflowId: row.workflow_id,
        status: row.status,
      };
    }

    return {
      kind: 'REPLAY',
      registrationId: row.registration_id,
      workflowId: row.workflow_id,
      status: row.status,
      ...(row.customer_id ? { customerId: row.customer_id } : {}),
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function hardDocumentMatch(
  businessSlug: string,
  customer: CustomerDraft,
): Promise<string | undefined> {
  const document = completeDocument(customer);
  if (!document) return undefined;
  const result = await db().query<{ customer_id: string }>(
    `SELECT customer_id
       FROM customer_documents
      WHERE business_slug = $1 AND document_type = $2 AND country = $3 AND document_value = $4
      ORDER BY customer_id
      LIMIT 1`,
    [businessSlug, document.type, document.country, document.value],
  );
  return result.rows[0]?.customer_id;
}

export async function checkDuplicate(
  businessSlug: string,
  rawCustomer: CustomerDraft,
  duplicatePolicy: RegistrationPolicy['duplicatePolicy'],
): Promise<CheckDuplicateResult> {
  const customer = normalizeCustomerDraft(rawCustomer);

  if (duplicatePolicy.hardUnique.includes(DOCUMENT_SELECTOR)) {
    const customerId = await hardDocumentMatch(businessSlug, customer);
    if (customerId) return { classification: 'HARD_UNIQUE', customerId };
  }

  const candidates = new Set<string>();

  if (duplicatePolicy.softMatch.includes(EMAIL_SELECTOR) && customer.contact?.email) {
    const result = await db().query<{ customer_id: string }>(
      `SELECT customer_id
         FROM customer_contacts
        WHERE business_slug = $1 AND email_normalized = $2`,
      [businessSlug, customer.contact.email],
    );
    for (const row of result.rows) candidates.add(row.customer_id);
  }

  if (duplicatePolicy.softMatch.includes(PHONE_SELECTOR)) {
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
  }

  if (candidates.size > 0) {
    return { classification: 'SOFT_MATCH', candidateCustomerIds: [...candidates].sort() };
  }
  return { classification: 'NONE' };
}

export async function recordExistingCustomer(registrationId: string, customerId: string): Promise<void> {
  await db().query(
    `UPDATE registration_commands
        SET customer_id = $2,
            status = 'EXISTING_CUSTOMER_PENDING_AUDIT',
            updated_at = NOW()
      WHERE registration_id = $1
        AND (customer_id IS NULL OR customer_id = $2)`,
    [registrationId, customerId],
  );
}

export async function recordSoftDuplicate(registrationId: string): Promise<void> {
  await db().query(
    `UPDATE registration_commands
        SET status = 'SOFT_DUPLICATE_PENDING_DECISION',
            updated_at = NOW()
      WHERE registration_id = $1
        AND status IN ('RESERVED', 'SOFT_DUPLICATE_PENDING_DECISION')`,
    [registrationId],
  );
}

async function lockAndFindDocument(
  client: PoolClient,
  businessSlug: string,
  customer: CustomerDraft,
): Promise<string | undefined> {
  const document = completeDocument(customer);
  if (!document) return undefined;

  // Advisory locks accept a bigint key. We derive it from a stable ASCII SHA-256
  // representation so document identity is unambiguous without sending NUL bytes
  // through PostgreSQL's text protocol.
  const lockMaterial = sha256(
    JSON.stringify([businessSlug, document.type, document.country, document.value]),
  );
  await client.query(`SELECT pg_advisory_xact_lock(hashtextextended($1, 0))`, [lockMaterial]);

  const result = await client.query<{ customer_id: string }>(
    `SELECT customer_id
       FROM customer_documents
      WHERE business_slug = $1 AND document_type = $2 AND country = $3 AND document_value = $4
      ORDER BY customer_id
      LIMIT 1`,
    [businessSlug, document.type, document.country, document.value],
  );
  return result.rows[0]?.customer_id;
}

export async function createCustomer(
  registrationId: string,
  businessSlug: string,
  rawCustomer: CustomerDraft,
  enforceHardUniqueDocument: boolean,
): Promise<CreateCustomerResult> {
  const customer = normalizeCustomerDraft(rawCustomer);
  const client = await db().connect();

  try {
    await client.query('BEGIN');
    const command = await client.query<{
      customer_id: string | null;
      status: RegistrationCommandStatus;
    }>(
      `SELECT customer_id, status
         FROM registration_commands
        WHERE registration_id = $1
        FOR UPDATE`,
      [registrationId],
    );
    const row = command.rows[0];
    if (!row) throw new Error(`registration command not found: ${registrationId}`);

    if (row.customer_id) {
      await client.query('COMMIT');
      return row.status === 'EXISTING_CUSTOMER_PENDING_AUDIT'
        ? { kind: 'HARD_DUPLICATE', customerId: row.customer_id }
        : { kind: 'CREATED', customerId: row.customer_id, reused: true };
    }

    if (enforceHardUniqueDocument) {
      const existing = await lockAndFindDocument(client, businessSlug, customer);
      if (existing) {
        await client.query(
          `UPDATE registration_commands
              SET customer_id = $2,
                  status = 'EXISTING_CUSTOMER_PENDING_AUDIT',
                  updated_at = NOW()
            WHERE registration_id = $1`,
          [registrationId, existing],
        );
        await client.query('COMMIT');
        return { kind: 'HARD_DUPLICATE', customerId: existing };
      }
    }

    const customerId = `cus_${randomUUID()}`;
    await client.query(
      `INSERT INTO customers (customer_id, business_slug, customer_type, customer_name)
       VALUES ($1, $2, $3, $4)`,
      [customerId, businessSlug, customer.type ?? null, customer.name ?? null],
    );

    if (customer.contact?.email) {
      await client.query(
        `INSERT INTO customer_contacts (customer_id, business_slug, email_normalized)
         VALUES ($1, $2, $3)`,
        [customerId, businessSlug, customer.contact.email],
      );
    }

    const phones = customer.contact?.phones ?? [];
    for (let index = 0; index < phones.length; index += 1) {
      const phone = phones[index];
      if (!phone?.normalized) continue;
      await client.query(
        `INSERT INTO customer_phones (
           customer_id, phone_index, business_slug, country_code,
           phone_number, normalized, is_primary
         ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          customerId,
          index,
          businessSlug,
          phone.countryCode ?? null,
          phone.number ?? phone.normalized,
          phone.normalized,
          phone.primary ?? false,
        ],
      );
    }

    const document = completeDocument(customer);
    if (document) {
      await client.query(
        `INSERT INTO customer_documents (
           customer_id, business_slug, document_type, country, document_value
         ) VALUES ($1, $2, $3, $4, $5)`,
        [customerId, businessSlug, document.type, document.country, document.value],
      );
    }

    await client.query(
      `UPDATE registration_commands
          SET customer_id = $2,
              status = 'CUSTOMER_CREATED_PENDING_AUDIT',
              updated_at = NOW()
        WHERE registration_id = $1`,
      [registrationId, customerId],
    );
    await client.query('COMMIT');
    return { kind: 'CREATED', customerId, reused: false };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function closePostgresRepository(): Promise<void> {
  const current = pool;
  pool = undefined;
  if (current) await current.end();
}
