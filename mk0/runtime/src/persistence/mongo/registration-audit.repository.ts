import { createHash } from 'node:crypto';
import { MongoClient, type Collection } from 'mongodb';
import { canonicalJson } from '../../contracts/register-new-customer/index.js';
import { loadRuntimeConfig } from '../../config/runtime-config.js';
import type {
  PersistRegistrationAuditResult,
  RegistrationAuditEventInput,
  VerifyRegistrationAuditResult,
} from '../../orchestration/temporal/activities/mongo-registration-audit.types.js';

type AuditDocument = Readonly<{
  _id: string;
  eventId: string;
  eventType: RegistrationAuditEventInput['eventType'];
  logicalKey: string;
  schemaVersion: string;
  businessSlug: string;
  workflowId: string;
  correlationId?: string;
  customerId?: string;
  phase: string;
  occurredAt: string;
  metadata?: Readonly<Record<string, unknown>>;
  payloadHash: string;
  persistedAt: Date;
}>;

let client: MongoClient | undefined;
let indexesReady: Promise<void> | undefined;

function sha256(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

function mongo(): MongoClient {
  client ??= new MongoClient(loadRuntimeConfig().mongoUrl, { maxPoolSize: 8 });
  return client;
}

function auditCollection(): Collection<AuditDocument> {
  const config = loadRuntimeConfig();
  return mongo().db(config.mongoDb).collection<AuditDocument>('execution_audit');
}

function eventIdentity(event: RegistrationAuditEventInput): string {
  return sha256(canonicalJson([event.workflowId, event.eventType, event.logicalKey]));
}

function eventPayloadHash(event: RegistrationAuditEventInput): string {
  return sha256(
    canonicalJson({
      eventType: event.eventType,
      logicalKey: event.logicalKey,
      schemaVersion: event.schemaVersion,
      businessSlug: event.businessSlug,
      workflowId: event.workflowId,
      correlationId: event.correlationId,
      customerId: event.customerId,
      phase: event.phase,
      occurredAt: event.occurredAt,
      metadata: event.metadata,
    }),
  );
}

export async function ensureRegistrationAuditIndexes(): Promise<void> {
  indexesReady ??= (async () => {
    const collection = auditCollection();
    await collection.createIndex({ eventId: 1 }, { unique: true, name: 'uq_execution_audit_event_id' });
    await collection.createIndex(
      { workflowId: 1, eventType: 1, logicalKey: 1 },
      { unique: true, name: 'uq_execution_audit_logical_event' },
    );
    await collection.createIndex(
      { workflowId: 1, occurredAt: 1 },
      { name: 'idx_execution_audit_workflow_time' },
    );
    await collection.createIndex(
      { correlationId: 1, occurredAt: 1 },
      { sparse: true, name: 'idx_execution_audit_correlation_time' },
    );
    await collection.createIndex(
      { customerId: 1, occurredAt: 1 },
      { sparse: true, name: 'idx_execution_audit_customer_time' },
    );
  })();
  await indexesReady;
}

export async function persistRegistrationAuditEvents(
  events: readonly RegistrationAuditEventInput[],
): Promise<PersistRegistrationAuditResult> {
  await ensureRegistrationAuditIndexes();
  const collection = auditCollection();
  const persistedEventIds: string[] = [];
  const reusedEventIds: string[] = [];

  for (const event of events) {
    const eventId = eventIdentity(event);
    const payloadHash = eventPayloadHash(event);
    const document: AuditDocument = {
      _id: eventId,
      eventId,
      eventType: event.eventType,
      logicalKey: event.logicalKey,
      schemaVersion: event.schemaVersion,
      businessSlug: event.businessSlug,
      workflowId: event.workflowId,
      ...(event.correlationId ? { correlationId: event.correlationId } : {}),
      ...(event.customerId ? { customerId: event.customerId } : {}),
      phase: event.phase,
      occurredAt: event.occurredAt,
      ...(event.metadata ? { metadata: event.metadata } : {}),
      payloadHash,
      persistedAt: new Date(),
    };

    const result = await collection.updateOne(
      { _id: eventId },
      { $setOnInsert: document },
      { upsert: true },
    );

    if (result.upsertedCount === 1) {
      persistedEventIds.push(eventId);
      continue;
    }

    const existing = await collection.findOne({ _id: eventId }, { projection: { payloadHash: 1 } });
    if (!existing || existing.payloadHash !== payloadHash) {
      throw new Error(`MONGO_AUDIT_EVENT_CONFLICT:${eventId}`);
    }
    reusedEventIds.push(eventId);
  }

  return { persistedEventIds, reusedEventIds };
}

export async function verifyRegistrationAuditEvents(
  workflowId: string,
  requiredLogicalEvents: readonly Readonly<{
    eventType: RegistrationAuditEventInput['eventType'];
    logicalKey: string;
  }>[],
): Promise<VerifyRegistrationAuditResult> {
  await ensureRegistrationAuditIndexes();
  const collection = auditCollection();
  const missing: string[] = [];

  for (const required of requiredLogicalEvents) {
    const found = await collection.findOne(
      {
        workflowId,
        eventType: required.eventType,
        logicalKey: required.logicalKey,
      },
      { projection: { _id: 1 } },
    );
    if (!found) missing.push(`${required.eventType}:${required.logicalKey}`);
  }

  return { complete: missing.length === 0, missing };
}

export async function closeMongoRegistrationAuditRepository(): Promise<void> {
  const current = client;
  client = undefined;
  indexesReady = undefined;
  if (current) await current.close();
}
