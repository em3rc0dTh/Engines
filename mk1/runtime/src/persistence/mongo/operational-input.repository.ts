import { createHash } from 'node:crypto';
import { MongoClient, type Collection } from 'mongodb';
import { loadRuntimeConfig } from '../../config/runtime-config.js';
import { canonicalJson } from '../../contracts/register-new-customer/index.js';

export type OperationalInputElement = Readonly<{
  elementId?: string;
  type: string;
  semanticKey: string;
  label: string;
  value: unknown;
  valueType: string;
  unit?: string | null;
  status: string;
  providedBy?: string;
  providedAt: string;
}>;

export type OperationalInsight = Readonly<{
  insightId?: string;
  type: string;
  statement: string;
  status: string;
  confidence?: number;
  severity?: string;
  structuredAssertion?: Readonly<Record<string, unknown>>;
}>;

export type PersistOperationalDirectInput = Readonly<{
  businessSlug: string;
  caseId: string;
  managedEntityId: string;
  context: Readonly<{ type: string; id: string }>;
  inputType: string;
  status?: string;
  workflowId?: string;
  providedBy: Readonly<{ type: string; id: string }>;
  inputElements: readonly OperationalInputElement[];
  validation?: Readonly<{
    status: string;
    validatedBy: string;
    validatedAt: string;
    errors?: readonly string[];
  }>;
  createdAt: string;
}>;

export type ObservationAttachmentDescriptor = Readonly<{
  attachmentId: string;
  customerId?: string;
  attachmentType: string;
  mimeType: string;
  filename: string;
  storage: Readonly<{
    provider: string;
    key?: string;
    path?: string;
    url?: string | null;
  }>;
  uploadedBy: Readonly<{ type: string; id: string }>;
  metadata?: Readonly<Record<string, unknown>>;
  createdAt: string;
}>;

export type PersistOperationalObservationInput = Readonly<{
  businessSlug: string;
  caseId: string;
  managedEntityId: string;
  context: Readonly<{ type: string; id: string }>;
  inputType: string;
  channels: readonly string[];
  status: 'captured' | 'extraction_pending' | 'interpreted' | 'waiting_review' | 'confirmed' | 'rejected' | 'superseded';
  author: Readonly<{ type: string; id: string; nameSnapshot?: string }>;
  review?: Readonly<Record<string, unknown>>;
  attachments: readonly ObservationAttachmentDescriptor[];
  payload?: Readonly<{
    rawExtraction?: Readonly<Record<string, unknown>>;
    interpretation?: Readonly<Record<string, unknown>>;
    confirmed?: Readonly<Record<string, unknown>>;
    operationalInsights: readonly OperationalInsight[];
  }>;
  createdAt: string;
  updatedAt?: string;
}>;

type StableOperationalInputElement = Omit<OperationalInputElement, 'elementId'> & Readonly<{ elementId: string }>;
type StableOperationalInsight = Omit<OperationalInsight, 'insightId'> & Readonly<{ insightId: string }>;

type DirectInputDocument = Readonly<{
  _id: string;
  businessSlug: string;
  caseId: string;
  managedEntityId: string;
  context: Readonly<{ type: string; id: string }>;
  inputType: string;
  status: string;
  workflowId?: string;
  providedBy: Readonly<{ type: string; id: string }>;
  inputElements: readonly StableOperationalInputElement[];
  validation: Readonly<{ status: string; validatedBy: string; validatedAt: string; errors: readonly string[] }>;
  payloadHash: string;
  createdAt: Date;
  updatedAt: Date;
}>;

type ObservationInputDocument = Readonly<{
  _id: string;
  businessSlug: string;
  caseId: string;
  managedEntityId: string;
  context: Readonly<{ type: string; id: string }>;
  inputType: string;
  channels: readonly string[];
  status: PersistOperationalObservationInput['status'];
  author: PersistOperationalObservationInput['author'];
  review?: Readonly<Record<string, unknown>>;
  attachmentIds: readonly string[];
  payload: Readonly<{
    rawExtraction?: Readonly<Record<string, unknown>>;
    interpretation?: Readonly<Record<string, unknown>>;
    confirmed?: Readonly<Record<string, unknown>>;
    operationalInsights: readonly StableOperationalInsight[];
  }>;
  payloadHash: string;
  createdAt: Date;
  updatedAt: Date;
}>;

