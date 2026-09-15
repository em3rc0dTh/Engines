import type {
  ConfirmReservationInput,
  CreateHoldInput,
  ScheduleOverride,
  ScheduleTemplate,
  SchedulerHold,
  SchedulerReservation,
  SchedulerResource,
  SchedulerValidationIssue,
  SchedulingDemand,
  SlotCandidate,
} from './types.js';

const TEXT_MAX = 240;
const CAPACITY_MAX = 1_000_000;
const MINUTES_MAX = 1440;

function issue(issues: SchedulerValidationIssue[], code: SchedulerValidationIssue['code'], path: string, message: string): void {
  issues.push({ code, path, message });
}

function validText(value: string, max = TEXT_MAX): boolean {
  return value.trim().length > 0 && value.length <= max;
}

function validPositiveInt(value: number, max = CAPACITY_MAX): boolean {
  return Number.isSafeInteger(value) && value > 0 && value <= max;
}

function validNonNegativeInt(value: number, max = MINUTES_MAX): boolean {
  return Number.isSafeInteger(value) && value >= 0 && value <= max;
}

function validRevision(value: number): boolean {
  return Number.isSafeInteger(value) && value >= 1;
}

function validTimeZone(value: string): boolean {
  if (!validText(value, 120)) return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value }).format(new Date(0));
    return true;
  } catch {
    return false;
  }
}

function validLocalTime(value: string): boolean {
  return /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value);
}

function validInstant(value: string): boolean {
  if (!/^(?:\d{4}-\d{2}-\d{2})T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})$/.test(value)) return false;
  return Number.isFinite(Date.parse(value));
}

function validateScopeAndIdentity(businessSlug: string, identity: string, identityPath: string, issues: SchedulerValidationIssue[]): void {
  if (!validText(businessSlug)) issue(issues, 'INVALID_BUSINESS_SCOPE', 'businessSlug', 'businessSlug is required');
  if (!validText(identity)) issue(issues, 'INVALID_IDENTITY', identityPath, `${identityPath} is required`);
}

function validateAssignments(assignments: readonly { resourceId: string; capacityUnits: number }[], path: string, issues: SchedulerValidationIssue[]): void {
  if (assignments.length === 0) {
    issue(issues, 'INVALID_ASSIGNMENT', path, 'at least one resource assignment is required');
    return;
  }
  const resourceIds = new Set<string>();
  assignments.forEach((assignment, index) => {
    const prefix = `${path}[${index}]`;
    if (!validText(assignment.resourceId)) issue(issues, 'INVALID_ASSIGNMENT', `${prefix}.resourceId`, 'resourceId is required');
    else if (resourceIds.has(assignment.resourceId)) issue(issues, 'INVALID_ASSIGNMENT', `${prefix}.resourceId`, 'resourceId must be unique');
    else resourceIds.add(assignment.resourceId);
    if (!validPositiveInt(assignment.capacityUnits)) issue(issues, 'INVALID_CAPACITY', `${prefix}.capacityUnits`, 'capacityUnits must be positive');
  });
}

export function validateSchedulerResource(value: SchedulerResource): readonly SchedulerValidationIssue[] {
  const issues: SchedulerValidationIssue[] = [];
  validateScopeAndIdentity(value.businessSlug, value.resourceId, 'resourceId', issues);
  if (!validText(value.code) || !validText(value.kind) || !validText(value.name)) issue(issues, 'INVALID_RESOURCE', 'resource', 'code, kind and name are required');
  if (!validTimeZone(value.timeZone)) issue(issues, 'INVALID_TIME_ZONE', 'timeZone', 'timeZone must be a valid IANA identifier');
  if (!validPositiveInt(value.capacity)) issue(issues, 'INVALID_CAPACITY', 'capacity', 'capacity must be a positive integer');
  if (!validRevision(value.revision)) issue(issues, 'INVALID_REVISION', 'revision', 'revision must be a positive integer');
  const capabilityCodes = new Set<string>();
  value.capabilities.forEach((capability, index) => {
    if (!validText(capability.code)) issue(issues, 'INVALID_CAPABILITY', `capabilities[${index}].code`, 'capability code is required');
    else if (capabilityCodes.has(capability.code)) issue(issues, 'INVALID_CAPABILITY', `capabilities[${index}].code`, 'capability codes must be unique');
    else capabilityCodes.add(capability.code);
    if (capability.capacityUnits !== undefined && !validPositiveInt(capability.capacityUnits)) issue(issues, 'INVALID_CAPACITY', `capabilities[${index}].capacityUnits`, 'capacityUnits must be positive');
  });
  return issues;
}

