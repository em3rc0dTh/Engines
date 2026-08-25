import type {
  CustomerDraft,
  RegisterNewCustomerStartEnvelope,
  RegistrationPolicy,
} from '../../../contracts/register-new-customer/index.js';

export type RegistrationCommandStatus =
  | 'RESERVED'
  | 'SOFT_DUPLICATE_PENDING_DECISION'
  | 'EXISTING_CUSTOMER_PENDING_AUDIT'
  | 'CUSTOMER_CREATED_PENDING_AUDIT';

export type ReserveRegistrationInput = Readonly<{
  start: RegisterNewCustomerStartEnvelope;
  workflowId: string;
}>;

export type ReserveRegistrationResult =
  | Readonly<{
      kind: 'RESERVED';
      registrationId: string;
      workflowId: string;
      status: RegistrationCommandStatus;
    }>
  | Readonly<{
      kind: 'REPLAY';
      registrationId: string;
      workflowId: string;
      status: RegistrationCommandStatus;
      customerId?: string;
    }>
  | Readonly<{
      kind: 'CONFLICT';
      registrationId: string;
      workflowId: string;
      status: RegistrationCommandStatus;
    }>;

export type CheckDuplicateInput = Readonly<{
  businessSlug: string;
  customer: CustomerDraft;
  duplicatePolicy: RegistrationPolicy['duplicatePolicy'];
}>;

export type CheckDuplicateResult =
  | Readonly<{ classification: 'NONE' }>
  | Readonly<{ classification: 'HARD_UNIQUE'; customerId: string }>
  | Readonly<{ classification: 'SOFT_MATCH'; candidateCustomerIds: readonly string[] }>;

export type RecordExistingCustomerInput = Readonly<{
  registrationId: string;
  customerId: string;
}>;

export type RecordSoftDuplicateInput = Readonly<{
  registrationId: string;
}>;

export type CreateCustomerInput = Readonly<{
  registrationId: string;
  businessSlug: string;
  customer: CustomerDraft;
  enforceHardUniqueDocument: boolean;
}>;

export type CreateCustomerResult =
  | Readonly<{ kind: 'CREATED'; customerId: string; reused: boolean }>
  | Readonly<{ kind: 'HARD_DUPLICATE'; customerId: string }>;

export type PostgresRegistrationActivities = Readonly<{
  reserveRegistrationSession(input: ReserveRegistrationInput): Promise<ReserveRegistrationResult>;
  checkCustomerDuplicate(input: CheckDuplicateInput): Promise<CheckDuplicateResult>;
  recordExistingCustomer(input: RecordExistingCustomerInput): Promise<void>;
  recordSoftDuplicate(input: RecordSoftDuplicateInput): Promise<void>;
  createCustomer(input: CreateCustomerInput): Promise<CreateCustomerResult>;
}>;
