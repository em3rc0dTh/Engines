import {
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
  validateProvideCustomerData,
  type ContractIssue,
  type CustomerDraft,
  type ProvideCustomerDataInput,
  type RegisterNewCustomerDraft,
  type RegisterNewCustomerStartEnvelope,
  type RegistrationStateProjection,
} from '../../../contracts/register-new-customer/index.js';
import type { PostgresRegistrationActivities } from '../activities/postgres-registration.types.js';

const DOCUMENT_SELECTOR =
  'customer.document.type+customer.document.country+customer.document.value' as const;

const {
  reserveRegistrationSession,
  checkCustomerDuplicate,
  recordExistingCustomer,
  recordSoftDuplicate,
  createCustomer,
} = proxyActivities<PostgresRegistrationActivities>({
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

export const getRegistrationStateQuery = defineQuery<RegistrationStateProjection>('GetRegistrationState');
export const provideCustomerDataUpdate = defineUpdate<
  ProvideCustomerDataUpdateResult,
  [ProvideCustomerDataInput]
>('ProvideCustomerData');

function resolveMk0Policy(businessSlug: string) {
  return businessSlug === GOLDEN_REGISTRATION_POLICY_V1.businessSlug
    ? GOLDEN_REGISTRATION_POLICY_V1
    : undefined;
}

export async function registerNewCustomerWorkflow(
  start: RegisterNewCustomerStartEnvelope,
): Promise<never> {
  const info = workflowInfo();
  const policy = resolveMk0Policy(start.businessSlug);

  let phase: RegistrationStateProjection['phase'] = 'STARTED';
  let draft: RegisterNewCustomerDraft = normalizeRegistrationDraft(start.draft);
  const acceptedInputIds = new Set<string>();
  let workflowFailure: Readonly<{ code: string; message: string }> | undefined;
  let possibleDuplicate: RegistrationStateProjection['possibleDuplicate'];
  let customerId: string | undefined;
  let dataCollectionClosed = false;
  let registrationId: string | undefined;

  const completeness = () =>
    policy
      ? evaluateRegistrationCompleteness(policy, draft)
      : { complete: false, knownFields: [] as readonly string[], missingFields: [] as readonly string[] };

  const projectState = (): RegistrationStateProjection => {
    const current = completeness();
    const nextAction: RegistrationStateProjection['nextAction'] = workflowFailure
      ? 'NONE'
      : phase === 'WAITING_FOR_DUPLICATE_DECISION'
        ? 'RESOLVE_DUPLICATE'
        : current.complete
          ? 'NONE'
          : 'PROVIDE_CUSTOMER_DATA';

    return {
      workflowId: info.workflowId,
      workflowStatus: workflowFailure ? 'FAILED' : 'RUNNING',
      phase,
      ...(policy ? { policyId: policy.policyId, policyVersion: policy.policyVersion } : {}),
      knownFields: current.knownFields,
      missingFields: current.missingFields,
      validationErrors: [],
      nextAction,
      ...(possibleDuplicate ? { possibleDuplicate } : {}),
      ...(customerId ? { customerId } : {}),
      ...(start.request.correlationId ? { correlationId: start.request.correlationId } : {}),
      ...(workflowFailure ? { failure: workflowFailure } : {}),
    };
  };

  setHandler(getRegistrationStateQuery, projectState);

  setHandler(provideCustomerDataUpdate, (input: ProvideCustomerDataInput): ProvideCustomerDataUpdateResult => {
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

    const currentCustomer: CustomerDraft = draft.customer ?? {};
    draft = {
      ...draft,
      customer: mergeCustomerDraft(currentCustomer, validated.value.customerPatch),
    };
    acceptedInputIds.add(validated.value.inputId);

    const current = completeness();
    phase = current.complete ? 'REQUIRED_DATA_COMPLETE' : 'WAITING_FOR_REQUIRED_DATA';

    return { ok: true, duplicateInput: false, state: projectState() };
  });

  phase = 'RESERVING_REGISTRATION';
  const reservation = await reserveRegistrationSession({ start, workflowId: info.workflowId });
  registrationId = reservation.registrationId;
  if (reservation.kind === 'CONFLICT') {
    workflowFailure = {
      code: 'SESSION_IDEMPOTENCY_CONFLICT',
      message: 'The business-scoped idempotency identity is already reserved for different initial-start material',
    };
    phase = 'FAILED';
    await condition(() => false);
    throw new Error('unreachable');
  }

  phase = 'LOADING_REGISTRATION_POLICY';
  if (!policy) {
    workflowFailure = {
      code: 'REGISTRATION_POLICY_NOT_FOUND',
      message: `No mk0 RegistrationPolicy is configured for businessSlug ${start.businessSlug}`,
    };
    phase = 'FAILED';
    await condition(() => false);
    throw new Error('unreachable');
  }

  phase = 'VALIDATING_DRAFT';
  if (!completeness().complete) {
    phase = 'WAITING_FOR_REQUIRED_DATA';
    await condition(() => completeness().complete || Boolean(workflowFailure));
  }

  if (workflowFailure) {
    phase = 'FAILED';
    await condition(() => false);
    throw new Error('unreachable');
  }

  phase = 'REQUIRED_DATA_COMPLETE';
  dataCollectionClosed = true;

  if ((draft.attachments ?? []).length > 0) {
    workflowFailure = {
      code: 'ATTACHMENT_BUILD_GATE_CLOSED',
      message: 'Attachment-bearing registration is gated until B7 AttachmentStore is authorized',
    };
    phase = 'FAILED';
    await condition(() => false);
    throw new Error('unreachable');
  }

  phase = 'CHECKING_EXISTING_CUSTOMER';
  const duplicate = await checkCustomerDuplicate({
    businessSlug: start.businessSlug,
    customer: draft.customer ?? {},
    duplicatePolicy: policy.duplicatePolicy,
  });

  if (duplicate.classification === 'SOFT_MATCH') {
    await recordSoftDuplicate({ registrationId });
    possibleDuplicate = {
      classification: 'SOFT_MATCH',
      candidateCustomerIds: duplicate.candidateCustomerIds,
    };
    phase = 'WAITING_FOR_DUPLICATE_DECISION';
    await condition(() => false);
    throw new Error('unreachable');
  }

  if (duplicate.classification === 'HARD_UNIQUE') {
    customerId = duplicate.customerId;
    await recordExistingCustomer({ registrationId, customerId });
    phase = 'PERSISTING_AUDIT_CONTEXT';
    await condition(() => false);
    throw new Error('unreachable');
  }

  phase = 'PERSISTING_CUSTOMER';
  const persisted = await createCustomer({
    registrationId,
    businessSlug: start.businessSlug,
    customer: draft.customer ?? {},
    enforceHardUniqueDocument: policy.duplicatePolicy.hardUnique.includes(DOCUMENT_SELECTOR),
  });
  customerId = persisted.customerId;

  // A hard duplicate may still be detected transactionally during create if a
  // concurrent registration inserted the same policy-hard document after the
  // earlier lookup. Both paths wait for B6 mandatory audit before success.
  phase = 'PERSISTING_AUDIT_CONTEXT';
  await condition(() => false);
  throw new Error('unreachable');
}
