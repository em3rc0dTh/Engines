import type {
  CustomerDraft,
  RegisterNewCustomerStartEnvelope,
  RegistrationPolicy,
  RegistrationResult,
} from '../../../contracts/register-new-customer/index.js';

export type RegistrationCommandStatus =
  | 'RESERVED'
  | 'SOFT_DUPLICATE_PENDING_DECISION'
  | 'EXISTING_CUSTOMER_PENDING_AUDIT'
  | 'CUSTOMER_CREATED_PENDING_AUDIT'
  | 'EXISTING_CUSTOMER_AUDITED'
  | 'CUSTOMER_CREATED_AUDITED'
  | 'COMPLETED_ALREADY_EXISTS'
  | 'COMPLETED_CREATED';

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

export type RegistrationOutcomeKind = 'CREATED' | 'ALREADY_EXISTS';

export type MarkRegistrationAuditedInput = Readonly<{
  registrationId: string;
  customerId: string;
  outcome: RegistrationOutcomeKind;
}>;

export type CompleteRegistrationInput = Readonly<{
  registrationId: string;
  customerId: string;
  outcome: RegistrationOutcomeKind;
}>;

export type PostgresRegistrationActivities = Readonly<{
  reserveRegistrationSession(input: ReserveRegistrationInput): Promise<ReserveRegistrationResult>;
  checkCustomerDuplicate(input: CheckDuplicateInput): Promise<CheckDuplicateResult>;
  recordExistingCustomer(input: RecordExistingCustomerInput): Promise<void>;
  recordSoftDuplicate(input: RecordSoftDuplicateInput): Promise<void>;
  createCustomer(input: CreateCustomerInput): Promise<CreateCustomerResult>;
  markRegistrationAudited(input: MarkRegistrationAuditedInput): Promise<void>;
  completeRegistration(input: CompleteRegistrationInput): Promise<RegistrationResult>;
}>;