export function validateScheduleTemplate(value: ScheduleTemplate): readonly SchedulerValidationIssue[] {
  const issues: SchedulerValidationIssue[] = [];
  validateScopeAndIdentity(value.businessSlug, value.scheduleId, 'scheduleId', issues);
  if (!validText(value.resourceId)) issue(issues, 'INVALID_RESOURCE', 'resourceId', 'resourceId is required');
  if (!validTimeZone(value.timeZone)) issue(issues, 'INVALID_TIME_ZONE', 'timeZone', 'timeZone must be valid');
  if (!validRevision(value.revision)) issue(issues, 'INVALID_REVISION', 'revision', 'revision must be positive');
  if (value.weeklyWindows.length === 0) issue(issues, 'INVALID_SCHEDULE', 'weeklyWindows', 'at least one weekly window is required');
  value.weeklyWindows.forEach((window, index) => {
    if (!Number.isInteger(window.weekday) || window.weekday < 0 || window.weekday > 6) issue(issues, 'INVALID_SCHEDULE', `weeklyWindows[${index}].weekday`, 'weekday must be 0..6');
    if (!validLocalTime(window.startLocal) || !validLocalTime(window.endLocal)) issue(issues, 'INVALID_LOCAL_TIME', `weeklyWindows[${index}]`, 'local times must use HH:mm');
    else if (window.startLocal >= window.endLocal) issue(issues, 'INVALID_INTERVAL', `weeklyWindows[${index}]`, 'window start must be before end');
    if (window.capacity !== undefined && !validPositiveInt(window.capacity)) issue(issues, 'INVALID_CAPACITY', `weeklyWindows[${index}].capacity`, 'capacity must be positive');
  });
  return issues;
}

export function validateScheduleOverride(value: ScheduleOverride): readonly SchedulerValidationIssue[] {
  const issues: SchedulerValidationIssue[] = [];
  validateScopeAndIdentity(value.businessSlug, value.overrideId, 'overrideId', issues);
  if (!validText(value.resourceId)) issue(issues, 'INVALID_RESOURCE', 'resourceId', 'resourceId is required');
  if (!validInstant(value.startAt) || !validInstant(value.endAt) || Date.parse(value.startAt) >= Date.parse(value.endAt)) issue(issues, 'INVALID_INTERVAL', 'override', 'override must contain an increasing offset-aware interval');
  if (!validRevision(value.revision)) issue(issues, 'INVALID_REVISION', 'revision', 'revision must be positive');
  if (value.kind === 'CAPACITY') {
    if (value.capacity === undefined || !validPositiveInt(value.capacity)) issue(issues, 'INVALID_CAPACITY', 'capacity', 'CAPACITY override requires positive capacity');
  } else if (value.capacity !== undefined) issue(issues, 'INVALID_SCHEDULE', 'capacity', 'capacity is only valid for CAPACITY override');
  if (value.reasonCode !== undefined && !validText(value.reasonCode)) issue(issues, 'INVALID_SCHEDULE', 'reasonCode', 'reasonCode cannot be blank');
  return issues;
}

export function validateSchedulingDemand(value: SchedulingDemand): readonly SchedulerValidationIssue[] {
  const issues: SchedulerValidationIssue[] = [];
  validateScopeAndIdentity(value.businessSlug, value.demandId, 'demandId', issues);
  if (value.schemaVersion !== 1) issue(issues, 'INVALID_DEMAND', 'schemaVersion', 'schemaVersion must be 1');
  if (!validText(value.service.serviceId) || !validText(value.offering.offeringId)) issue(issues, 'INVALID_DEMAND', 'snapshot', 'serviceId and offeringId are required');
  if (!validRevision(value.service.revision) || !validRevision(value.offering.revision)) issue(issues, 'INVALID_REVISION', 'snapshot', 'service/offering revisions must be positive');
  if (!validPositiveInt(value.offering.durationMinutes, MINUTES_MAX)) issue(issues, 'INVALID_DEMAND', 'offering.durationMinutes', 'durationMinutes must be 1..1440');
  if (!validPositiveInt(value.capacityUnits)) issue(issues, 'INVALID_CAPACITY', 'capacityUnits', 'capacityUnits must be positive');
  if (!validNonNegativeInt(value.buffers.beforeMinutes) || !validNonNegativeInt(value.buffers.afterMinutes)) issue(issues, 'INVALID_DEMAND', 'buffers', 'buffer minutes must be 0..1440');
  const codes = new Set<string>();
  value.requiredCapabilities.forEach((capability, index) => {
    if (!validText(capability.code) || !validPositiveInt(capability.quantity)) issue(issues, 'INVALID_CAPABILITY', `requiredCapabilities[${index}]`, 'code and positive quantity are required');
    if (codes.has(capability.code)) issue(issues, 'INVALID_CAPABILITY', `requiredCapabilities[${index}].code`, 'capability demand must be unique');
    codes.add(capability.code);
    if (capability.resourceKinds !== undefined) {
      const kinds = new Set<string>();
      capability.resourceKinds.forEach((kind, kindIndex) => {
        if (!validText(kind) || kinds.has(kind)) issue(issues, 'INVALID_CAPABILITY', `requiredCapabilities[${index}].resourceKinds[${kindIndex}]`, 'resource kinds must be nonblank and unique');
        kinds.add(kind);
      });
    }
  });
  return issues;
}

