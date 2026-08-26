import {
  ApplicationFailure,
  condition,
  defineQuery,
  defineUpdate,
  proxyActivities,
  setHandler,
  workflowInfo,
} from '@temporalio/workflow';
import {
  GOLDEN_REGISTRATION_POLICY_V1,
  evaluateRegistrationCompleteness,
  mergeCustomerDraft,
  normalizeRegistrationDraft,
  serializeInitialStartFingerprintMaterial,
  validateProvideCustomerData,
  type ContractIssue,
  type CustomerDraft,
  type ProvideCustomerDataInput,
  type RegisterNewCustomerDraft,
  type RegisterNewCustomerStartEnvelope,
  type RegistrationResult,
  type RegistrationStateProjection,
} from '../../../contracts/register-new-customer/index.js';
import type {
  CommitAttachmentInput,
  CommittedAttachmentMetadata,
  StagedAttachmentMetadata,
} from '../../../persistence/attachments/attachment-store.types.js';
import type { AttachmentStoreActivities } from '../activities/attachment-store.types.js';
import type {
  MongoRegistrationAuditActivities,
  RegistrationAuditEventInput,
} from '../activities/mongo-registration-audit.types.js';
import type {
  PostgresRegistrationActivities,
  RegistrationOutcomeKind,
} from '../activities/postgres-registration.types.js';

const DOCUMENT_SELECTOR =
  'customer.document.type+customer.document.country+customer.document.value' as const;
const MK0_ATTACHMENT_MAX_COUNT = 4;
const MK0_ATTACHMENT_MAX_TOTAL_BYTES = 2 * 1024 * 1024;

const postgres = proxyActivities<PostgresRegistrationActivities>({
  startToCloseTimeout: '5s',
  retry: {
    initialInterval: '250ms',
    backoffCoefficient: 2,
    maximumAttempts: 3,
  },
});

const mongoAudit = proxyActivities<MongoRegistrationAuditActivities>({
  startToCloseTimeout: '5s',
  retry: {
    initialInterval: '250ms',
    backoffCoefficient: 2,
    maximumAttempts: 3,
  },
});

const attachmentStore = proxyActivities<AttachmentStoreActivities>({
  startToCloseTimeout: '5s',
  retry: {
    initialInterval: '250ms',
    backoffCoefficient: 2,
    maximumAttempts: 3,
  },
});

export type ProvideCustomerDataUpdateResult =
  | Readonly<{ ok: true; duplicateInput: boolean; state: RegistrationStateProjection }>
  | Readonly<{ ok: false; issues: readonly ContractIssue[]; state: RegistrationStateProjection }>;

export type FinalizeRegistrationInput = Readonly<{ inputId: string }>;
export type FinalizeRegistrationUpdateResult =
  | Readonly<{ ok: true; duplicateInput: boolean; state: RegistrationStateProjection }>
  | Readonly<{ ok: false; issues: readonly ContractIssue[]; state: RegistrationStateProjection }>;

export const getRegistrationStateQuery = defineQuery<RegistrationStateProjection>('GetRegistrationState');
export const getInitialStartFingerprintQuery = defineQuery<string>('GetInitialStartFingerprint');
export const provideCustomerDataUpdate = defineUpdate<
  ProvideCustomerDataUpdateResult,
  [ProvideCustomerDataInput]
>('ProvideCustomerData');
export const finalizeRegistrationUpdate = defineUpdate<
  FinalizeRegistrationUpdateResult,
  [FinalizeRegistrationInput]
>('FinalizeRegistration');

function resolveMk0Policy(businessSlug: string) {
  return businessSlug === GOLDEN_REGISTRATION_POLICY_V1.businessSlug
    ? GOLDEN_REGISTRATION_POLICY_V1
    : undefined;
}

function workflowTimestamp(): string {
  return new Date(Date.now()).toISOString();
}

