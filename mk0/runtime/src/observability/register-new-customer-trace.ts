import type { Client } from '@temporalio/client';
import {
  mergeCustomerDraft,
  normalizeRegistrationDraft,
  type ProvideCustomerDataInput,
  type RegisterNewCustomerDraft,
  type RegisterNewCustomerStartEnvelope,
  type RegistrationPhase,
  type RegistrationStateProjection,
} from '../contracts/register-new-customer/index.js';
import { FilesystemAttachmentStore } from '../persistence/attachments/filesystem-attachment-store.js';
import {
  loadMongoAuditEvidence,
  loadPostgresExecutionEvidence,
  type MongoAuditEvidence,
  type PostgresExecutionEvidence,
} from './execution-evidence.repository.js';
import { getRegistrationStateQuery } from '../orchestration/temporal/workflows/register-new-customer.workflow.js';

export type TraceTimelineEntry = Readonly<{
  at?: string;
  source: 'TEMPORAL' | 'MONGO' | 'POSTGRESQL' | 'ATTACHMENT_STORE';
  actor: string;
  action: string;
  target?: string;
  detail?: unknown;
}>;

export type TemporalHistoryEvidence = Readonly<{
  eventId: string;
  at?: string;
  type: string;
  activityType?: string;
  scheduledEventId?: string;
  updateName?: string;
  updateId?: string;
  input?: unknown;
}>;

export type RegisterNewCustomerExecutionTrace = Readonly<{
  schemaVersion: 'mk0.execution-trace.v1';
  generatedAt: string;
  workflow: Readonly<{
    workflowId: string;
    runId: string;
    workflowStatus: RegistrationStateProjection['workflowStatus'];
    phase: RegistrationPhase;
    currentStep: Readonly<{ ordinal: number; label: string }>;
    policyId?: string;
    policyVersion?: string;
    correlationId?: string;
    customerId?: string;
    created?: boolean;
    result?: RegistrationStateProjection['result'];
    failure?: RegistrationStateProjection['failure'];
  }>;
  conversation: Readonly<{
    knownFields: readonly string[];
    missingFields: readonly string[];
    nextAction?: RegistrationStateProjection['nextAction'];
    currentDraft: RegisterNewCustomerDraft;
    acceptedInputIds: readonly string[];
    updates: readonly Readonly<{
      eventId: string;
      at?: string;
      updateId?: string;
      input: ProvideCustomerDataInput;
      applied: boolean;
    }>[];
  }>;
  temporal: Readonly<{
    eventCount: number;
    activityScheduledCount: number;
    activityCompletedCount: number;
    activityFailedCount: number;
    updateAcceptedCount: number;
    updateCompletedCount: number;
    history: readonly TemporalHistoryEvidence[];
  }>;
  mongo: Readonly<{
    eventCount: number;
    audit: readonly MongoAuditEvidence[];
  }>;
  postgres: PostgresExecutionEvidence;
  attachmentStore: Readonly<{
    applicable: boolean;
    committed: readonly Readonly<{
      attachmentId: string;
      linkedFromPostgres: boolean;
      storeMetadataFound: boolean;
      metadata?: unknown;
    }>[];
  }>;
  timeline: readonly TraceTimelineEntry[];
  evidence: Readonly<{
    temporal: true;
    mongo: boolean;
    postgres: boolean;
    attachmentStore: 'NOT_APPLICABLE' | 'COMPLETE' | 'INCOMPLETE';
    warnings: readonly string[];
  }>;
}>;

type UnknownRecord = Record<string, unknown>;

