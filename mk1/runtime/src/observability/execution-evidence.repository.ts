import { MongoClient } from 'mongodb';
import { Pool } from 'pg';
import { loadRuntimeConfig } from '../config/runtime-config.js';

export type MongoAuditEvidence = Readonly<{
  eventId: string;
  eventType: string;
  logicalKey: string;
  schemaVersion: string;
  businessSlug: string;
  workflowId: string;
  correlationId?: string;
  customerId?: string;
  phase: string;
  occurredAt: string;
  persistedAt: string;
  metadata?: Readonly<Record<string, unknown>>;
}>;

export type PostgresAttachmentEvidence = Readonly<{
  attachmentId: string;
  kind?: string;
  displayName?: string;
  mediaType: string;
  byteLength: number;
  sha256: string;
  committedAt: string;
  linkedAt: string;
}>;

export type PostgresExecutionEvidence = Readonly<{
  registration?: Readonly<{
    registrationId: string;
    operation: string;
    businessSlug: string;
    idempotencyKeyHash: string;
    commandFingerprint: string;
    workflowId: string;
    customerId?: string;
    status: string;
    createdAt: string;
    updatedAt: string;
  }>;
  customer?: Readonly<{
    customerId: string;
    businessSlug: string;
    type?: string;
    name?: string;
    status: string;
    email?: string;
    phones: readonly Readonly<{
      index: number;
      countryCode?: string;
      number: string;
      normalized: string;
      primary: boolean;
    }>[];
    document?: Readonly<{
      type: string;
      country: string;
      value: string;
    }>;
    attachments: readonly PostgresAttachmentEvidence[];
    createdAt: string;
    updatedAt: string;
  }>;
}>;

let mongoClient: MongoClient | undefined;
let postgresPool: Pool | undefined;

function mongo(): MongoClient {
  mongoClient ??= new MongoClient(loadRuntimeConfig().mongoUrl, { maxPoolSize: 4 });
  return mongoClient;
}

function postgres(): Pool {
  postgresPool ??= new Pool({ connectionString: loadRuntimeConfig().postgresUrl, max: 4 });
  return postgresPool;
}

function iso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

export async function loadMongoAuditEvidence(workflowId: string): Promise<readonly MongoAuditEvidence[]> {
  const config = loadRuntimeConfig();
  const documents = await mongo()
    .db(config.mongoDb)
    .collection('execution_audit')
    .find({ workflowId })
    .sort({ occurredAt: 1, persistedAt: 1 })
    .toArray();

  return documents.map((document) => ({
    eventId: String(document.eventId),
    eventType: String(document.eventType),
    logicalKey: String(document.logicalKey),
    schemaVersion: String(document.schemaVersion),
    businessSlug: String(document.businessSlug),
    workflowId: String(document.workflowId),
    ...(typeof document.correlationId === 'string' ? { correlationId: document.correlationId } : {}),
    ...(typeof document.customerId === 'string' ? { customerId: document.customerId } : {}),
    phase: String(document.phase),
    occurredAt: String(document.occurredAt),
    persistedAt: iso(document.persistedAt as Date),
    ...(document.metadata && typeof document.metadata === 'object'
      ? { metadata: document.metadata as Readonly<Record<string, unknown>> }
      : {}),
  }));
}

