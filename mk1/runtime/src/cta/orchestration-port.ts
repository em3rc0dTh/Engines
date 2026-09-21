import type { RegisterNewCustomerStartEnvelope } from '../contracts/register-new-customer/index.js';

export type RegistrationStartReceipt = Readonly<{
  workflowId: string;
  runId?: string;
}>;

/**
 * Boundary implemented by the orchestration layer in B4.
 *
 * CTA adapters may depend on this interface but must never implement business
 * Workflow semantics or persistence themselves.
 */
export interface RegisterNewCustomerOrchestrationPort {
  startRegisterNewCustomer(envelope: RegisterNewCustomerStartEnvelope): Promise<RegistrationStartReceipt>;
}