const STEP_BY_PHASE: Readonly<Record<RegistrationPhase, Readonly<{ ordinal: number; label: string }>>> = {
  STARTED: { ordinal: 1, label: 'START WORKFLOW' },
  RESERVING_REGISTRATION: { ordinal: 2, label: 'RESERVE IDEMPOTENT REGISTRATION' },
  LOADING_REGISTRATION_POLICY: { ordinal: 3, label: 'LOAD REGISTRATION POLICY' },
  COLLECTING_DATA: { ordinal: 4, label: 'COLLECT CUSTOMER DATA' },
  VALIDATING_DRAFT: { ordinal: 5, label: 'VALIDATE CUSTOMER COMPLETENESS' },
  WAITING_FOR_REQUIRED_DATA: { ordinal: 6, label: 'WAIT FOR REQUIRED CUSTOMER DATA' },
  REQUIRED_DATA_COMPLETE: { ordinal: 7, label: 'REQUIRED DATA COMPLETE' },
  CHECKING_EXISTING_CUSTOMER: { ordinal: 8, label: 'CHECK DUPLICATES' },
  WAITING_FOR_DUPLICATE_DECISION: { ordinal: 9, label: 'WAIT FOR DUPLICATE DECISION' },
  PERSISTING_CUSTOMER: { ordinal: 10, label: 'PERSIST CUSTOMER' },
  PERSISTING_ATTACHMENTS: { ordinal: 11, label: 'COMMIT ATTACHMENTS' },
  LINKING_ATTACHMENTS: { ordinal: 12, label: 'LINK ATTACHMENTS' },
  PERSISTING_AUDIT_CONTEXT: { ordinal: 13, label: 'PERSIST AUDIT CONTEXT' },
  FINALIZING_CUSTOMER: { ordinal: 14, label: 'FINALIZE REGISTRATION' },
  ALREADY_EXISTS: { ordinal: 15, label: 'COMPLETE — ALREADY EXISTS' },
  CREATED: { ordinal: 15, label: 'COMPLETE — CREATED' },
  FAILED: { ordinal: 15, label: 'TERMINAL FAILURE' },
};

function record(value: unknown): UnknownRecord | undefined {
  return value && typeof value === 'object' ? (value as UnknownRecord) : undefined;
}

function eventId(value: unknown): string {
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'bigint') return String(value);
  const candidate = record(value);
  if (candidate && typeof candidate.toString === 'function') return String(candidate.toString());
  return '0';
}

function temporalTime(value: unknown): string | undefined {
  if (value instanceof Date) return value.toISOString();
  const timestamp = record(value);
  if (!timestamp) return undefined;
  const secondsValue = timestamp.seconds;
  const nanosValue = timestamp.nanos;
  let seconds: number | undefined;
  if (typeof secondsValue === 'number') seconds = secondsValue;
  else if (typeof secondsValue === 'bigint') seconds = Number(secondsValue);
  else {
    const secondsRecord = record(secondsValue);
    if (secondsRecord && typeof secondsRecord.toNumber === 'function') {
      const maybe = secondsRecord.toNumber as () => number;
      seconds = maybe.call(secondsValue);
    } else if (secondsValue !== undefined) {
      const parsed = Number(String(secondsValue));
      if (Number.isFinite(parsed)) seconds = parsed;
    }
  }
  if (seconds === undefined) return undefined;
  const nanos = typeof nanosValue === 'number' ? nanosValue : 0;
  return new Date(seconds * 1000 + Math.floor(nanos / 1_000_000)).toISOString();
}

function payloads(value: unknown): readonly unknown[] {
  const container = record(value);
  const list = container?.payloads;
  return Array.isArray(list) ? list : [];
}

function decodeJsonPayload(value: unknown): unknown {
  const payload = record(value);
  const data = payload?.data;
  if (data === undefined || data === null) return undefined;
  try {
    const bytes = data instanceof Uint8Array ? data : Buffer.from(data as ArrayBufferLike);
    return JSON.parse(Buffer.from(bytes).toString('utf8')) as unknown;
  } catch {
    return undefined;
  }
}

function firstDecodedArgument(value: unknown): unknown {
  const first = payloads(value)[0];
  return first === undefined ? undefined : decodeJsonPayload(first);
}

