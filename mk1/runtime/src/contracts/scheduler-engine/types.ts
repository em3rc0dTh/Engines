export type SchedulerResourceStatus = 'ACTIVE' | 'INACTIVE';
export type SchedulerHoldStatus = 'ACTIVE' | 'EXPIRED' | 'RELEASED' | 'CONSUMED';
export type SchedulerReservationStatus = 'RESERVED' | 'CANCELLED' | 'COMPLETED';
export type ScheduleOverrideKind = 'AVAILABLE' | 'UNAVAILABLE' | 'CAPACITY';

export type ResourceCapability = Readonly<{
  code: string;
  capacityUnits?: number;
  metadata?: Readonly<Record<string, unknown>>;
}>;

export type SchedulerResource = Readonly<{
  resourceId: string;
  businessSlug: string;
  code: string;
  kind: string;
  name: string;
  status: SchedulerResourceStatus;
  timeZone: string;
  capacity: number;
  capabilities: readonly ResourceCapability[];
  revision: number;
}>;

/**
 * G2-S0 implementation decision: the pre-build design names this type but does
 * not freeze its field shape. These canonical local-time fields intentionally
 * model recurring weekly availability only; bookings remain separate truth.
 */
export type WeeklyAvailabilityWindow = Readonly<{
  weekday: number;
  startLocal: string;
  endLocal: string;
  capacity?: number;
}>;

export type ScheduleTemplate = Readonly<{
  scheduleId: string;
  businessSlug: string;
  resourceId: string;
  timeZone: string;
  weeklyWindows: readonly WeeklyAvailabilityWindow[];
  revision: number;
}>;

export type ScheduleOverride = Readonly<{
  overrideId: string;
  businessSlug: string;
  resourceId: string;
  startAt: string;
  endAt: string;
  kind: ScheduleOverrideKind;
  capacity?: number;
  reasonCode?: string;
  revision: number;
}>;

export type CapabilityDemand = Readonly<{
  code: string;
  quantity: number;
  resourceKinds?: readonly string[];
}>;

export type SchedulingDemand = Readonly<{
  schemaVersion: 1;
  businessSlug: string;
  demandId: string;
  service: Readonly<{
    serviceId: string;
    revision: number;
  }>;
  offering: Readonly<{
    offeringId: string;
    revision: number;
    durationMinutes: number;
  }>;
  capacityUnits: number;
  requiredCapabilities: readonly CapabilityDemand[];
  buffers: Readonly<{
    beforeMinutes: number;
    afterMinutes: number;
  }>;
}>;

export type ResourceAssignmentCandidate = Readonly<{
  resourceId: string;
  capacityUnits: number;
}>;

/** Advisory only. Availability shown is not a persisted reservation. */
export type SlotCandidate = Readonly<{
  candidateId: string;
  startAt: string;
  endAt: string;
  timeZone: string;
  assignments: readonly ResourceAssignmentCandidate[];
}>;

export type ResourceAssignment = Readonly<{
  resourceId: string;
  capacityUnits: number;
}>;

export type QueryAvailabilityInput = Readonly<{
  businessSlug: string;
  requestId: string;
  demand: SchedulingDemand;
  window: Readonly<{
    startAt: string;
    endAt: string;
    timeZone: string;
  }>;
  preferredResourceIds?: readonly string[];
  limit?: number | undefined;
}>;

export type AvailabilityResult = Readonly<{
  requestId: string;
  generatedAt: string;
  slots: readonly SlotCandidate[];
}>;

export type CreateHoldInput = Readonly<{
  businessSlug: string;
  operationId: string;
  demandId: string;
  candidateId: string;
  expiresInSeconds: number;
}>;

export type SchedulerHold = Readonly<{
  holdId: string;
  businessSlug: string;
  demandId: string;
  startAt: string;
  endAt: string;
  assignments: readonly ResourceAssignment[];
  expiresAt: string;
  status: SchedulerHoldStatus;
}>;

export type ConfirmReservationInput = Readonly<{
  businessSlug: string;
  operationId: string;
  demand: SchedulingDemand;
  candidateId?: string;
  holdId?: string;
  requestedStartAt: string;
}>;

export type SchedulerReservation = Readonly<{
  reservationId: string;
  businessSlug: string;
  demandId: string;
  startAt: string;
  endAt: string;
  timeZone: string;
  assignments: readonly ResourceAssignment[];
  status: SchedulerReservationStatus;
  revision: number;
  createdAt: string;
  updatedAt: string;
}>;

export type SchedulerFailureCode =
  | 'BUSINESS_SCOPE_NOT_FOUND'
  | 'SCHEDULING_DEMAND_INVALID'
  | 'CAPABILITY_UNSATISFIED'
  | 'NO_AVAILABILITY'
  | 'SLOT_NO_LONGER_AVAILABLE'
  | 'CAPACITY_CONFLICT'
  | 'RESOURCE_INACTIVE'
  | 'HOLD_NOT_FOUND'
  | 'HOLD_EXPIRED'
  | 'RESERVATION_NOT_FOUND'
  | 'RESERVATION_REVISION_CONFLICT'
  | 'IDEMPOTENCY_MATERIAL_CONFLICT';

export type SchedulerValidationIssueCode =
  | 'INVALID_BUSINESS_SCOPE'
  | 'INVALID_IDENTITY'
  | 'INVALID_REVISION'
  | 'INVALID_RESOURCE'
  | 'INVALID_CAPABILITY'
  | 'INVALID_CAPACITY'
  | 'INVALID_TIME_ZONE'
  | 'INVALID_LOCAL_TIME'
  | 'INVALID_INTERVAL'
  | 'INVALID_SCHEDULE'
  | 'INVALID_DEMAND'
  | 'INVALID_ASSIGNMENT'
  | 'INVALID_OPERATION';

export type SchedulerValidationIssue = Readonly<{
  code: SchedulerValidationIssueCode;
  path: string;
  message: string;
}>;
