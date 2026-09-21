import { createHash } from 'node:crypto';
import { MongoClient, type Collection } from 'mongodb';
import { loadRuntimeConfig } from '../../config/runtime-config.js';
import { canonicalJson } from '../../contracts/register-new-customer/index.js';
import type { ServicesMutationAuditInput } from '../../orchestration/temporal/activities/services-audit.types.js';

type ServicesAuditDocument = Readonly<{
  _id: string;
  workflowId: string;
  businessSlug: string;
  operation: string;
  idempotencyKey: string;
  entityType?: string;
  entityId?: string;
  outcomeStatus: string;
  outcomeCode?: string;
  occurredAt: string;
  payloadHash: string;
  command: ServicesMutationAuditInput['command'];
  outcome: ServicesMutationAuditInput['outcome'];
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

function collection(): Collection<ServicesAuditDocument> {
  const config = loadRuntimeConfig();
  return mongo().db(config.mongoDb).collection<ServicesAuditDocument>('services_mutation_audit');
}

async function ensureIndexes(): Promise<void> {
  indexesReady ??= (async () => {
    const c = collection();
    await c.createIndex({ workflowId: 1 }, { unique: true, name: 'uq_services_mutation_audit_workflow' });
    await c.createIndex(
      { businessSlug: 1, operation: 1, idempotencyKey: 1 },
      { name: 'idx_services_mutation_audit_command' },
    );
    await c.createIndex(
      { businessSlug: 1, entityType: 1, entityId: 1, occurredAt: 1 },
      { sparse: true, name: 'idx_services_mutation_audit_entity' },
    );
  })();
  await indexesReady;
}

export async function persistServicesMutationAudit(
  input: ServicesMutationAuditInput,
): Promise<Readonly<{ persisted: boolean; reused: boolean }>> {
  await ensureIndexes();
  const c = collection();
  const _id = sha256(canonicalJson([input.workflowId, 'SERVICES_MUTATION_TERMINAL']));
  const payloadHash = sha256(canonicalJson(input));
  const outcome = input.outcome;
  const entityType = outcome.entityType;
  const entityId = outcome.entityId;
  const document: ServicesAuditDocument = {
    _id,
    workflowId: input.workflowId,
    businessSlug: input.command.businessSlug,
    operation: input.command.operation,
    idempotencyKey: input.command.idempotencyKey,
    ...(entityType ? { entityType } : {}),
    ...(entityId ? { entityId } : {}),
    outcomeStatus: outcome.status,
    ...(outcome.status === 'REJECTED' ? { outcomeCode: outcome.code } : {}),
    occurredAt: input.occurredAt,
    payloadHash,
    command: input.command,
    outcome,
    persistedAt: new Date(),
  };

  const result = await c.updateOne({ _id }, { $setOnInsert: document }, { upsert: true });
  if (result.upsertedCount === 1) return { persisted: true, reused: false };

  const existing = await c.findOne({ _id }, { projection: { payloadHash: 1 } });
  if (!existing || existing.payloadHash !== payloadHash) {
    throw new Error(`SERVICES_AUDIT_CONFLICT:${_id}`);
  }
  return { persisted: false, reused: true };
}

export async function closeServicesAuditRepository(): Promise<void> {
  const current = client;
  client = undefined;
  indexesReady = undefined;
  if (current) await current.close();
}