function temporalType(event: UnknownRecord): string {
  if (record(event.workflowExecutionStartedEventAttributes)) return 'WORKFLOW_EXECUTION_STARTED';
  if (record(event.workflowTaskScheduledEventAttributes)) return 'WORKFLOW_TASK_SCHEDULED';
  if (record(event.workflowTaskStartedEventAttributes)) return 'WORKFLOW_TASK_STARTED';
  if (record(event.workflowTaskCompletedEventAttributes)) return 'WORKFLOW_TASK_COMPLETED';
  if (record(event.activityTaskScheduledEventAttributes)) return 'ACTIVITY_TASK_SCHEDULED';
  if (record(event.activityTaskStartedEventAttributes)) return 'ACTIVITY_TASK_STARTED';
  if (record(event.activityTaskCompletedEventAttributes)) return 'ACTIVITY_TASK_COMPLETED';
  if (record(event.activityTaskFailedEventAttributes)) return 'ACTIVITY_TASK_FAILED';
  if (record(event.activityTaskTimedOutEventAttributes)) return 'ACTIVITY_TASK_TIMED_OUT';
  if (record(event.workflowExecutionUpdateAcceptedEventAttributes)) return 'WORKFLOW_EXECUTION_UPDATE_ACCEPTED';
  if (record(event.workflowExecutionUpdateCompletedEventAttributes)) return 'WORKFLOW_EXECUTION_UPDATE_COMPLETED';
  if (record(event.workflowExecutionUpdateRejectedEventAttributes)) return 'WORKFLOW_EXECUTION_UPDATE_REJECTED';
  if (record(event.workflowExecutionCompletedEventAttributes)) return 'WORKFLOW_EXECUTION_COMPLETED';
  if (record(event.workflowExecutionFailedEventAttributes)) return 'WORKFLOW_EXECUTION_FAILED';
  if (record(event.workflowExecutionCanceledEventAttributes)) return 'WORKFLOW_EXECUTION_CANCELED';
  if (record(event.timerStartedEventAttributes)) return 'TIMER_STARTED';
  if (record(event.timerFiredEventAttributes)) return 'TIMER_FIRED';
  return `EVENT_${String(event.eventType ?? 'UNKNOWN')}`;
}

function activityName(event: UnknownRecord): string | undefined {
  const attributes = record(event.activityTaskScheduledEventAttributes);
  const activityType = record(attributes?.activityType);
  return typeof activityType?.name === 'string' ? activityType.name : undefined;
}

function scheduledEventId(event: UnknownRecord): string | undefined {
  const attributes =
    record(event.activityTaskStartedEventAttributes) ??
    record(event.activityTaskCompletedEventAttributes) ??
    record(event.activityTaskFailedEventAttributes) ??
    record(event.activityTaskTimedOutEventAttributes);
  return attributes?.scheduledEventId === undefined ? undefined : eventId(attributes.scheduledEventId);
}

function updateAccepted(event: UnknownRecord): Readonly<{
  updateName?: string;
  updateId?: string;
  input?: unknown;
}> {
  const attributes = record(event.workflowExecutionUpdateAcceptedEventAttributes);
  const request = record(attributes?.acceptedRequest);
  const meta = record(request?.meta);
  const input = record(request?.input);
  return {
    ...(typeof input?.name === 'string' ? { updateName: input.name } : {}),
    ...(typeof meta?.updateId === 'string' ? { updateId: meta.updateId } : {}),
    ...(input?.args !== undefined ? { input: firstDecodedArgument(input.args) } : {}),
  };
}

function isProvideCustomerDataInput(value: unknown): value is ProvideCustomerDataInput {
  const candidate = record(value);
  return (
    typeof candidate?.inputId === 'string' &&
    Boolean(candidate.customerPatch) &&
    typeof candidate.customerPatch === 'object'
  );
}

function initialStartEnvelope(events: readonly UnknownRecord[]): RegisterNewCustomerStartEnvelope | undefined {
  for (const event of events) {
    const attributes = record(event.workflowExecutionStartedEventAttributes);
    if (!attributes) continue;
    const decoded = firstDecodedArgument(attributes.input);
    const candidate = record(decoded);
    if (candidate?.operation === 'RegisterNewCustomer' && typeof candidate.businessSlug === 'string') {
      return decoded as RegisterNewCustomerStartEnvelope;
    }
  }
  return undefined;
}

