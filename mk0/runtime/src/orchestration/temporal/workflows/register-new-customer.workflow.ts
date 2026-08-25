import { condition, defineQuery, defineUpdate, setHandler, workflowInfo } from '@temporalio/workflow';
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
  let policyFailure: Readonly<{ code: string; message: string }> | undefined;

  const completeness = () =>
    policy
      ? evaluateRegistrationCompleteness(policy, draft)
      : { complete: false, knownFields: [] as readonly string[], missingFields: [] as readonly string[] };

  const projectState = (): RegistrationStateProjection => {
    const current = completeness();
    return {
      workflowId: info.workflowId,
      workflowStatus: policyFailure ? 'FAILED' : 'RUNNING',
      phase,
      ...(policy ? { policyId: policy.policyId, policyVersion: policy.policyVersion } : {}),
      knownFields: current.knownFields,
      missingFields: current.missingFields,
      validationErrors: [],
      nextAction: policyFailure
        ? 'NONE'
        : current.complete
          ? 'NONE'
          : 'PROVIDE_CUSTOMER_DATA',
      ...(start.request.correlationId ? { correlationId: start.request.correlationId } : {}),
      ...(policyFailure ? { failure: policyFailure } : {}),
    };
  };

  setHandler(getRegistrationStateQuery, projectState);

  setHandler(provideCustomerDataUpdate, (input: ProvideCustomerDataInput): ProvideCustomerDataUpdateResult => {
    if (policyFailure) {
      return {
        ok: false,
        issues: [
          {
            code: 'INVALID_REGISTRATION_POLICY',
            path: 'businessSlug',
            message: policyFailure.message,
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

  phase = 'LOADING_REGISTRATION_POLICY';
  if (!policy) {
    policyFailure = {
      code: 'REGISTRATION_POLICY_NOT_FOUND',
      message: `No mk0 RegistrationPolicy is configured for businessSlug ${start.businessSlug}`,
    };
    phase = 'FAILED';
    await condition(() => false);
    throw new Error('unreachable');
  }

  phase = 'VALIDATING_DRAFT';
  phase = completeness().complete ? 'REQUIRED_DATA_COMPLETE' : 'WAITING_FOR_REQUIRED_DATA';

  // B4 deliberately remains running after required data is complete. B5/B6 own
  // duplicate checks, persistence and terminal CREATED/ALREADY_EXISTS outcomes.
  await condition(() => false);
  throw new Error('unreachable');
}
