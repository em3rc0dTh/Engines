export type AppointmentAuditEventType =
  | 'APPOINTMENT_SESSION_STARTED'
  | 'APPOINTMENT_CUSTOMER_RESOLVED'
  | 'APPOINTMENT_SERVICE_SELECTED'
  | 'APPOINTMENT_PRODUCT_SELECTED'
  | 'APPOINTMENT_DATE_SELECTED'
  | 'APPOINTMENT_SLOT_SELECTED'
  | 'APPOINTMENT_FINALIZE_REQUESTED'
  | 'APPOINTMENT_SLOT_CONFLICT'
  | 'APPOINTMENT_CREATED';

export type AppointmentAuditEventInput = Readonly<{
  eventType: AppointmentAuditEventType;
  logicalKey: string;
  businessSlug: string;
  workflowId: string;
  phase: string;
  occurredAt: string;
  correlationId?: string;
  customerId?: string;
  appointmentId?: string;
  metadata?: Readonly<Record<string, unknown>>;
}>;

export type AppointmentAuditActivities = Readonly<{
  persistAppointmentAudit(input: Readonly<{
    events: readonly AppointmentAuditEventInput[];
  }>): Promise<Readonly<{ persisted: number; reused: number }>>;
  verifyAppointmentAudit(input: Readonly<{
    workflowId: string;
    required: readonly Readonly<{ eventType: AppointmentAuditEventType; logicalKey: string }>[];
  }>): Promise<Readonly<{ complete: boolean; missing: readonly string[] }>>;
}>;