function acceptedAuditInputIds(audit: readonly MongoAuditEvidence[]): ReadonlySet<string> {
  return new Set(
    audit
      .filter((event) => event.eventType === 'CUSTOMER_DATA_ACCEPTED' && event.logicalKey.startsWith('update:'))
      .map((event) => event.logicalKey.slice('update:'.length)),
  );
}

function reconstructConversation(
  events: readonly UnknownRecord[],
  audit: readonly MongoAuditEvidence[],
): Readonly<{
  currentDraft: RegisterNewCustomerDraft;
  acceptedInputIds: readonly string[];
  updates: readonly Readonly<{
    eventId: string;
    at?: string;
    updateId?: string;
    input: ProvideCustomerDataInput;
    applied: boolean;
  }>[];
}> {
  const start = initialStartEnvelope(events);
  let draft = normalizeRegistrationDraft(start?.draft);
  const accepted = acceptedAuditInputIds(audit);
  const appliedIds = new Set<string>();
  const updates: Array<Readonly<{
    eventId: string;
    at?: string;
    updateId?: string;
    input: ProvideCustomerDataInput;
    applied: boolean;
  }>> = [];

  for (const event of events) {
    const attributes = record(event.workflowExecutionUpdateAcceptedEventAttributes);
    if (!attributes) continue;
    const update = updateAccepted(event);
    if (update.updateName !== 'ProvideCustomerData' || !isProvideCustomerDataInput(update.input)) continue;
    const applied = accepted.has(update.input.inputId) && !appliedIds.has(update.input.inputId);
    if (applied) {
      draft = {
        ...draft,
        customer: mergeCustomerDraft(draft.customer ?? {}, update.input.customerPatch),
      };
      appliedIds.add(update.input.inputId);
    }
    updates.push({
      eventId: eventId(event.eventId),
      ...(temporalTime(event.eventTime) ? { at: temporalTime(event.eventTime) } : {}),
      ...(update.updateId ? { updateId: update.updateId } : {}),
      input: update.input,
      applied,
    });
  }

  return { currentDraft: draft, acceptedInputIds: [...appliedIds], updates };
}

function summarizeTemporalHistory(events: readonly UnknownRecord[]): readonly TemporalHistoryEvidence[] {
  const scheduledNames = new Map<string, string>();
  const result: TemporalHistoryEvidence[] = [];

  for (const event of events) {
    const type = temporalType(event);
    const id = eventId(event.eventId);
    const at = temporalTime(event.eventTime);
    const scheduledName = activityName(event);
    if (scheduledName) scheduledNames.set(id, scheduledName);
    const scheduledId = scheduledEventId(event);
    const inheritedName = scheduledId ? scheduledNames.get(scheduledId) : undefined;
    const update = updateAccepted(event);

    result.push({
      eventId: id,
      ...(at ? { at } : {}),
      type,
      ...(scheduledName ?? inheritedName ? { activityType: scheduledName ?? inheritedName } : {}),
      ...(scheduledId ? { scheduledEventId: scheduledId } : {}),
      ...(update.updateName ? { updateName: update.updateName } : {}),
      ...(update.updateId ? { updateId: update.updateId } : {}),
      ...(update.input !== undefined ? { input: update.input } : {}),
    });
  }

  return result;
}