export function validateSlotCandidate(value: SlotCandidate): readonly SchedulerValidationIssue[] {
  const issues: SchedulerValidationIssue[] = [];
  if (!validText(value.candidateId)) issue(issues, 'INVALID_IDENTITY', 'candidateId', 'candidateId is required');
  if (!validInstant(value.startAt) || !validInstant(value.endAt) || Date.parse(value.startAt) >= Date.parse(value.endAt)) issue(issues, 'INVALID_INTERVAL', 'slot', 'slot must contain an increasing offset-aware interval');
  if (!validTimeZone(value.timeZone)) issue(issues, 'INVALID_TIME_ZONE', 'timeZone', 'timeZone must be valid');
  validateAssignments(value.assignments, 'assignments', issues);
  return issues;
}

export function validateCreateHoldInput(value: CreateHoldInput): readonly SchedulerValidationIssue[] {
  const issues: SchedulerValidationIssue[] = [];
  validateScopeAndIdentity(value.businessSlug, value.operationId, 'operationId', issues);
  if (!validText(value.demandId)) issue(issues, 'INVALID_DEMAND', 'demandId', 'demandId is required');
  if (!validText(value.candidateId)) issue(issues, 'INVALID_IDENTITY', 'candidateId', 'candidateId is required');
  if (!validPositiveInt(value.expiresInSeconds, 86_400)) issue(issues, 'INVALID_OPERATION', 'expiresInSeconds', 'expiresInSeconds must be 1..86400');
  return issues;
}

export function validateSchedulerHold(value: SchedulerHold): readonly SchedulerValidationIssue[] {
  const issues: SchedulerValidationIssue[] = [];
  validateScopeAndIdentity(value.businessSlug, value.holdId, 'holdId', issues);
  if (!validText(value.demandId)) issue(issues, 'INVALID_DEMAND', 'demandId', 'demandId is required');
  if (!validInstant(value.startAt) || !validInstant(value.endAt) || Date.parse(value.startAt) >= Date.parse(value.endAt)) issue(issues, 'INVALID_INTERVAL', 'hold', 'hold must contain an increasing offset-aware interval');
  if (!validInstant(value.expiresAt)) issue(issues, 'INVALID_INTERVAL', 'expiresAt', 'expiresAt must be offset-aware');
  validateAssignments(value.assignments, 'assignments', issues);
  return issues;
}

export function validateConfirmReservationInput(value: ConfirmReservationInput): readonly SchedulerValidationIssue[] {
  const issues: SchedulerValidationIssue[] = [];
  validateScopeAndIdentity(value.businessSlug, value.operationId, 'operationId', issues);
  issues.push(...validateSchedulingDemand(value.demand));
  if (value.demand.businessSlug !== value.businessSlug) issue(issues, 'INVALID_BUSINESS_SCOPE', 'demand.businessSlug', 'demand scope must match command scope');
  if (!validInstant(value.requestedStartAt)) issue(issues, 'INVALID_INTERVAL', 'requestedStartAt', 'requestedStartAt must be offset-aware');
  if (value.candidateId !== undefined && !validText(value.candidateId)) issue(issues, 'INVALID_IDENTITY', 'candidateId', 'candidateId cannot be blank');
  if (value.holdId !== undefined && !validText(value.holdId)) issue(issues, 'INVALID_IDENTITY', 'holdId', 'holdId cannot be blank');
  return issues;
}

export function validateSchedulerReservation(value: SchedulerReservation): readonly SchedulerValidationIssue[] {
  const issues: SchedulerValidationIssue[] = [];
  validateScopeAndIdentity(value.businessSlug, value.reservationId, 'reservationId', issues);
  if (!validText(value.demandId)) issue(issues, 'INVALID_DEMAND', 'demandId', 'demandId is required');
  if (!validInstant(value.startAt) || !validInstant(value.endAt) || Date.parse(value.startAt) >= Date.parse(value.endAt)) issue(issues, 'INVALID_INTERVAL', 'reservation', 'reservation must contain an increasing offset-aware interval');
  if (!validTimeZone(value.timeZone)) issue(issues, 'INVALID_TIME_ZONE', 'timeZone', 'timeZone must be valid');
  if (!validRevision(value.revision)) issue(issues, 'INVALID_REVISION', 'revision', 'revision must be positive');
  if (!validInstant(value.createdAt) || !validInstant(value.updatedAt)) issue(issues, 'INVALID_INTERVAL', 'timestamps', 'createdAt/updatedAt must be offset-aware');
  validateAssignments(value.assignments, 'assignments', issues);
  return issues;
}
