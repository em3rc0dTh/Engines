import { createHash } from 'node:crypto';
import { MongoClient, type Collection } from 'mongodb';
import { loadRuntimeConfig } from '../../config/runtime-config.js';
import { canonicalJson } from '../../contracts/register-new-customer/index.js';
import type {
  AppointmentAuditEventInput,
  AppointmentAuditEventType,
} from '../../orchestration/temporal/activities/appointment-audit.types.js';

type AppointmentAuditDocument = Readonly<{
  _id: string;
  eventType: AppointmentAuditEventType;
  logicalKey: string;
  businessSlug: string;
  workflowId: string;
  phase: string;
  occurredAt: string;
  correlationId?: string;
  customerId?: string;
  appointmentId?: string;
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

function collection(): Collection<AppointmentAuditDocument> {
  const config = loadRuntimeConfig();
  return mongo().db(config.mongoDb).collection<AppointmentAuditDocument>('appointment_audit');
}

function identity(event: AppointmentAuditEventInput): string {
  return sha256(canonicalJson([event.workflowId, event.eventType, event.logicalKey]));
}

function payloadHash(event: AppointmentAuditEventInput): string {
  return sha256(canonicalJson(event));
}

async function ensureIndexes(): Promise<void> {
  indexesReady ??= (async () => {
    const c = collection();
    await c.createIndex(
      { workflowId: 1, eventType: 1, logicalKey: 1 },
      { unique: true, name: 'uq_appointment_audit_logical_event' },
    );
    await c.createIndex(
      { workflowId: 1, occurredAt: 1 },
      { name: 'idx_appointment_audit_workflow_time' },
    );
    await c.createIndex(
      { appointmentId: 1, occurredAt: 1 },
      { sparse: true, name: 'idx_appointment_audit_appointment_time' },
    );
  })();
  await indexesReady;
}

export async function persistAppointmentAuditEvents(
  events: readonly AppointmentAuditEventInput[],
): Promise<Readonly<{ persisted: number; reused: number }>> {
  await ensureIndexes();
  const c = collection();
  let persisted = 0;
  let reused = 0;
  for (const event of events) {
    const _id = identity(event);
    const hash = payloadHash(event);
    const document: AppointmentAuditDocument = {
      _id,
      eventType: event.eventType,
      logicalKey: event.logicalKey,
      businessSlug: event.businessSlug,
      workflowId: event.workflowId,
      phase: event.phase,
      occurredAt: event.occurredAt,
      ...(event.correlationId ? { correlationId: event.correlationId } : {}),
      ...(event.customerId ? { customerId: event.customerId } : {}),
      ...(event.appointmentId ? { appointmentId: event.appointmentId } : {}),
      ...(event.metadata ? { metadata: event.metadata } : {}),
      payloadHash: hash,
      persistedAt: new Date(),
    };
    const result = await c.updateOne({ _id }, { $setOnInsert: document }, { upsert: true });
    if (result.upsertedCount === 1) {
      persisted += 1;
      continue;
    }
    const existing = await c.findOne({ _id }, { projection: { payloadHash: 1 } });
    if (!existing || existing.payloadHash !== hash) throw new Error(`APPOINTMENT_AUDIT_CONFLICT:${_id}`);
    reused += 1;
  }
  return { persisted, reused };
}

export async function verifyAppointmentAuditEvents(
  workflowId: string,
  required: readonly Readonly<{ eventType: AppointmentAuditEventType; logicalKey: string }>[]
): Promise<Readonly<{ complete: boolean; missing: readonly string[] }>> {
  await ensureIndexes();
  const c = collection();
  const missing: string[] = [];
  for (const item of required) {
    const found = await c.findOne(
      { workflowId, eventType: item.eventType, logicalKey: item.logicalKey },
      { projection: { _id: 1 } },
    );
    if (!found) missing.push(`${item.eventType}:${item.logicalKey}`);
  }
  return { complete: missing.length === 0, missing };
}

export async function closeAppointmentAuditRepository(): Promise<void> {
  const current = client;
  client = undefined;
  indexesReady = undefined;
  if (current) await current.close();
}
