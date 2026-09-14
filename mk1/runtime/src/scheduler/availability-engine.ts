import { createHash } from 'node:crypto';
import type { Pool } from 'pg';
import type {
  AvailabilityResult,
  CapabilityDemand,
  QueryAvailabilityInput,
  ResourceAssignmentCandidate,
  SchedulerFailureCode,
  SlotCandidate,
} from '../contracts/scheduler-engine/index.js';
import { validateSchedulingDemand, validateSlotCandidate } from '../contracts/scheduler-engine/index.js';

const MINUTE_MS = 60_000;

export type AvailabilityQueryOptions = Readonly<{
  granularityMinutes?: number;
  generatedAt?: string;
}>;

export class SchedulerAvailabilityError extends Error {
  readonly code: SchedulerFailureCode;

  constructor(code: SchedulerFailureCode, message: string) {
    super(message);
    this.name = 'SchedulerAvailabilityError';
    this.code = code;
  }
}

type ResourceRow = Readonly<{
  resource_id: string;
  resource_kind: string;
  time_zone: string;
  capacity: number;
}>;

type CapabilityRow = Readonly<{
  resource_id: string;
  capability_code: string;
  capacity_units: number | null;
}>;

type WindowRow = Readonly<{
  resource_id: string;
  weekday: number;
  start_local: string;
  end_local: string;
  capacity: number | null;
}>;

type OverrideRow = Readonly<{
  resource_id: string;
  start_at: Date | string;
  end_at: Date | string;
  override_kind: 'AVAILABLE' | 'UNAVAILABLE' | 'CAPACITY';
  capacity: number | null;
}>;

type AllocationRow = Readonly<{
  resource_id: string;
  start_at: Date | string;
  end_at: Date | string;
  capacity_units: number;
}>;

type LocalProjection = Readonly<{
  date: string;
  weekday: number;
  minuteOfDay: number;
}>;

const WEEKDAY: Readonly<Record<string, number>> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

function asMs(value: Date | string): number {
  return value instanceof Date ? value.getTime() : Date.parse(value);
}

function stableJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${stableJson(record[key])}`).join(',')}}`;
}

function hash(value: unknown): string {
  return createHash('sha256').update(stableJson(value)).digest('hex');
}

function localProjection(instantMs: number, timeZone: string): LocalProjection {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    weekday: 'short',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  });
  const parts = Object.fromEntries(
    formatter.formatToParts(new Date(instantMs)).filter((part) => part.type !== 'literal').map((part) => [part.type, part.value]),
  );
  const weekday = WEEKDAY[parts.weekday ?? ''];
  if (weekday === undefined) throw new Error(`SCHEDULER_TIME_PROJECTION_FAILED:${timeZone}`);
  const hour = Number(parts.hour);
  const minute = Number(parts.minute);
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    weekday,
    minuteOfDay: hour * 60 + minute,
  };
}

function localTimeToMinute(value: string): number {
  const [hour, minute] = value.slice(0, 5).split(':').map(Number);
  return hour! * 60 + minute!;
}

function overlaps(startA: number, endA: number, startB: number, endB: number): boolean {
  return startA < endB && endA > startB;
}

function fullyContained(start: number, end: number, containerStart: number, containerEnd: number): boolean {
  return start >= containerStart && end <= containerEnd;
}

function capabilitySatisfied(
  demand: CapabilityDemand,
  resource: ResourceRow,
  capabilities: readonly CapabilityRow[],
): boolean {
  if (demand.resourceKinds && demand.resourceKinds.length > 0 && !demand.resourceKinds.includes(resource.resource_kind)) {
    return false;
  }
  const capability = capabilities.find((entry) => entry.capability_code === demand.code);
  if (!capability) return false;
  const capabilityCapacity = capability.capacity_units ?? resource.capacity;
  return capabilityCapacity >= demand.quantity;
}

function scheduleCapacity(
  resource: ResourceRow,
  windows: readonly WindowRow[],
  overrides: readonly OverrideRow[],
  occupancyStart: number,
  occupancyEnd: number,
): number | undefined {
  const startLocal = localProjection(occupancyStart, resource.time_zone);
  const endLocal = localProjection(occupancyEnd, resource.time_zone);

  const matchingWindowCapacities: number[] = [];
  if (startLocal.date === endLocal.date) {
    for (const window of windows) {
      if (window.weekday !== startLocal.weekday) continue;
      const windowStart = localTimeToMinute(window.start_local);
      const windowEnd = localTimeToMinute(window.end_local);
      if (startLocal.minuteOfDay >= windowStart && endLocal.minuteOfDay <= windowEnd) {
        matchingWindowCapacities.push(window.capacity ?? resource.capacity);
      }
    }
  }

  const relevantOverrides = overrides.filter((override) =>
    overlaps(occupancyStart, occupancyEnd, asMs(override.start_at), asMs(override.end_at)),
  );
  if (relevantOverrides.some((override) => override.override_kind === 'UNAVAILABLE')) return undefined;

  const availableOverride = relevantOverrides.some((override) =>
    override.override_kind === 'AVAILABLE'
      && fullyContained(occupancyStart, occupancyEnd, asMs(override.start_at), asMs(override.end_at)),
  );

  if (matchingWindowCapacities.length === 0 && !availableOverride) return undefined;

  let capacity = matchingWindowCapacities.length > 0
    ? Math.min(resource.capacity, Math.max(...matchingWindowCapacities))
    : resource.capacity;

  const capacityOverrides = relevantOverrides
    .filter((override) => override.override_kind === 'CAPACITY' && override.capacity !== null)
    .map((override) => override.capacity!);
  if (capacityOverrides.length > 0) capacity = Math.min(capacity, ...capacityOverrides);
  return capacity;
}

