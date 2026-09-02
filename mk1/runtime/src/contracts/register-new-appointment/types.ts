import type { CustomerDraft } from '../register-new-customer/types.js';
import type {
  EligibilityRuleSet,
  PricingDescriptor,
  ServiceDependency,
  ServiceRequirement,
  ServiceStatus,
} from '../services-engine/types.js';

export const REGISTER_NEW_APPOINTMENT_OPERATION = 'RegisterNewAppointment' as const;
export const REGISTER_NEW_APPOINTMENT_SCHEMA_VERSION = 'mk0.register-appointment.v0' as const;

export type RegisterNewAppointmentOperation = typeof REGISTER_NEW_APPOINTMENT_OPERATION;
export type RegisterNewAppointmentSchemaVersion = typeof REGISTER_NEW_APPOINTMENT_SCHEMA_VERSION;

export type AppointmentRequestMetadata = Readonly<{
  idempotencyKey: string;
  correlationId?: string;
  channel?: string;
}>;

export type AppointmentCustomerInput = Readonly<{
  customerId?: string;
  customer?: CustomerDraft;
}>;

export type RegisterNewAppointmentDraft = Readonly<{
  customer?: AppointmentCustomerInput;
  serviceId?: string;
  productId?: string;
  appointmentDate?: string;
  slotStart?: string;
}>;

export type RegisterNewAppointmentStartEnvelope = Readonly<{
  operation: RegisterNewAppointmentOperation;
  businessSlug: string;
  draft?: RegisterNewAppointmentDraft;
  request: AppointmentRequestMetadata;
  schemaVersion: RegisterNewAppointmentSchemaVersion;
}>;

/**
 * Appointment-compatible projection of a canonical Services ServiceDefinition.
 *
 * The original MK0 renderer fields remain stable. MK1 S7 adds optional canonical
 * Services semantics so a running Appointment can retain the selected revision
 * without forcing channel/renderers to understand the full Services contract.
 */
export type AppointmentService = Readonly<{
  serviceId: string;
  code: string;
  name: string;
  businessSlug?: string;
  description?: string;
  status?: ServiceStatus;
  revision?: number;
  tags?: readonly string[];
}>;

/**
 * Appointment-compatible projection of a canonical Services ServiceOffering.
 *
 * Once selected, this object lives in durable Workflow state. The optional MK1
 * fields therefore form the Services snapshot semantics used by S7 while the
 * original productId/serviceId/code/name/duration contract remains compatible.
 */
export type AppointmentProduct = Readonly<{
  productId: string;
  serviceId: string;
  code: string;
  name: string;
  description?: string;
  durationMinutes: number;
  businessSlug?: string;
  status?: ServiceStatus;
  revision?: number;
  pricing?: PricingDescriptor;
  priority?: number;
  tags?: readonly string[];
  requirements?: readonly ServiceRequirement[];
  dependencies?: readonly ServiceDependency[];
  eligibilityRuleSet?: EligibilityRuleSet;
}>;

export type AppointmentSlot = Readonly<{
  start: string;
  end: string;
  durationMinutes: number;
}>;

export type AppointmentPhase =
  | 'STARTED'
  | 'WAITING_FOR_CUSTOMER'
  | 'RESOLVING_CUSTOMER'
  | 'CUSTOMER_READY'
  | 'LOADING_SERVICES'
  | 'WAITING_FOR_SERVICE'
  | 'LOADING_PRODUCTS'
  | 'WAITING_FOR_PRODUCT'
  | 'WAITING_FOR_DATE'
  | 'LOADING_SLOTS'
  | 'WAITING_FOR_SLOT'
  | 'READY_TO_FINALIZE'
  | 'RESERVING_APPOINTMENT'
  | 'CREATED'
  | 'FAILED';

export type AppointmentWorkflowStatus = 'RUNNING' | 'COMPLETED' | 'FAILED';

export type AppointmentNextAction =
  | 'PROVIDE_CUSTOMER'
  | 'RESOLVE_CUSTOMER'
  | 'SELECT_SERVICE'
  | 'SELECT_PRODUCT'
  | 'PROVIDE_DATE'
  | 'SELECT_SLOT'
  | 'FINALIZE_APPOINTMENT'
  | 'NONE';

export type AppointmentCustomerResolution = Readonly<{
  status: 'EMPTY' | 'DRAFT' | 'RESOLVING' | 'EXISTING' | 'CREATED' | 'AMBIGUOUS';
  customerId?: string;
  customer?: CustomerDraft;
  candidateCustomerIds?: readonly string[];
}>;

export type AppointmentResult = Readonly<{
  appointmentId: string;
  customerId: string;
  serviceId: string;
  productId: string;
  appointmentDate: string;
  slot: AppointmentSlot;
}>;

export type AppointmentIssue = Readonly<{
  code:
    | 'INVALID_INPUT'
    | 'CUSTOMER_NOT_FOUND'
    | 'CUSTOMER_AMBIGUOUS'
    | 'CUSTOMER_INCOMPLETE'
    | 'SERVICE_NOT_FOUND'
    | 'PRODUCT_NOT_FOUND'
    | 'PRODUCT_SERVICE_MISMATCH'
    | 'INVALID_DATE'
    | 'PAST_DATE'
    | 'NO_AVAILABILITY'
    | 'SLOT_NOT_AVAILABLE'
    | 'NOT_READY_TO_FINALIZE';
  path: string;
  message: string;
}>;

export type AppointmentStateProjection = Readonly<{
  workflowId: string;
  workflowStatus: AppointmentWorkflowStatus;
  phase: AppointmentPhase;
  customer: AppointmentCustomerResolution;
  services: readonly AppointmentService[];
  selectedService?: AppointmentService;
  products: readonly AppointmentProduct[];
  selectedProduct?: AppointmentProduct;
  appointmentDate?: string;
  availableSlots: readonly AppointmentSlot[];
  selectedSlot?: AppointmentSlot;
  nextAction: AppointmentNextAction;
  issues: readonly AppointmentIssue[];
  result?: AppointmentResult;
  failure?: Readonly<{ code: string; message: string }>;
}>;

export type ProvideAppointmentCustomerInput = Readonly<{
  inputId: string;
  customerId?: string;
  customerPatch?: CustomerDraft;
}>;

export type ResolveAppointmentCustomerInput = Readonly<{ inputId: string }>;
export type SelectAppointmentServiceInput = Readonly<{ inputId: string; serviceId: string }>;
export type SelectAppointmentProductInput = Readonly<{ inputId: string; productId: string }>;
export type SetAppointmentDateInput = Readonly<{ inputId: string; appointmentDate: string }>;
export type SelectAppointmentSlotInput = Readonly<{ inputId: string; slotStart: string }>;
export type FinalizeAppointmentInput = Readonly<{ inputId: string }>;

export type AppointmentUpdateResult =
  | Readonly<{ ok: true; duplicateInput: boolean; state: AppointmentStateProjection }>
  | Readonly<{ ok: false; issues: readonly AppointmentIssue[]; state: AppointmentStateProjection }>;