export async function registerNewCustomerWorkflow(
  start: RegisterNewCustomerStartEnvelope,
): Promise<RegistrationResult> {
  const info = workflowInfo();
  const policy = resolveMk0Policy(start.businessSlug);
  const initialStartFingerprint = serializeInitialStartFingerprintMaterial(start);
  const explicitFinalize = start.request.completionMode === 'EXPLICIT_FINALIZE';

  let phase: RegistrationStateProjection['phase'] = 'STARTED';
  let draft: RegisterNewCustomerDraft = normalizeRegistrationDraft(start.draft);
  const acceptedInputIds = new Set<string>();
  const acceptedFinalizeInputIds = new Set<string>();
  const requiredAuditEvents: Array<Readonly<{ eventType: RegistrationAuditEventInput['eventType']; logicalKey: string }>> = [];
  let workflowFailure: Readonly<{ code: string; message: string }> | undefined;
  let possibleDuplicate: RegistrationStateProjection['possibleDuplicate'];
  let customerId: string | undefined;
  let dataCollectionClosed = false;
  let finalizeRequested = false;
  let registrationId: string | undefined;
  let terminalResult: RegistrationResult | undefined;

  const completeness = () =>
    policy
      ? evaluateRegistrationCompleteness(policy, draft)
      : { complete: false, knownFields: [] as readonly string[], missingFields: [] as readonly string[] };

  const projectState = (): RegistrationStateProjection => {
    const current = completeness();
    const nextAction: RegistrationStateProjection['nextAction'] = workflowFailure || terminalResult
      ? 'NONE'
      : phase === 'WAITING_FOR_DUPLICATE_DECISION'
        ? 'RESOLVE_DUPLICATE'
        : explicitFinalize && current.complete && !finalizeRequested && !dataCollectionClosed
          ? 'FINALIZE_REGISTRATION'
          : current.complete
            ? 'NONE'
            : 'PROVIDE_CUSTOMER_DATA';

    return {
      workflowId: info.workflowId,
      workflowStatus: workflowFailure ? 'FAILED' : terminalResult ? 'COMPLETED' : 'RUNNING',
      phase,
      ...(policy ? { policyId: policy.policyId, policyVersion: policy.policyVersion } : {}),
      knownFields: current.knownFields,
      missingFields: current.missingFields,
      validationErrors: [],
      nextAction,
      ...(possibleDuplicate ? { possibleDuplicate } : {}),
      ...(customerId ? { customerId } : {}),
      ...(terminalResult ? { created: terminalResult.created, result: terminalResult } : {}),
      ...(start.request.correlationId ? { correlationId: start.request.correlationId } : {}),
      ...(workflowFailure ? { failure: workflowFailure } : {}),
    };
  };

  const auditEvent = (
    eventType: RegistrationAuditEventInput['eventType'],
    logicalKey: string,
    eventPhase: string,
    metadata?: Readonly<Record<string, unknown>>,
    eventCustomerId?: string,
  ): RegistrationAuditEventInput => ({
    eventType,
    logicalKey,
    schemaVersion: start.schemaVersion,
    businessSlug: start.businessSlug,
    workflowId: info.workflowId,
    ...(start.request.correlationId ? { correlationId: start.request.correlationId } : {}),
    ...(eventCustomerId ? { customerId: eventCustomerId } : {}),
    phase: eventPhase,
    occurredAt: workflowTimestamp(),
    ...(metadata ? { metadata } : {}),
  });

  const persistMandatoryAudit = async (events: readonly RegistrationAuditEventInput[]): Promise<void> => {
    try {
      await mongoAudit.persistRegistrationAudit({ events });
      for (const event of events) {
        if (!requiredAuditEvents.some(
          (required) => required.eventType === event.eventType && required.logicalKey === event.logicalKey,
        )) {
          requiredAuditEvents.push({ eventType: event.eventType, logicalKey: event.logicalKey });
        }
      }
    } catch (error) {
      workflowFailure = {
        code: 'MONGO_AUDIT_STORE_UNAVAILABLE',
        message: error instanceof Error ? error.message : String(error),
      };
      phase = 'FAILED';
      throw ApplicationFailure.nonRetryable(
        'Mandatory MongoDB audit could not be persisted',
        'MONGO_AUDIT_STORE_UNAVAILABLE',
      );
    }
  };

  const verifyMandatoryAudit = async (): Promise<void> => {
    try {
      const verified = await mongoAudit.verifyRegistrationAudit({
        workflowId: info.workflowId,
        requiredLogicalEvents: requiredAuditEvents,
      });
      if (!verified.complete) {
        throw new Error(`missing mandatory audit events: ${verified.missing.join(',')}`);
      }
    } catch (error) {
      workflowFailure = {
        code: 'MONGO_AUDIT_STORE_UNAVAILABLE',
        message: error instanceof Error ? error.message : String(error),
      };
      phase = 'FAILED';
      throw ApplicationFailure.nonRetryable(
        'Mandatory MongoDB audit verification failed',
        'MONGO_AUDIT_STORE_UNAVAILABLE',
      );
    }
  };

  const throwIfWorkflowFailed = (): void => {
    const failure: Readonly<{ code: string; message: string }> | undefined = workflowFailure;
    if (!failure) return;
    phase = 'FAILED';
    throw ApplicationFailure.nonRetryable(failure.message, failure.code);
  };

  const failAttachment = (code: string, message: string): never => {
    workflowFailure = { code, message };
    phase = 'FAILED';
    throw ApplicationFailure.nonRetryable(message, code);
  };

  const resolveAttachmentIngress = async (ingressRef: string): Promise<StagedAttachmentMetadata> => {
    const resolved = await attachmentStore
      .resolveAttachmentIngress({ ingressRef })
      .catch((error: unknown): never =>
        failAttachment(
          'ATTACHMENT_STORE_UNAVAILABLE',
          error instanceof Error ? error.message : String(error),
        ),
      );
    if (resolved.kind !== 'RESOLVED') {
      return failAttachment(resolved.kind, resolved.message);
    }
    return resolved.ingress;
  };

  const commitAttachment = async (input: CommitAttachmentInput): Promise<CommittedAttachmentMetadata> => {
    const committed = await attachmentStore
      .commitAttachment(input)
      .catch((error: unknown): never =>
        failAttachment(
          'ATTACHMENT_STORE_UNAVAILABLE',
          error instanceof Error ? error.message : String(error),
        ),
      );
    if (committed.kind !== 'COMMITTED') {
      return failAttachment(committed.kind, committed.message);
    }
    return committed.attachment;
  };

  setHandler(getRegistrationStateQuery, projectState);
  setHandler(getInitialStartFingerprintQuery, () => initialStartFingerprint);

  setHandler(provideCustomerDataUpdate, async (input: ProvideCustomerDataInput): Promise<ProvideCustomerDataUpdateResult> => {
    if (workflowFailure) {
      return {
        ok: false,
        issues: [
          {
            code: 'INVALID_REGISTRATION_POLICY',
            path: 'workflow',
            message: workflowFailure.message,
          },
        ],
        state: projectState(),
      };
    }

    const validated = validateProvideCustomerData(input);
    if (!validated.ok) {
      return { ok: false, issues: validated.issues, state: projectState() };
    }

    if (acceptedInputIds.has(validated.value.inputId)) {
      return { ok: true, duplicateInput: true, state: projectState() };
    }

    if (dataCollectionClosed) {
      return {
        ok: false,
        issues: [
          {
            code: 'INVALID_CUSTOMER_PATCH',
            path: 'phase',
            message: `Customer data collection is closed in phase ${phase}`,
          },
        ],
        state: projectState(),
      };
    }

    await persistMandatoryAudit([
      auditEvent(
        'CUSTOMER_DATA_ACCEPTED',
        `update:${validated.value.inputId}`,
        phase,
        { source: 'WORKFLOW_UPDATE', inputId: validated.value.inputId },
      ),
    ]);

    const currentCustomer: CustomerDraft = draft.customer ?? {};
    draft = {
      ...draft,
      customer: mergeCustomerDraft(currentCustomer, validated.value.customerPatch),
    };
    acceptedInputIds.add(validated.value.inputId);

    const current = completeness();
    phase = current.complete
      ? explicitFinalize
        ? 'READY_TO_FINALIZE'
        : 'REQUIRED_DATA_COMPLETE'
      : 'WAITING_FOR_REQUIRED_DATA';

    return { ok: true, duplicateInput: false, state: projectState() };
  });

  setHandler(finalizeRegistrationUpdate, async (input: FinalizeRegistrationInput): Promise<FinalizeRegistrationUpdateResult> => {
    if (!explicitFinalize) {
      return {
        ok: false,
        issues: [{
          code: 'INVALID_CUSTOMER_PATCH',
          path: 'request.completionMode',
          message: 'FinalizeRegistration is only valid for EXPLICIT_FINALIZE sessions',
        }],
        state: projectState(),
      };
    }

    const inputId = input.inputId?.trim();
    if (!inputId) {
      return {
        ok: false,
        issues: [{ code: 'INVALID_INPUT_ID', path: 'inputId', message: 'inputId is required' }],
        state: projectState(),
      };
    }

    if (acceptedFinalizeInputIds.has(inputId)) {
      return { ok: true, duplicateInput: true, state: projectState() };
    }

    if (workflowFailure || terminalResult || dataCollectionClosed) {
      return {
        ok: false,
        issues: [{
          code: 'INVALID_CUSTOMER_PATCH',
          path: 'phase',
          message: `Registration cannot be finalized in phase ${phase}`,
        }],
        state: projectState(),
      };
    }

    const current = completeness();
    if (!current.complete) {
      return {
        ok: false,
        issues: [{
          code: 'INVALID_CUSTOMER_PATCH',
          path: 'draft',
          message: `Required registration data is still missing: ${current.missingFields.join(', ')}`,
        }],
        state: projectState(),
      };
    }

    acceptedFinalizeInputIds.add(inputId);
    finalizeRequested = true;
    dataCollectionClosed = true;
    phase = 'REQUIRED_DATA_COMPLETE';

    await persistMandatoryAudit([
      auditEvent(
        'REGISTRATION_FINALIZE_REQUESTED',
        `finalize:${inputId}`,
        'READY_TO_FINALIZE',
        { source: 'WORKFLOW_UPDATE', inputId },
      ),
    ]);

    return { ok: true, duplicateInput: false, state: projectState() };
  });

  phase = 'RESERVING_REGISTRATION';
  const reservation = await postgres.reserveRegistrationSession({ start, workflowId: info.workflowId });
  registrationId = reservation.registrationId;
  if (reservation.kind === 'CONFLICT') {
    workflowFailure = {
      code: 'SESSION_IDEMPOTENCY_CONFLICT',
      message: 'The business-scoped idempotency identity is already reserved for different initial-start material',
    };
    phase = 'FAILED';
    throw ApplicationFailure.nonRetryable(workflowFailure.message, workflowFailure.code);
  }

  phase = 'LOADING_REGISTRATION_POLICY';
  if (!policy) {
    workflowFailure = {
      code: 'REGISTRATION_POLICY_NOT_FOUND',
      message: `No mk0 RegistrationPolicy is configured for businessSlug ${start.businessSlug}`,
    };
    phase = 'FAILED';
    throw ApplicationFailure.nonRetryable(workflowFailure.message, workflowFailure.code);
  }

  await persistMandatoryAudit([
    auditEvent('REGISTRATION_SESSION_STARTED', 'session', 'STARTED', {
      operation: start.operation,
      channel: start.request.channel ?? 'unknown',
      completionMode: start.request.completionMode ?? 'AUTO_WHEN_COMPLETE',
      attachmentCount: (start.draft?.attachments ?? []).length,
    }),
    auditEvent('REGISTRATION_POLICY_LOADED', 'policy', 'LOADING_REGISTRATION_POLICY', {
      policyId: policy.policyId,
      policyVersion: policy.policyVersion,
    }),
    auditEvent('CUSTOMER_DATA_ACCEPTED', 'start', 'STARTED', {
      source: 'START_ENVELOPE',
    }),
  ]);

  phase = 'VALIDATING_DRAFT';
  if (!completeness().complete) {
    const missing = completeness().missingFields;
    await persistMandatoryAudit([
      auditEvent('REQUIRED_DATA_REQUESTED', 'required-data', 'WAITING_FOR_REQUIRED_DATA', {
        missingFields: missing,
      }),
    ]);
    phase = 'WAITING_FOR_REQUIRED_DATA';
    await condition(() => completeness().complete || Boolean(workflowFailure));
  }

  throwIfWorkflowFailed();

  if (explicitFinalize && !finalizeRequested) {
    phase = 'READY_TO_FINALIZE';
    await condition(() => finalizeRequested || Boolean(workflowFailure));
  }

  throwIfWorkflowFailed();

  phase = 'REQUIRED_DATA_COMPLETE';
  dataCollectionClosed = true;

  const attachments = draft.attachments ?? [];
  if (attachments.length > MK0_ATTACHMENT_MAX_COUNT) {
    failAttachment(
      'ATTACHMENT_LIMIT_EXCEEDED',
      `Registration contains ${attachments.length} attachments; maximum is ${MK0_ATTACHMENT_MAX_COUNT}`,
    );
  }

  const resolvedAttachments = new Map<string, StagedAttachmentMetadata>();
  const seenIngressRefs = new Set<string>();
  let totalAttachmentBytes = 0;

  for (const attachment of attachments) {
    if (seenIngressRefs.has(attachment.ingressRef)) {
      failAttachment('ATTACHMENT_INGRESS_CONFLICT', `Duplicate ingressRef ${attachment.ingressRef}`);
    }
    seenIngressRefs.add(attachment.ingressRef);

    const ingress = await resolveAttachmentIngress(attachment.ingressRef);
    if (attachment.sha256 && attachment.sha256 !== ingress.sha256) {
      failAttachment(
        'ATTACHMENT_INTEGRITY_MISMATCH',
        `Workflow SHA-256 expectation differs for ${attachment.ingressRef}`,
      );
    }
    if (attachment.byteLength !== undefined && attachment.byteLength !== ingress.byteLength) {
      failAttachment(
        'ATTACHMENT_INTEGRITY_MISMATCH',
        `Workflow byte-length expectation differs for ${attachment.ingressRef}`,
      );
    }
    if (attachment.mediaType && attachment.mediaType !== ingress.mediaType) {
      failAttachment(
        'ATTACHMENT_INTEGRITY_MISMATCH',
        `Workflow media-type expectation differs for ${attachment.ingressRef}`,
      );
    }

    resolvedAttachments.set(attachment.ingressRef, ingress);
    totalAttachmentBytes += ingress.byteLength;
  }

  if (totalAttachmentBytes > MK0_ATTACHMENT_MAX_TOTAL_BYTES) {
    failAttachment(
      'ATTACHMENT_LIMIT_EXCEEDED',
      `Registration attachment bytes ${totalAttachmentBytes} exceed ${MK0_ATTACHMENT_MAX_TOTAL_BYTES}`,
    );
  }

  phase = 'CHECKING_EXISTING_CUSTOMER';
  const duplicate = await postgres.checkCustomerDuplicate({
    businessSlug: start.businessSlug,
    customer: draft.customer ?? {},
    duplicatePolicy: policy.duplicatePolicy,
  });

  await persistMandatoryAudit([
    auditEvent('DUPLICATE_CHECK_COMPLETED', 'primary', 'CHECKING_EXISTING_CUSTOMER', {
      classification: duplicate.classification,
      candidateCount: duplicate.classification === 'SOFT_MATCH' ? duplicate.candidateCustomerIds.length : duplicate.classification === 'HARD_UNIQUE' ? 1 : 0,
    }),
  ]);

  if (duplicate.classification === 'SOFT_MATCH') {
    await postgres.recordSoftDuplicate({ registrationId });
    possibleDuplicate = {
      classification: 'SOFT_MATCH',
      candidateCustomerIds: duplicate.candidateCustomerIds,
    };
    await verifyMandatoryAudit();
    phase = 'WAITING_FOR_DUPLICATE_DECISION';
    await condition(() => false);
    throw new Error('unreachable');
  }

  let outcome: RegistrationOutcomeKind;

  if (duplicate.classification === 'HARD_UNIQUE') {
    customerId = duplicate.customerId;
    outcome = 'ALREADY_EXISTS';
    await postgres.recordExistingCustomer({ registrationId, customerId });
  } else {
    phase = 'PERSISTING_CUSTOMER';
    const persisted = await postgres.createCustomer({
      registrationId,
      businessSlug: start.businessSlug,
      customer: draft.customer ?? {},
      enforceHardUniqueDocument: policy.duplicatePolicy.hardUnique.includes(DOCUMENT_SELECTOR),
    });
    customerId = persisted.customerId;
    outcome = persisted.kind === 'HARD_DUPLICATE' ? 'ALREADY_EXISTS' : 'CREATED';
  }

  if (attachments.length > 0) {
    phase = 'PERSISTING_ATTACHMENTS';
    for (const attachment of attachments) {
      const resolved = resolvedAttachments.get(attachment.ingressRef);
      if (resolved === undefined) {
        workflowFailure = {
          code: 'ATTACHMENT_INGRESS_NOT_FOUND',
          message: `Resolved attachment metadata disappeared for ${attachment.ingressRef}`,
        };
        phase = 'FAILED';
        throw ApplicationFailure.nonRetryable(
          workflowFailure.message,
          workflowFailure.code,
        );
      }

      const committed = await commitAttachment({
        ingressRef: attachment.ingressRef,
        expectedSha256: attachment.sha256 ?? resolved.sha256,
        expectedByteLength: attachment.byteLength ?? resolved.byteLength,
        expectedMediaType: attachment.mediaType ?? resolved.mediaType,
      });

      phase = 'LINKING_ATTACHMENTS';
      await postgres.linkCustomerAttachment({
        customerId,
        attachment: committed,
        ...(attachment.kind ? { kind: attachment.kind } : {}),
        ...(attachment.displayName ? { displayName: attachment.displayName } : {}),
      });

      phase = 'PERSISTING_ATTACHMENTS';
      await persistMandatoryAudit([
        auditEvent(
          'ATTACHMENT_COMMITTED',
          `attachment:${attachment.ingressRef}`,
          phase,
          {
            attachmentId: committed.attachmentId,
            ingressRef: attachment.ingressRef,
            kind: attachment.kind ?? null,
            mediaType: committed.mediaType,
            byteLength: committed.byteLength,
            sha256: committed.sha256,
          },
          customerId,
        ),
      ]);
    }
  }

  phase = 'PERSISTING_AUDIT_CONTEXT';
  await persistMandatoryAudit([
    outcome === 'CREATED'
      ? auditEvent('CUSTOMER_CREATED', 'customer', phase, { outcome }, customerId)
      : auditEvent('EXISTING_CUSTOMER_RESOLVED', 'customer', phase, { outcome }, customerId),
  ]);
  await verifyMandatoryAudit();

  phase = 'FINALIZING_CUSTOMER';
  await postgres.markRegistrationAudited({ registrationId, customerId, outcome });

  await persistMandatoryAudit([
    auditEvent('REGISTRATION_COMPLETED', 'terminal', 'FINALIZING_CUSTOMER', { outcome }, customerId),
  ]);
  await verifyMandatoryAudit();

  terminalResult = await postgres.completeRegistration({ registrationId, customerId, outcome });
  phase = outcome === 'CREATED' ? 'CREATED' : 'ALREADY_EXISTS';
  return terminalResult;
}