type AttachmentDocument = Readonly<{
  _id: string;
  businessSlug: string;
  caseId: string;
  customerId?: string;
  managedEntityId: string;
  entity: Readonly<{ type: 'operational_observation_input'; id: string }>;
  operationalObservationInputId: string;
  ownership: Readonly<{ mode: 'exclusive_observation_input'; ownerId: string }>;
  attachmentType: string;
  mimeType: string;
  storage: ObservationAttachmentDescriptor['storage'];
  filename: string;
  visibility: 'internal';
  uploadedBy: ObservationAttachmentDescriptor['uploadedBy'];
  metadata?: Readonly<Record<string, unknown>>;
  createdAt: Date;
}>;

type ProvenanceDocument = Readonly<{
  _id: string;
  businessSlug: string;
  caseId: string;
  target: Readonly<{ type: string; id: string }>;
  sourceRefs: readonly Readonly<{
    sourceType: 'operational_input_element' | 'operational_insight';
    sourceId: string;
    parentInputId: string;
    relationship: 'created_from' | 'supported_by';
  }>[];
  createdAt: Date;
}>;

let client: MongoClient | undefined;
let indexesReady: Promise<void> | undefined;

function sha256(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

function stableId(prefix: string, material: unknown, length = 32): string {
  return `${prefix}_${sha256(canonicalJson(material)).slice(0, length)}`;
}

function mongo(): MongoClient {
  client ??= new MongoClient(loadRuntimeConfig().mongoUrl, { maxPoolSize: 8 });
  return client;
}

function directCollection(): Collection<DirectInputDocument> {
  const config = loadRuntimeConfig();
  return mongo().db(config.mongoDb).collection<DirectInputDocument>('operational_direct_inputs');
}

function observationCollection(): Collection<ObservationInputDocument> {
  const config = loadRuntimeConfig();
  return mongo().db(config.mongoDb).collection<ObservationInputDocument>('operational_observation_inputs');
}

function attachmentCollection(): Collection<AttachmentDocument> {
  const config = loadRuntimeConfig();
  return mongo().db(config.mongoDb).collection<AttachmentDocument>('attachments_v4');
}

function provenanceCollection(): Collection<ProvenanceDocument> {
  const config = loadRuntimeConfig();
  return mongo().db(config.mongoDb).collection<ProvenanceDocument>('operational_provenance');
}

export async function ensureOperationalInputIndexes(): Promise<void> {
  indexesReady ??= (async () => {
    const direct = directCollection();
    await direct.createIndex({ businessSlug: 1, caseId: 1, createdAt: -1 }, { name: 'idx_odi_case_time' });
    await direct.createIndex({ businessSlug: 1, managedEntityId: 1, createdAt: -1 }, { name: 'idx_odi_entity_time' });
    await direct.createIndex({ businessSlug: 1, 'context.type': 1, 'context.id': 1 }, { name: 'idx_odi_context' });
    await direct.createIndex({ businessSlug: 1, status: 1, createdAt: -1 }, { name: 'idx_odi_status_time' });
    await direct.createIndex({ businessSlug: 1, 'inputElements.elementId': 1 }, { name: 'idx_odi_element_id' });
    await direct.createIndex({ businessSlug: 1, 'inputElements.semanticKey': 1 }, { name: 'idx_odi_semantic_key' });
    await direct.createIndex({ businessSlug: 1, workflowId: 1 }, { unique: true, sparse: true, name: 'uq_odi_workflow' });

    const observation = observationCollection();
    await observation.createIndex({ businessSlug: 1, caseId: 1, createdAt: -1 }, { name: 'idx_ooi_case_time' });
    await observation.createIndex({ businessSlug: 1, managedEntityId: 1, createdAt: -1 }, { name: 'idx_ooi_entity_time' });
    await observation.createIndex({ businessSlug: 1, 'context.type': 1, 'context.id': 1 }, { name: 'idx_ooi_context' });
    await observation.createIndex({ businessSlug: 1, status: 1, createdAt: -1 }, { name: 'idx_ooi_status_time' });
    await observation.createIndex({ businessSlug: 1, 'payload.operationalInsights.insightId': 1 }, { name: 'idx_ooi_insight_id' });

    const attachments = attachmentCollection();
    await attachments.createIndex({ businessSlug: 1, operationalObservationInputId: 1, createdAt: 1 }, { name: 'idx_attachment_ooi_time' });
    await attachments.createIndex(
      { businessSlug: 1, _id: 1, operationalObservationInputId: 1 },
      { unique: true, name: 'uq_attachment_observation_owner' },
    );

    await provenanceCollection().createIndex(
      { businessSlug: 1, 'target.type': 1, 'target.id': 1 },
      { unique: true, name: 'uq_operational_provenance_target' },
    );
  })();
  await indexesReady;
}

function normalizeElements(parentId: string, elements: readonly OperationalInputElement[]): readonly StableOperationalInputElement[] {
  if (elements.length === 0) throw new Error('OPERATIONAL_DIRECT_INPUT_REQUIRES_ELEMENT');
  const seen = new Set<string>();
  return elements.map((element, index) => {
    if (!element.semanticKey.trim()) throw new Error('OPERATIONAL_INPUT_ELEMENT_SEMANTIC_KEY_REQUIRED');
    const elementId = element.elementId?.trim() || stableId('die', [parentId, index, element.semanticKey], 24);
    if (seen.has(elementId)) throw new Error(`OPERATIONAL_INPUT_ELEMENT_DUPLICATE_ID:${elementId}`);
    seen.add(elementId);
    return { ...element, elementId };
  });
}

function normalizeInsights(parentId: string, insights: readonly OperationalInsight[]): readonly StableOperationalInsight[] {
  const seen = new Set<string>();
  return insights.map((insight, index) => {
    const insightId = insight.insightId?.trim() || stableId('ins', [parentId, index, insight.type, insight.statement], 24);
    if (seen.has(insightId)) throw new Error(`OPERATIONAL_INSIGHT_DUPLICATE_ID:${insightId}`);
    seen.add(insightId);
    return { ...insight, insightId };
  });
}

export async function persistOperationalDirectInput(
  input: PersistOperationalDirectInput,
): Promise<Readonly<{ inputId: string; replay: boolean; elementIds: readonly string[] }>> {
  await ensureOperationalInputIndexes();
  const inputId = stableId('odi', [input.businessSlug, input.caseId, input.context.type, input.context.id, input.inputType], 32);
  const elements = normalizeElements(inputId, input.inputElements);
  const validation = input.validation ?? {
    status: 'valid',
    validatedBy: 'engines-layer6-v4',
    validatedAt: input.createdAt,
    errors: [],
  };
  const payload = {
    businessSlug: input.businessSlug,
    caseId: input.caseId,
    managedEntityId: input.managedEntityId,
    context: input.context,
    inputType: input.inputType,
    status: input.status ?? 'validated',
    workflowId: input.workflowId,
    providedBy: input.providedBy,
    inputElements: elements,
    validation: { ...validation, errors: validation.errors ?? [] },
    createdAt: input.createdAt,
  };
  const payloadHash = sha256(canonicalJson(payload));
  const document: DirectInputDocument = {
    _id: inputId,
    businessSlug: input.businessSlug,
    caseId: input.caseId,
    managedEntityId: input.managedEntityId,
    context: input.context,
    inputType: input.inputType,
    status: input.status ?? 'validated',
    ...(input.workflowId ? { workflowId: input.workflowId } : {}),
    providedBy: input.providedBy,
    inputElements: elements,
    validation: { ...validation, errors: validation.errors ?? [] },
    payloadHash,
    createdAt: new Date(input.createdAt),
    updatedAt: new Date(input.createdAt),
  };
  const c = directCollection();
  const result = await c.updateOne({ _id: inputId }, { $setOnInsert: document }, { upsert: true });
  const replay = result.upsertedCount !== 1;
  if (replay) {
    const existing = await c.findOne({ _id: inputId }, { projection: { payloadHash: 1 } });
    if (!existing || existing.payloadHash !== payloadHash) throw new Error(`OPERATIONAL_DIRECT_INPUT_CONFLICT:${inputId}`);
  }
  return { inputId, replay, elementIds: elements.map((element) => element.elementId) };
}

export async function persistOperationalObservationInput(
  input: PersistOperationalObservationInput,
): Promise<Readonly<{ inputId: string; replay: boolean; insightIds: readonly string[] }>> {
  await ensureOperationalInputIndexes();
  if (input.attachments.length === 0) throw new Error('OBSERVATION_INPUT_REQUIRES_ATTACHMENT');
  const inputId = stableId('ooi', [input.businessSlug, input.caseId, input.context.type, input.context.id, input.inputType], 32);
  const insights = normalizeInsights(inputId, input.payload?.operationalInsights ?? []);
  if (input.status === 'confirmed' && insights.length === 0) {
    throw new Error('CONFIRMED_OBSERVATION_INPUT_REQUIRES_INSIGHT');
  }

  const attachments = attachmentCollection();
  for (const attachment of input.attachments) {
    const existing = await attachments.findOne({ _id: attachment.attachmentId });
    if (existing && existing.operationalObservationInputId !== inputId) {
      throw new Error(`OBSERVATION_ATTACHMENT_OWNER_CONFLICT:${attachment.attachmentId}`);
    }
  }

  const payload = {
    businessSlug: input.businessSlug,
    caseId: input.caseId,
    managedEntityId: input.managedEntityId,
    context: input.context,
    inputType: input.inputType,
    channels: input.channels,
    status: input.status,
    author: input.author,
    review: input.review,
    attachmentIds: input.attachments.map((attachment) => attachment.attachmentId),
    payload: { ...(input.payload ?? {}), operationalInsights: insights },
    createdAt: input.createdAt,
    updatedAt: input.updatedAt ?? input.createdAt,
  };
  const payloadHash = sha256(canonicalJson(payload));
  const document: ObservationInputDocument = {
    _id: inputId,
    businessSlug: input.businessSlug,
    caseId: input.caseId,
    managedEntityId: input.managedEntityId,
    context: input.context,
    inputType: input.inputType,
    channels: input.channels,
    status: input.status,
    author: input.author,
    ...(input.review ? { review: input.review } : {}),
    attachmentIds: input.attachments.map((attachment) => attachment.attachmentId),
    payload: { ...(input.payload ?? {}), operationalInsights: insights },
    payloadHash,
    createdAt: new Date(input.createdAt),
    updatedAt: new Date(input.updatedAt ?? input.createdAt),
  };
  const c = observationCollection();
  const result = await c.updateOne({ _id: inputId }, { $setOnInsert: document }, { upsert: true });
  const replay = result.upsertedCount !== 1;
  if (replay) {
    const existing = await c.findOne({ _id: inputId }, { projection: { payloadHash: 1 } });
    if (!existing || existing.payloadHash !== payloadHash) throw new Error(`OPERATIONAL_OBSERVATION_INPUT_CONFLICT:${inputId}`);
  }

  for (const attachment of input.attachments) {
    const attachmentDocument: AttachmentDocument = {
      _id: attachment.attachmentId,
      businessSlug: input.businessSlug,
      caseId: input.caseId,
      ...(attachment.customerId ? { customerId: attachment.customerId } : {}),
      managedEntityId: input.managedEntityId,
      entity: { type: 'operational_observation_input', id: inputId },
      operationalObservationInputId: inputId,
      ownership: { mode: 'exclusive_observation_input', ownerId: inputId },
      attachmentType: attachment.attachmentType,
      mimeType: attachment.mimeType,
      storage: attachment.storage,
      filename: attachment.filename,
      visibility: 'internal',
      uploadedBy: attachment.uploadedBy,
      ...(attachment.metadata ? { metadata: attachment.metadata } : {}),
      createdAt: new Date(attachment.createdAt),
    };
    await attachments.updateOne({ _id: attachment.attachmentId }, { $setOnInsert: attachmentDocument }, { upsert: true });
  }

  return { inputId, replay, insightIds: insights.map((insight) => insight.insightId) };
}

export async function persistOperationalProvenance(input: Readonly<{
  businessSlug: string;
  caseId: string;
  target: Readonly<{ type: string; id: string }>;
  sourceRefs: ProvenanceDocument['sourceRefs'];
  createdAt: string;
}>): Promise<void> {
  await ensureOperationalInputIndexes();
  const id = stableId('prov', [input.businessSlug, input.target.type, input.target.id], 32);
  const document: ProvenanceDocument = {
    _id: id,
    businessSlug: input.businessSlug,
    caseId: input.caseId,
    target: input.target,
    sourceRefs: input.sourceRefs,
    createdAt: new Date(input.createdAt),
  };
  const c = provenanceCollection();
  const result = await c.updateOne({ _id: id }, { $setOnInsert: document }, { upsert: true });
  if (result.upsertedCount !== 1) {
    const existing = await c.findOne({ _id: id });
    if (!existing || canonicalJson(existing.sourceRefs) !== canonicalJson(input.sourceRefs)) {
      throw new Error(`OPERATIONAL_PROVENANCE_CONFLICT:${id}`);
    }
  }
}

export async function projectAppointmentDirectInput(workflowId: string): Promise<void> {
  await ensureOperationalInputIndexes();
  const config = loadRuntimeConfig();
  const audit = mongo().db(config.mongoDb).collection<Readonly<{
    eventType: string;
    logicalKey: string;
    businessSlug: string;
    workflowId: string;
    occurredAt: string;
    customerId?: string;
    metadata?: Readonly<Record<string, unknown>>;
  }>>('appointment_audit');
  const events = await audit.find({ workflowId }).sort({ occurredAt: 1 }).toArray();
  const created = events.find((event) => event.eventType === 'APPOINTMENT_CREATED');
  if (!created) return;
  const result = created.metadata?.result as Readonly<Record<string, unknown>> | undefined;
  const appointmentId = typeof result?.appointmentId === 'string' ? result.appointmentId : undefined;
  const caseId = typeof result?.caseId === 'string' ? result.caseId : undefined;
  const managedEntityId = typeof result?.managedEntityId === 'string' ? result.managedEntityId : undefined;
  if (!appointmentId || !caseId || !managedEntityId) throw new Error(`APPOINTMENT_DIRECT_INPUT_PROJECTION_MISSING_IDENTITY:${workflowId}`);

  const selectedService = events.find((event) => event.eventType === 'APPOINTMENT_SERVICE_SELECTED');
  const selectedProduct = events.find((event) => event.eventType === 'APPOINTMENT_PRODUCT_SELECTED');
  const selectedDate = events.find((event) => event.eventType === 'APPOINTMENT_DATE_SELECTED');
  const selectedSlot = [...events].reverse().find((event) => event.eventType === 'APPOINTMENT_SLOT_SELECTED');
  const service = selectedService?.metadata?.service as Readonly<Record<string, unknown>> | undefined;
  const product = selectedProduct?.metadata?.product as Readonly<Record<string, unknown>> | undefined;
  const slot = selectedSlot?.metadata?.slot as Readonly<Record<string, unknown>> | undefined;
  const providedAt = created.occurredAt;
  const elements: OperationalInputElement[] = [];
  const push = (semanticKey: string, label: string, value: unknown, type = 'selection'): void => {
    if (value === undefined || value === null || value === '') return;
    elements.push({ type, semanticKey, label, value, valueType: typeof value, status: 'validated', providedBy: workflowId, providedAt });
  };
  push('customer.id', 'Customer', created.customerId, 'reference');
  push('appointment.serviceId', 'Service', service?.serviceId ?? result?.serviceId);
  push('appointment.productId', 'Offering', product?.productId ?? result?.productId);
  push('appointment.date', 'Appointment date', selectedDate?.logicalKey ?? result?.appointmentDate, 'date');
  push('appointment.slotStart', 'Appointment slot start', slot?.start, 'time');
  push('appointment.slotEnd', 'Appointment slot end', slot?.end, 'time');

  const persisted = await persistOperationalDirectInput({
    businessSlug: created.businessSlug,
    caseId,
    managedEntityId,
    context: { type: 'appointment', id: appointmentId },
    inputType: 'appointment_workflow',
    workflowId,
    providedBy: { type: 'workflow', id: workflowId },
    inputElements: elements,
    validation: { status: 'valid', validatedBy: 'register-new-appointment', validatedAt: providedAt, errors: [] },
    createdAt: providedAt,
  });

  await persistOperationalProvenance({
    businessSlug: created.businessSlug,
    caseId,
    target: { type: 'appointment', id: appointmentId },
    sourceRefs: persisted.elementIds.map((elementId) => ({
      sourceType: 'operational_input_element' as const,
      sourceId: elementId,
      parentInputId: persisted.inputId,
      relationship: 'created_from' as const,
    })),
    createdAt: providedAt,
  });
}

export async function closeOperationalInputRepository(): Promise<void> {
  const current = client;
  client = undefined;
  indexesReady = undefined;
  if (current) await current.close();
}
