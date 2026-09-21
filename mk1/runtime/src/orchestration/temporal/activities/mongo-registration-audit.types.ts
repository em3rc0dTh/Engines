export type RegistrationAuditEventType =
  | 'REGISTRATION_SESSION_STARTED'
  | 'REGISTRATION_POLICY_LOADED'
  | 'REQUIRED_DATA_REQUESTED'
  | 'CUSTOMER_DATA_ACCEPTED'
  | 'REGISTRATION_FINALIZE_REQUESTED'
  | 'DUPLICATE_CHECK_COMPLETED'
  | 'DUPLICATE_DECISION_ACCEPTED'
  | 'EXISTING_CUSTOMER_RESOLVED'
  | 'CUSTOMER_CREATED'
  | 'ATTACHMENT_COMMITTED'
  | 'REGISTRATION_COMPLETED';

export type RegistrationAuditEventInput = Readonly<{
  eventType: RegistrationAuditEventType;
  logicalKey: string;
  schemaVersion: string;
  businessSlug: string;
  workflowId: string;
  correlationId?: string;
  customerId?: string;
  phase: string;
  occurredAt: string;
  metadata?: Readonly<Record<string, unknown>>;
}>;

export type PersistRegistrationAuditInput = Readonly<{
  events: readonly RegistrationAuditEventInput[];
}>;

export type PersistRegistrationAuditResult = Readonly<{
  persistedEventIds: readonly string[];
  reusedEventIds: readonly string[];
}>;

export type VerifyRegistrationAuditInput = Readonly<{
  workflowId: string;
  requiredLogicalEvents: readonly Readonly<{
    eventType: RegistrationAuditEventType;
    logicalKey: string;
  }>[];
}>;

export type VerifyRegistrationAuditResult = Readonly<{
  complete: boolean;
  missing: readonly string[];
}>;

export type MongoRegistrationAuditActivities = Readonly<{
  persistRegistrationAudit(
    input: PersistRegistrationAuditInput,
  ): Promise<PersistRegistrationAuditResult>;
  verifyRegistrationAudit(
    input: VerifyRegistrationAuditInput,
  ): Promise<VerifyRegistrationAuditResult>;
}>;