export async function loadPostgresExecutionEvidence(workflowId: string): Promise<PostgresExecutionEvidence> {
  const pool = postgres();
  const registrationResult = await pool.query<{
    registration_id: string;
    operation: string;
    business_slug: string;
    idempotency_key_hash: string;
    command_fingerprint: string;
    workflow_id: string;
    customer_id: string | null;
    status: string;
    created_at: Date;
    updated_at: Date;
  }>(
    `SELECT registration_id, operation, business_slug, idempotency_key_hash,
            command_fingerprint, workflow_id, customer_id, status, created_at, updated_at
       FROM registration_commands
      WHERE workflow_id = $1
      ORDER BY created_at ASC
      LIMIT 1`,
    [workflowId],
  );

  const registration = registrationResult.rows[0];
  if (!registration) return {};

  const registrationEvidence = {
    registrationId: registration.registration_id,
    operation: registration.operation,
    businessSlug: registration.business_slug,
    idempotencyKeyHash: registration.idempotency_key_hash,
    commandFingerprint: registration.command_fingerprint,
    workflowId: registration.workflow_id,
    ...(registration.customer_id ? { customerId: registration.customer_id } : {}),
    status: registration.status,
    createdAt: iso(registration.created_at),
    updatedAt: iso(registration.updated_at),
  } as const;

  if (!registration.customer_id) return { registration: registrationEvidence };

  const customerId = registration.customer_id;
  const [customerResult, contactResult, phoneResult, documentResult, attachmentResult] = await Promise.all([
    pool.query<{
      customer_id: string;
      business_slug: string;
      customer_type: string | null;
      customer_name: string | null;
      status: string;
      created_at: Date;
      updated_at: Date;
    }>(
      `SELECT customer_id, business_slug, customer_type, customer_name, status, created_at, updated_at
         FROM customers WHERE customer_id = $1`,
      [customerId],
    ),
    pool.query<{ email_normalized: string | null }>(
      `SELECT email_normalized FROM customer_contacts WHERE customer_id = $1`,
      [customerId],
    ),
    pool.query<{
      phone_index: number;
      country_code: string | null;
      phone_number: string;
      normalized: string;
      is_primary: boolean;
    }>(
      `SELECT phone_index, country_code, phone_number, normalized, is_primary
         FROM customer_phones WHERE customer_id = $1 ORDER BY phone_index`,
      [customerId],
    ),
    pool.query<{ document_type: string; country: string; document_value: string }>(
      `SELECT document_type, country, document_value
         FROM customer_documents WHERE customer_id = $1`,
      [customerId],
    ),
    pool.query<{
      attachment_id: string;
      kind: string | null;
      display_name: string | null;
      media_type: string;
      byte_length: number;
      sha256: string;
      committed_at: Date;
      linked_at: Date;
    }>(
      `SELECT attachment_id, kind, display_name, media_type, byte_length, sha256, committed_at, linked_at
         FROM customer_attachment_refs WHERE customer_id = $1 ORDER BY linked_at, attachment_id`,
      [customerId],
    ),
  ]);

  const customer = customerResult.rows[0];
  if (!customer) return { registration: registrationEvidence };

  const contact = contactResult.rows[0];
  const document = documentResult.rows[0];

  return {
    registration: registrationEvidence,
    customer: {
      customerId: customer.customer_id,
      businessSlug: customer.business_slug,
      ...(customer.customer_type ? { type: customer.customer_type } : {}),
      ...(customer.customer_name ? { name: customer.customer_name } : {}),
      status: customer.status,
      ...(contact?.email_normalized ? { email: contact.email_normalized } : {}),
      phones: phoneResult.rows.map((phone) => ({
        index: phone.phone_index,
        ...(phone.country_code ? { countryCode: phone.country_code } : {}),
        number: phone.phone_number,
        normalized: phone.normalized,
        primary: phone.is_primary,
      })),
      ...(document
        ? {
            document: {
              type: document.document_type,
              country: document.country,
              value: document.document_value,
            },
          }
        : {}),
      attachments: attachmentResult.rows.map((attachment) => ({
        attachmentId: attachment.attachment_id,
        ...(attachment.kind ? { kind: attachment.kind } : {}),
        ...(attachment.display_name ? { displayName: attachment.display_name } : {}),
        mediaType: attachment.media_type,
        byteLength: attachment.byte_length,
        sha256: attachment.sha256,
        committedAt: iso(attachment.committed_at),
        linkedAt: iso(attachment.linked_at),
      })),
      createdAt: iso(customer.created_at),
      updatedAt: iso(customer.updated_at),
    },
  };
}

export async function closeExecutionEvidenceRepository(): Promise<void> {
  const currentMongo = mongoClient;
  const currentPostgres = postgresPool;
  mongoClient = undefined;
  postgresPool = undefined;
  await Promise.all([
    currentMongo ? currentMongo.close() : Promise.resolve(),
    currentPostgres ? currentPostgres.end() : Promise.resolve(),
  ]);
}