function maximumConcurrentUsage(
  allocations: readonly AllocationRow[],
  resourceId: string,
  start: number,
  end: number,
): number {
  const events: { at: number; delta: number }[] = [];
  for (const allocation of allocations) {
    if (allocation.resource_id !== resourceId) continue;
    const allocationStart = Math.max(start, asMs(allocation.start_at));
    const allocationEnd = Math.min(end, asMs(allocation.end_at));
    if (allocationStart >= allocationEnd) continue;
    events.push({ at: allocationStart, delta: allocation.capacity_units });
    events.push({ at: allocationEnd, delta: -allocation.capacity_units });
  }
  events.sort((a, b) => a.at - b.at || a.delta - b.delta);
  let current = 0;
  let maximum = 0;
  for (const event of events) {
    current += event.delta;
    maximum = Math.max(maximum, current);
  }
  return maximum;
}

function canonicalCandidate(
  input: QueryAvailabilityInput,
  startMs: number,
  resourceId: string,
): SlotCandidate {
  const endMs = startMs + input.demand.offering.durationMinutes * MINUTE_MS;
  const assignments: readonly ResourceAssignmentCandidate[] = [{
    resourceId,
    capacityUnits: input.demand.capacityUnits,
  }];
  const material = {
    businessSlug: input.businessSlug,
    demandId: input.demand.demandId,
    startAt: new Date(startMs).toISOString(),
    endAt: new Date(endMs).toISOString(),
    timeZone: input.window.timeZone,
    assignments,
  };
  return {
    candidateId: `slot_${hash(material).slice(0, 32)}`,
    startAt: material.startAt,
    endAt: material.endAt,
    timeZone: input.window.timeZone,
    assignments,
  };
}

function validateQuery(input: QueryAvailabilityInput, granularityMinutes: number): void {
  if (!input.businessSlug.trim() || input.demand.businessSlug !== input.businessSlug) {
    throw new SchedulerAvailabilityError('SCHEDULING_DEMAND_INVALID', 'availability business scope must match demand scope');
  }
  const demandIssues = validateSchedulingDemand(input.demand);
  if (demandIssues.length > 0) {
    throw new SchedulerAvailabilityError('SCHEDULING_DEMAND_INVALID', JSON.stringify(demandIssues));
  }
  const start = Date.parse(input.window.startAt);
  const end = Date.parse(input.window.endAt);
  if (!Number.isFinite(start) || !Number.isFinite(end) || start >= end) {
    throw new SchedulerAvailabilityError('SCHEDULING_DEMAND_INVALID', 'availability window must be an increasing offset-aware interval');
  }
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: input.window.timeZone }).format(new Date(0));
  } catch {
    throw new SchedulerAvailabilityError('SCHEDULING_DEMAND_INVALID', 'availability timeZone must be a valid IANA identifier');
  }
  if (!Number.isSafeInteger(granularityMinutes) || granularityMinutes <= 0 || granularityMinutes > 1440) {
    throw new SchedulerAvailabilityError('SCHEDULING_DEMAND_INVALID', 'granularityMinutes must be a positive integer <= 1440');
  }
}