function timelineFromTemporal(history: readonly TemporalHistoryEvidence[]): TraceTimelineEntry[] {
  return history.flatMap((event): TraceTimelineEntry[] => {
    if (event.type === 'WORKFLOW_EXECUTION_STARTED') {
      return [{ ...(event.at ? { at: event.at } : {}), source: 'TEMPORAL', actor: 'CLIENT', action: 'START_WORKFLOW', target: 'TEMPORAL' }];
    }
    if (event.type === 'WORKFLOW_EXECUTION_UPDATE_ACCEPTED') {
      return [{
        ...(event.at ? { at: event.at } : {}),
        source: 'TEMPORAL',
        actor: 'CLIENT',
        action: `UPDATE_ACCEPTED ${event.updateName ?? 'UNKNOWN'}`,
        target: 'WORKFLOW',
        ...(event.input !== undefined ? { detail: event.input } : {}),
      }];
    }
    if (event.type === 'ACTIVITY_TASK_SCHEDULED') {
      return [{
        ...(event.at ? { at: event.at } : {}),
        source: 'TEMPORAL',
        actor: 'WORKFLOW',
        action: `SCHEDULE_ACTIVITY ${event.activityType ?? 'UNKNOWN'}`,
        target: 'WORKER',
      }];
    }
    if (event.type === 'ACTIVITY_TASK_COMPLETED') {
      return [{
        ...(event.at ? { at: event.at } : {}),
        source: 'TEMPORAL',
        actor: 'WORKER',
        action: `ACTIVITY_COMPLETED ${event.activityType ?? 'UNKNOWN'}`,
        target: 'WORKFLOW',
      }];
    }
    if (event.type === 'ACTIVITY_TASK_FAILED' || event.type === 'ACTIVITY_TASK_TIMED_OUT') {
      return [{
        ...(event.at ? { at: event.at } : {}),
        source: 'TEMPORAL',
        actor: 'WORKER',
        action: `${event.type} ${event.activityType ?? 'UNKNOWN'}`,
        target: 'WORKFLOW',
      }];
    }
    if (event.type === 'WORKFLOW_EXECUTION_COMPLETED' || event.type === 'WORKFLOW_EXECUTION_FAILED') {
      return [{ ...(event.at ? { at: event.at } : {}), source: 'TEMPORAL', actor: 'WORKFLOW', action: event.type, target: 'TEMPORAL' }];
    }
    return [];
  });
}

function timelineFromMongo(audit: readonly MongoAuditEvidence[]): TraceTimelineEntry[] {
  return audit.map((event) => ({
    at: event.occurredAt,
    source: 'MONGO',
    actor: 'WORKFLOW',
    action: event.eventType,
    target: 'MONGODB',
    detail: {
      logicalKey: event.logicalKey,
      phase: event.phase,
      ...(event.customerId ? { customerId: event.customerId } : {}),
      ...(event.metadata ? { metadata: event.metadata } : {}),
    },
  }));
}

function timelineFromPostgres(postgres: PostgresExecutionEvidence): TraceTimelineEntry[] {
  const result: TraceTimelineEntry[] = [];
  if (postgres.registration) {
    result.push({
      at: postgres.registration.createdAt,
      source: 'POSTGRESQL',
      actor: 'POSTGRESQL',
      action: 'REGISTRATION_OBSERVED',
      detail: {
        registrationId: postgres.registration.registrationId,
        status: postgres.registration.status,
      },
    });
    result.push({
      at: postgres.registration.updatedAt,
      source: 'POSTGRESQL',
      actor: 'POSTGRESQL',
      action: `REGISTRATION_STATUS ${postgres.registration.status}`,
      ...(postgres.registration.customerId ? { detail: { customerId: postgres.registration.customerId } } : {}),
    });
  }
  if (postgres.customer) {
    result.push({
      at: postgres.customer.createdAt,
      source: 'POSTGRESQL',
      actor: 'POSTGRESQL',
      action: 'CUSTOMER_PRESENT',
      detail: { customerId: postgres.customer.customerId, name: postgres.customer.name },
    });
  }
  return result;
}

function sortTimeline(entries: readonly TraceTimelineEntry[]): readonly TraceTimelineEntry[] {
  return [...entries].sort((left, right) => {
    if (!left.at && !right.at) return 0;
    if (!left.at) return 1;
    if (!right.at) return -1;
    return left.at.localeCompare(right.at);
  });
}

