export const REGISTER_NEW_CUSTOMER_OPERATION = 'RegisterNewCustomer' as const;
export const REGISTER_NEW_CUSTOMER_SCHEMA_VERSION = 'mk0.register-customer.v0' as const;

export type RegisterNewCustomerOperation = typeof REGISTER_NEW_CUSTOMER_OPERATION;
export type RegisterNewCustomerSchemaVersion = typeof REGISTER_NEW_CUSTOMER_SCHEMA_VERSION;

export type CustomerDocumentDraft = Readonly<{
  type?: string;
  value?: string;
  country?: string;
}>;

export type CustomerPhoneDraft = Readonly<{
  label?: string;
  countryCode?: string;
  number?: string;
  normalized?: string;
  isWhatsapp?: boolean;
  primary?: boolean;
}>;

export type CustomerContactDraft = Readonly<{
  phones?: readonly CustomerPhoneDraft[];
  email?: string;
}>;

export type CustomerDraft = Readonly<{
  type?: string;
  name?: string;
  document?: CustomerDocumentDraft;
  contact?: CustomerContactDraft;
  notes?: string;
}>;

export type AttachmentIngressDraft = Readonly<{
  ingressRef: string;
  kind?: string;
  displayName?: string;
  mediaType?: string;
  sha256?: string;
  byteLength?: number;
}>;

export type RegisterNewCustomerDraft = Readonly<{
  customer?: CustomerDraft;
  attachments?: readonly AttachmentIngressDraft[];
}>;

export type RegistrationCompletionMode = 'AUTO_WHEN_COMPLETE' | 'EXPLICIT_FINALIZE';
export type RegistrationPolicyVersion = '1' | '2';

export type RegistrationRequestMetadata = Readonly<{
  idempotencyKey: string;
  correlationId?: string;
  channel?: string;
  completionMode?: RegistrationCompletionMode;
  registrationPolicyVersion?: RegistrationPolicyVersion;
}>;

export type RegisterNewCustomerStartEnvelope = Readonly<{
  operation: RegisterNewCustomerOperation;
  businessSlug: string;
  draft?: RegisterNewCustomerDraft;
  request: RegistrationRequestMetadata;
  schemaVersion: RegisterNewCustomerSchemaVersion;
}>;

export type CustomerPatch = CustomerDraft;

export type ProvideCustomerDataInput = Readonly<{
  inputId: string;
  customerPatch: CustomerPatch;
}>;

export type DuplicateClassification = 'HARD_UNIQUE' | 'SOFT_MATCH' | 'NON_UNIQUE';

export type RegistrationPhase =
  | 'STARTED'
  | 'LOADING_REGISTRATION_POLICY'
  | 'COLLECTING_DATA'
  | 'VALIDATING_DRAFT'
  | 'WAITING_FOR_REQUIRED_DATA'
  | 'READY_TO_FINALIZE'
  | 'REQUIRED_DATA_COMPLETE'
  | 'CHECKING_EXISTING_CUSTOMER'
  | 'WAITING_FOR_DUPLICATE_DECISION'
  | 'RESERVING_REGISTRATION'
  | 'PERSISTING_CUSTOMER'
  | 'PERSISTING_ATTACHMENTS'
  | 'LINKING_ATTACHMENTS'
  | 'PERSISTING_AUDIT_CONTEXT'
  | 'FINALIZING_CUSTOMER'
  | 'ALREADY_EXISTS'
  | 'CREATED'
  | 'FAILED';

export type RegistrationWorkflowStatus = 'RUNNING' | 'COMPLETED' | 'FAILED';

export type RegistrationResult = Readonly<{
  created: boolean;
  customerId: string;
  reason?: string;
}>;

export type PossibleDuplicate = Readonly<{
  classification: 'SOFT_MATCH';
  candidateCustomerIds: readonly string[];
}>;

export type RegistrationStateProjection = Readonly<{
  workflowId: string;
  workflowStatus: RegistrationWorkflowStatus;
  phase: RegistrationPhase;
  policyId?: string;
  policyVersion?: string;
  knownFields: readonly string[];
  missingFields: readonly string[];
  validationErrors: readonly ContractIssue[];
  nextAction?: 'PROVIDE_CUSTOMER_DATA' | 'FINALIZE_REGISTRATION' | 'RESOLVE_DUPLICATE' | 'NONE';
  possibleDuplicate?: PossibleDuplicate;
  customerId?: string;
  created?: boolean;
  correlationId?: string;
  result?: RegistrationResult;
  failure?: Readonly<{ code: string; message: string }>;
}>;

export type ContractIssueCode =
  | 'INVALID_ENVELOPE'
  | 'UNKNOWN_OPERATION'
  | 'MISSING_BUSINESS_SLUG'
  | 'MISSING_IDEMPOTENCY_KEY'
  | 'UNSUPPORTED_SCHEMA_VERSION'
  | 'INVALID_DRAFT'
  | 'INVALID_ATTACHMENT_ENVELOPE'
  | 'INVALID_INPUT_ID'
  | 'INVALID_CUSTOMER_PATCH'
  | 'INVALID_REGISTRATION_POLICY';

export type ContractIssue = Readonly<{
  code: ContractIssueCode;
  path: string;
  message: string;
}>;

export type ContractValidationResult<T> =
  | Readonly<{ ok: true; value: T }>
  | Readonly<{ ok: false; issues: readonly ContractIssue[] }>;