export async function queryDeterministicAvailability(
  pool: Pool,
  input: QueryAvailabilityInput,
  options: AvailabilityQueryOptions = {},
): Promise<AvailabilityResult> {
  const granularityMinutes = options.granularityMinutes ?? 15;
  validateQuery(input, granularityMinutes);

  const queryStart = Date.parse(input.window.startAt);
  const queryEnd = Date.parse(input.window.endAt);
  const occupancyPadding = Math.max(input.demand.buffers.beforeMinutes, input.demand.buffers.afterMinutes) * MINUTE_MS;
  const loadStart = new Date(queryStart - occupancyPadding).toISOString();
  const loadEnd = new Date(queryEnd + occupancyPadding).toISOString();

  const [resourcesResult, capabilitiesResult, windowsResult, overridesResult, reservationsResult, holdsResult] = await Promise.all([
    pool.query<ResourceRow>(
      `SELECT resource_id, resource_kind, time_zone, capacity
         FROM scheduler_resources
        WHERE business_slug = $1 AND status = 'ACTIVE'
        ORDER BY resource_id ASC`,
      [input.businessSlug],
    ),
    pool.query<CapabilityRow>(
      `SELECT resource_id, capability_code, capacity_units
         FROM scheduler_resource_capabilities
        WHERE business_slug = $1
        ORDER BY resource_id ASC, capability_code ASC`,
      [input.businessSlug],
    ),
    pool.query<WindowRow>(
      `SELECT st.resource_id, sw.weekday, sw.start_local::text, sw.end_local::text, sw.capacity
         FROM scheduler_schedule_templates st
         JOIN scheduler_schedule_windows sw
           ON sw.business_slug = st.business_slug AND sw.schedule_id = st.schedule_id
        WHERE st.business_slug = $1
        ORDER BY st.resource_id ASC, st.schedule_id ASC, sw.window_index ASC`,
      [input.businessSlug],
    ),
    pool.query<OverrideRow>(
      `SELECT resource_id, start_at, end_at, override_kind, capacity
         FROM scheduler_schedule_overrides
        WHERE business_slug = $1 AND start_at < $3::timestamptz AND end_at > $2::timestamptz
        ORDER BY resource_id ASC, start_at ASC, override_id ASC`,
      [input.businessSlug, loadStart, loadEnd],
    ),
    pool.query<AllocationRow>(
      `SELECT a.resource_id, r.start_at, r.end_at, a.capacity_units
         FROM scheduler_reservations r
         JOIN scheduler_reservation_assignments a
           ON a.business_slug = r.business_slug AND a.reservation_id = r.reservation_id
        WHERE r.business_slug = $1
          AND r.status = 'RESERVED'
          AND r.start_at < $3::timestamptz
          AND r.end_at > $2::timestamptz
        ORDER BY a.resource_id ASC, r.start_at ASC, r.reservation_id ASC`,
      [input.businessSlug, loadStart, loadEnd],
    ),
    pool.query<AllocationRow>(
      `SELECT a.resource_id, h.start_at, h.end_at, a.capacity_units
         FROM scheduler_holds h
         JOIN scheduler_hold_assignments a
           ON a.business_slug = h.business_slug AND a.hold_id = h.hold_id
        WHERE h.business_slug = $1
          AND h.status = 'ACTIVE'
          AND h.start_at < $3::timestamptz
          AND h.end_at > $2::timestamptz
        ORDER BY a.resource_id ASC, h.start_at ASC, h.hold_id ASC`,
      [input.businessSlug, loadStart, loadEnd],
    ),
  ]);

  const preferred = input.preferredResourceIds ? new Set(input.preferredResourceIds) : undefined;
  const allocations = [...reservationsResult.rows, ...holdsResult.rows];
  const eligibleResources = resourcesResult.rows.filter((resource) => {
    if (preferred && !preferred.has(resource.resource_id)) return false;
    if (input.demand.capacityUnits > resource.capacity) return false;
    const resourceCapabilities = capabilitiesResult.rows.filter((entry) => entry.resource_id === resource.resource_id);
    return input.demand.requiredCapabilities.every((demand) => capabilitySatisfied(demand, resource, resourceCapabilities));
  });

  const stepMs = granularityMinutes * MINUTE_MS;
  const firstStart = Math.ceil(queryStart / stepMs) * stepMs;
  const durationMs = input.demand.offering.durationMinutes * MINUTE_MS;
  const slots: SlotCandidate[] = [];

  for (let serviceStart = firstStart; serviceStart + durationMs <= queryEnd; serviceStart += stepMs) {
    const serviceEnd = serviceStart + durationMs;
    const occupancyStart = serviceStart - input.demand.buffers.beforeMinutes * MINUTE_MS;
    const occupancyEnd = serviceEnd + input.demand.buffers.afterMinutes * MINUTE_MS;

    for (const resource of eligibleResources) {
      const windows = windowsResult.rows.filter((entry) => entry.resource_id === resource.resource_id);
      const overrides = overridesResult.rows.filter((entry) => entry.resource_id === resource.resource_id);
      const effectiveCapacity = scheduleCapacity(resource, windows, overrides, occupancyStart, occupancyEnd);
      if (effectiveCapacity === undefined) continue;
      const usedCapacity = maximumConcurrentUsage(allocations, resource.resource_id, occupancyStart, occupancyEnd);
      if (usedCapacity + input.demand.capacityUnits > effectiveCapacity) continue;

      const candidate = canonicalCandidate(input, serviceStart, resource.resource_id);
      const issues = validateSlotCandidate(candidate);
      if (issues.length > 0) throw new Error(`SCHEDULER_G2_S2_CANDIDATE_INVALID:${JSON.stringify(issues)}`);
      slots.push(candidate);
    }
  }

  slots.sort((a, b) =>
    a.startAt.localeCompare(b.startAt)
      || a.endAt.localeCompare(b.endAt)
      || a.assignments.map((entry) => entry.resourceId).join('|').localeCompare(b.assignments.map((entry) => entry.resourceId).join('|'))
      || a.candidateId.localeCompare(b.candidateId),
  );

  const limited = input.limit === undefined ? slots : slots.slice(0, Math.max(0, input.limit));
  return {
    requestId: input.requestId,
    generatedAt: options.generatedAt ?? new Date().toISOString(),
    slots: limited,
  };
}