export async function buildRegisterNewCustomerExecutionTrace(
  client: Client,
  attachmentStore: FilesystemAttachmentStore,
  workflowId: string,
): Promise<RegisterNewCustomerExecutionTrace> {
  const handle = client.workflow.getHandle(workflowId);
  const [state, description, history, mongoAudit, postgresEvidence] = await Promise.all([
    handle.query(getRegistrationStateQuery),
    handle.describe(),
    handle.fetchHistory(),
    loadMongoAuditEvidence(workflowId),
    loadPostgresExecutionEvidence(workflowId),
  ]);

  const rawEvents = (history.events ?? []) as unknown as readonly UnknownRecord[];
  const temporalHistory = summarizeTemporalHistory(rawEvents);
  const conversation = reconstructConversation(rawEvents, mongoAudit);
  const pgAttachments = postgresEvidence.customer?.attachments ?? [];
  const committed = await Promise.all(
    pgAttachments.map(async (attachment) => {
      const metadata = await attachmentStore.getCommitted(attachment.attachmentId);
      return {
        attachmentId: attachment.attachmentId,
        linkedFromPostgres: true,
        storeMetadataFound: Boolean(metadata),
        ...(metadata ? { metadata } : {}),
      } as const;
    }),
  );

  const temporalCounts = {
    activityScheduledCount: temporalHistory.filter((event) => event.type === 'ACTIVITY_TASK_SCHEDULED').length,
    activityCompletedCount: temporalHistory.filter((event) => event.type === 'ACTIVITY_TASK_COMPLETED').length,
    activityFailedCount: temporalHistory.filter((event) => event.type === 'ACTIVITY_TASK_FAILED' || event.type === 'ACTIVITY_TASK_TIMED_OUT').length,
    updateAcceptedCount: temporalHistory.filter((event) => event.type === 'WORKFLOW_EXECUTION_UPDATE_ACCEPTED').length,
    updateCompletedCount: temporalHistory.filter((event) => event.type === 'WORKFLOW_EXECUTION_UPDATE_COMPLETED').length,
  };

  const warnings: string[] = [];
  if (!postgresEvidence.registration) warnings.push('POSTGRES_REGISTRATION_NOT_OBSERVED');
  if (mongoAudit.length === 0) warnings.push('MONGO_AUDIT_NOT_OBSERVED');
  const missingCommitted = committed.filter((item) => !item.storeMetadataFound);
  if (missingCommitted.length > 0) warnings.push('ATTACHMENT_STORE_METADATA_MISSING');

  const attachmentEvidence = pgAttachments.length === 0
    ? 'NOT_APPLICABLE' as const
    : missingCommitted.length === 0
      ? 'COMPLETE' as const
      : 'INCOMPLETE' as const;

  return {
    schemaVersion: 'mk0.execution-trace.v1',
    generatedAt: new Date().toISOString(),
    workflow: {
      workflowId,
      runId: description.runId,
      workflowStatus: state.workflowStatus,
      phase: state.phase,
      currentStep: STEP_BY_PHASE[state.phase],
      ...(state.policyId ? { policyId: state.policyId } : {}),
      ...(state.policyVersion ? { policyVersion: state.policyVersion } : {}),
      ...(state.correlationId ? { correlationId: state.correlationId } : {}),
      ...(state.customerId ? { customerId: state.customerId } : {}),
      ...(state.created !== undefined ? { created: state.created } : {}),
      ...(state.result ? { result: state.result } : {}),
      ...(state.failure ? { failure: state.failure } : {}),
    },
    conversation: {
      knownFields: state.knownFields,
      missingFields: state.missingFields,
      ...(state.nextAction ? { nextAction: state.nextAction } : {}),
      currentDraft: conversation.currentDraft,
      acceptedInputIds: conversation.acceptedInputIds,
      updates: conversation.updates,
    },
    temporal: {
      eventCount: temporalHistory.length,
      ...temporalCounts,
      history: temporalHistory,
    },
    mongo: {
      eventCount: mongoAudit.length,
      audit: mongoAudit,
    },
    postgres: postgresEvidence,
    attachmentStore: {
      applicable: pgAttachments.length > 0,
      committed,
    },
    timeline: sortTimeline([
      ...timelineFromTemporal(temporalHistory),
      ...timelineFromMongo(mongoAudit),
      ...timelineFromPostgres(postgresEvidence),
    ]),
    evidence: {
      temporal: true,
      mongo: mongoAudit.length > 0,
      postgres: Boolean(postgresEvidence.registration),
      attachmentStore: attachmentEvidence,
      warnings,
    },
  };
}
