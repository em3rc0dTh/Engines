import {
  REGISTER_NEW_CUSTOMER_OPERATION,
  REGISTER_NEW_CUSTOMER_SCHEMA_VERSION,
  type ContractIssue,
  type ContractValidationResult,
  type RegisterNewCustomerStartEnvelope,
  validateRegisterNewCustomerStart,
} from '../contracts/register-new-customer/index.js';

export type CtaTransportContext = Readonly<{
  channel: string;
}>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function adaptRegisterNewCustomerCtaInput(
  input: unknown,
  context: CtaTransportContext,
): ContractValidationResult<RegisterNewCustomerStartEnvelope> {
  if (!isRecord(input)) {
    const issue: ContractIssue = {
      code: 'INVALID_ENVELOPE',
      path: '$',
      message: 'CTA payload must be a JSON object',
    };
    return { ok: false, issues: [issue] };
  }

  const envelope = {
    operation: REGISTER_NEW_CUSTOMER_OPERATION,
    businessSlug: input.businessSlug,
    draft: input.draft,
    request: {
      idempotencyKey: input.idempotencyKey,
      correlationId: input.correlationId,
      channel: context.channel,
      completionMode: input.completionMode,
    },
    schemaVersion: REGISTER_NEW_CUSTOMER_SCHEMA_VERSION,
  };

  return validateRegisterNewCustomerStart(envelope);
}
