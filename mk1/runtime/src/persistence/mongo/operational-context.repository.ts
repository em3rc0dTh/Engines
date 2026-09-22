import { createHash } from 'node:crypto';
import { MongoClient, type Collection } from 'mongodb';
import { loadRuntimeConfig } from '../../config/runtime-config.js';
import { canonicalJson } from '../../contracts/register-new-customer/index.js';

export type OperationalContextCategory = 'conversation_log' | 'workflow_context' | 'flexible_document';

export type OperationalContextInput = Readonly<{
  businessSlug: string;
  category: OperationalContextCategory;
  logicalKey: string;
  workflowId?: string;
  conversationId?: string;
  caseId?: string;
  payload: Readonly<Record<string, unknown>>;
  occurredAt: string;
}>;

type OperationalContextDocument = Readonly<{
  _id: string;
  businessSlug: string;
  category: OperationalContextCategory;
  logicalKey: string;
  workflowId?: string;
  conversationId?: string;
  caseId?: string;
  payload: Readonly<Record<string, unknown>>;
  payloadHash: string;
  occurredAt: Date;
  persistedAt: Date;
}>;

let client: MongoClient | undefined;
let indexesReady: Promise<void> | undefined;

function sha256(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

function mongo(): MongoClient {
  client ??= new MongoClient(loadRuntimeConfig().mongoUrl, { maxPoolSize: 6 });
  return client;
}

function collection(): Collection<OperationalContextDocument> {
  const config = loadRuntimeConfig();
  return mongo().db(config.mongoDb).collection<OperationalContextDocument>('operational_context');
}

export async function ensureOperationalContextIndexes(): Promise<void> {
  indexesReady ??= (async () => {
    const c = collection();
    await c.createIndex({ businessSlug: 1, category: 1, occurredAt: -1 }, { name: 'idx_context_business_category_time' });
    await c.createIndex({ businessSlug: 1, workflowId: 1, occurredAt: 1 }, { sparse: true, name: 'idx_context_workflow_time' });
    await c.createIndex({ businessSlug: 1, conversationId: 1, occurredAt: 1 }, { sparse: true, name: 'idx_context_conversation_time' });
    await c.createIndex({ businessSlug: 1, caseId: 1, occurredAt: 1 }, { sparse: true, name: 'idx_context_case_time' });
    await c.createIndex({ businessSlug: 1, category: 1, logicalKey: 1 }, { unique: true, name: 'uq_context_logical_key' });
  })();
  await indexesReady;
}

export async function persistOperationalContext(
  input: OperationalContextInput,
): Promise<Readonly<{ contextId: string; replay: boolean }>> {
  await ensureOperationalContextIndexes();
  const contextId = `ctx_${sha256(canonicalJson([input.businessSlug, input.category, input.logicalKey])).slice(0, 32)}`;
  const payloadHash = sha256(canonicalJson(input));
  const document: OperationalContextDocument = {
    _id: contextId,
    businessSlug: input.businessSlug,
    category: input.category,
    logicalKey: input.logicalKey,
    ...(input.workflowId ? { workflowId: input.workflowId } : {}),
    ...(input.conversationId ? { conversationId: input.conversationId } : {}),
    ...(input.caseId ? { caseId: input.caseId } : {}),
    payload: input.payload,
    payloadHash,
    occurredAt: new Date(input.occurredAt),
    persistedAt: new Date(),
  };
  const c = collection();
  const result = await c.updateOne({ _id: contextId }, { $setOnInsert: document }, { upsert: true });
  const replay = result.upsertedCount !== 1;
  if (replay) {
    const existing = await c.findOne({ _id: contextId }, { projection: { payloadHash: 1 } });
    if (!existing || existing.payloadHash !== payloadHash) throw new Error(`OPERATIONAL_CONTEXT_CONFLICT:${contextId}`);
  }
  return { contextId, replay };
}

export async function closeOperationalContextRepository(): Promise<void> {
  const current = client;
  client = undefined;
  indexesReady = undefined;
  if (current) await current.close();
}
