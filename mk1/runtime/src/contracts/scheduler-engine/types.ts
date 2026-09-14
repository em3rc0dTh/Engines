export type SchedulerResourceStatus = 'ACTIVE' | 'INACTIVE';
export type ScheduleStatus = 'ACTIVE' | 'INACTIVE';
export type ScheduleOverrideMode = 'CLOSED' | 'REPLACE';
export type HoldStatus = 'ACTIVE' | 'EXPIRED' | 'RELEASED' | 'CONSUMED';
export type ReservationStatus = 'RESERVED' | 'COMPLETED' | 'CANCELLED';

export type SchedulerResource = Readonly<{
  resourceId: string;
  businessSlug: string;
  kind: string;
  name: string;
  status: SchedulerResourceStatus;
  capacityUnits: number;
  timeZone: string;
  revision: number;
}>;

export type ResourceCapability = Readonly<{
  resourceCapabilityId: string;
  resourceId: string;
  businessSlug: string;
  capabilityCode: string;
  capacityUnits: number;
  revision: number;
}>;

export type ScheduleWindow = Readonly<{
  weekday: number;
  startLocal: string;
  endLocal: string;
  capacityUnits?: number;
}>;

export type ScheduleTemplate = Readonly<{
  scheduleTemplateId: string;
  resourceId: string;
  businessSlug: string;
  timeZone: string;
  status: ScheduleStatus;
  revision: number;
  windows: readonly ScheduleWindow[];
}>;

export type ScheduleOverrideWindow = Readonly<{
  startLocal: string;
  endLocal: string;
  capacityUnits?: number;
}>;

export type ScheduleOverride = Readonly<{
  scheduleOverrideId: string;
  resourceId: string;
  businessSlug: string;
  localDate: string;
  timeZone: string;
  mode: ScheduleOverrideMode;
  revision: number;
  windows: readonly ScheduleOverrideWindow[];
}>;

export type CapabilityDemand = Readonly<{
  capabilityCode: string;
  units: number;
}>;

export type SchedulingDemand = Readonly<{
  schedulingDemandId: string;
  businessSlug: string;
  operationId: string;
  offeringSnapshot: Readonly<{
    offeringId: string;
    offeringRevision: number;
    serviceId: string;
    serviceRevision: number;
    durationMinutes: number;
  }>;
  requiredCapabilities: readonly CapabilityDemand[];
  capacityUnits: number;
  buffers?: Readonly<{
    beforeMinutes?: number;
    afterMinutes?: number;
  }>;
}>;

export type ResourceAssignmentCandidate = Readonly<{
  resourceId: string;
  capacityUnits: number;
  capabilityCodes: readonly string[];
}>;

/** Advisory only: availability shown is not a persisted reservation. */
export type SlotCandidate = Readonly<{
  candidateId: string;
  businessSlug: string;
  schedulingDemandId: string;
  startAt: string;
  endAt: string;
  timeZone: string;
  schedulerRevision: number;
  assignmentCandidates: readonly ResourceAssignmentCandidate[];
}>;

export type ResourceAssignment = Readonly<{
  resourceId: string;
  capacityUnits: number;
  capabilityCodes: readonly string[];
}>;

export type Hold = Readonly<{
  holdId: string;
  businessSlug: string;
  schedulingDemandId: string;
  candidateId: string;
  idempotencyKey: string;
  startAt: string;
  endAt: string;
  expiresAt: string;
  status: HoldStatus;
  assignments: readonly ResourceAssignment[];
}>;

export type Reservation = Readonly<{
  reservationId: string;
  businessSlug: string;
  schedulingDemandId: string;
  candidateId: string;
  holdId?: string;
  idempotencyKey: string;
  startAt: string;
  endAt: string;
  status: ReservationStatus;
  assignments: readonly ResourceAssignment[];
}>;

export type SchedulerConflictCode =
  | 'SLOT_NO_LONGER_AVAILABLE'
  | 'CAPACITY_CONFLICT'
  | 'RESOURCE_INACTIVE'
  | 'HOLD_EXPIRED'
  | 'RESERVATION_ALREADY_EXISTS';

export type SchedulerValidationIssueCode =
  | 'INVALID_BUSINESS_SCOPE'
  | 'INVALID_IDENTITY'
  | 'INVALID_REVISION'
  | 'INVALID_RESOURCE'
  | 'INVALID_CAPABILITY'
  | 'INVALID_CAPACITY'
  | 'INVALID_TIME_ZONE'
  | 'INVALID_LOCAL_DATE'
  | 'INVALID_LOCAL_TIME'
  | 'INVALID_INTERVAL'
  | 'INVALID_SCHEDULE'
  | 'INVALID_DEMAND'
  | 'INVALID_ASSIGNMENT'
  | 'INVALID_IDEMPOTENCY_KEY';

export type SchedulerValidationIssue = Readonly<{
  code: SchedulerValidationIssueCode;
  path: string;
  message: string;
}>;
