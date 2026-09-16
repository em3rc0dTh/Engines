import { createHash } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
import type {
  AvailabilityResult,
  ConfirmReservationInput,
  QueryAvailabilityInput,
  ResourceAssignment,
  SchedulerReservation,
  SlotCandidate,
} from '../contracts/scheduler-engine/index.js';
import {
  validateConfirmReservationInput,
  validateSchedulerReservation,
  validateSchedulingDemand,
  validateSlotCandidate,
} from '../contracts/scheduler-engine/index.js';
import {
  queryDeterministicAvailability,
  type AvailabilityQueryOptions,
} from './availability-engine.js';
import {
  SchedulerReservationError,
  type ConfirmReservationOptions,
  type ConfirmReservationResult,
} from './reservation-engine.js';

const MINUTE_MS = 60_000;

function stableJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${stableJson(record[key])}`).join(',')}}`;
}

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function canonicalCandidate(
  input: QueryAvailabilityInput,
  startAt: string,
  endAt: string,
  assignments: readonly ResourceAssignment[],
): SlotCandidate {
  const canonicalAssignments = [...assignments]
    .sort((a, b) => a.resourceId.localeCompare(b.resourceId));
  const material = {
    businessSlug: input.businessSlug,
    demandId: input.demand.demandId,
    startAt,
    endAt,
    timeZone: input.window.timeZone,
    assignments: canonicalAssignments,
  };
  return {
    candidateId: `slot_${sha256(stableJson(material)).slice(0, 32)}`,
    startAt,
    endAt,
    timeZone: input.window.timeZone,
    assignments: canonicalAssignments,
  };
}

function slotKey(slot: Pick<SlotCandidate, 'startAt' | 'endAt'>): string {
  return `${slot.startAt}|${slot.endAt}`;
}

function assignmentKey(assignments: readonly ResourceAssignment[]): string {
  return assignments
    .map((assignment) => `${assignment.resourceId}:${assignment.capacityUnits}`)
    .sort()
    .join('|');
}

/**
 * G2-S8 minimal multi-resource semantics:
 * - every required capability demand is satisfied by one distinct concrete resource;
 * - all selected resources share the query timezone;
 * - each assignment consumes demand.capacityUnits on its resource;
 * - no solver/optimization/ranking beyond deterministic lexical ordering is claimed.
 *
 * The one-resource G2-S2 path remains unchanged. This function composes that
 * certified availability primitive into deterministic joint availability.
 */
export async function queryDeterministicMultiResourceAvailability(
  pool: Pool,
  input: QueryAvailabilityInput,
  options: AvailabilityQueryOptions = {},
): Promise<AvailabilityResult> {
  const issues = validateSchedulingDemand(input.demand);
  if (issues.length > 0 || input.demand.businessSlug !== input.businessSlug) {
    throw new SchedulerReservationError(
      'SCHEDULING_DEMAND_INVALID',
      issues.length > 0 ? JSON.stringify(issues) : 'availability business scope must match demand scope',
    );
  }

  if (input.demand.requiredCapabilities.length < 2) {
    return queryDeterministicAvailability(pool, input, options);
  }

  const generatedAt = options.generatedAt ?? new Date().toISOString();
  const normalizedOptions: AvailabilityQueryOptions = {
    ...options,
    generatedAt,
    asOf: options.asOf ?? generatedAt,
  };

  const timeZonesResult = await pool.query<{ resource_id: string; time_zone: string }>(
    `SELECT resource_id, time_zone
       FROM scheduler_resources
      WHERE business_slug = $1 AND status = 'ACTIVE'
      ORDER BY resource_id ASC`,
    [input.businessSlug],
  );
  const timeZones = new Map(timeZonesResult.rows.map((row) => [row.resource_id, row.time_zone]));

  const capabilitySlots = await Promise.all(
    input.demand.requiredCapabilities.map((capability, index) =>
      queryDeterministicAvailability(pool, {
        ...input,
        requestId: `${input.requestId}:capability:${index}`,
        demand: {
          ...input.demand,
          requiredCapabilities: [capability],
        },
        limit: undefined,
      }, normalizedOptions),
    ),
  );

  if (capabilitySlots.some((result) => result.slots.length === 0)) {
    return { requestId: input.requestId, generatedAt, slots: [] };
  }

  const grouped = capabilitySlots.map((result) => {
    const map = new Map<string, SlotCandidate[]>();
    for (const slot of result.slots) {
      const key = slotKey(slot);
      const existing = map.get(key) ?? [];
      existing.push(slot);
      map.set(key, existing);
    }
    for (const slots of map.values()) {
      slots.sort((a, b) =>
        a.assignments[0]!.resourceId.localeCompare(b.assignments[0]!.resourceId)
          || a.candidateId.localeCompare(b.candidateId),
      );
    }
    return map;
  });

  const commonKeys = [...grouped[0]!.keys()]
    .filter((key) => grouped.every((map) => map.has(key)))
    .sort();
  const slots: SlotCandidate[] = [];
  const seen = new Set<string>();

  for (const key of commonKeys) {
    const [startAt, endAt] = key.split('|') as [string, string];
    const optionsByCapability = grouped.map((map) => map.get(key)!);

    const walk = (index: number, selected: ResourceAssignment[], usedResources: Set<string>): void => {
      if (index === optionsByCapability.length) {
        if (selected.some((assignment) => timeZones.get(assignment.resourceId) !== input.window.timeZone)) return;
        const canonicalAssignments = [...selected].sort((a, b) => a.resourceId.localeCompare(b.resourceId));
        const dedupe = `${key}|${assignmentKey(canonicalAssignments)}`;
        if (seen.has(dedupe)) return;
        seen.add(dedupe);
        const candidate = canonicalCandidate(input, startAt, endAt, canonicalAssignments);
        const candidateIssues = validateSlotCandidate(candidate);
        if (candidateIssues.length > 0) {
          throw new Error(`SCHEDULER_G2_S8_CANDIDATE_INVALID:${JSON.stringify(candidateIssues)}`);
        }
        slots.push(candidate);
        return;
      }

      for (const slot of optionsByCapability[index]!) {
        const assignment = slot.assignments[0];
        if (!assignment || slot.assignments.length !== 1) continue;
        if (usedResources.has(assignment.resourceId)) continue;
        usedResources.add(assignment.resourceId);
        selected.push({ resourceId: assignment.resourceId, capacityUnits: input.demand.capacityUnits });
        walk(index + 1, selected, usedResources);
        selected.pop();
        usedResources.delete(assignment.resourceId);
      }
    };

    walk(0, [], new Set<string>());
  }

  slots.sort((a, b) =>
    a.startAt.localeCompare(b.startAt)
      || a.endAt.localeCompare(b.endAt)
      || assignmentKey(a.assignments).localeCompare(assignmentKey(b.assignments))
      || a.candidateId.localeCompare(b.candidateId),
  );

  return {
    requestId: input.requestId,
    generatedAt,
    slots: input.limit === undefined ? slots : slots.slice(0, Math.max(0, input.limit)),
  };
}

async function transaction<T>(pool: Pool, work: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await work(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

function commandMaterial(input: ConfirmReservationInput): Readonly<Record<string, unknown>> {
  return {
    demand: input.demand,
    candidateId: input.candidateId ?? null,
    holdId: input.holdId ?? null,
    requestedStartAt: new Date(Date.parse(input.requestedStartAt)).toISOString(),
  };
}

async function persistDemandSnapshot(client: PoolClient, input: ConfirmReservationInput): Promise<void> {
  const snapshotHash = sha256(stableJson(input.demand));
  const existing = await client.query<{ business_slug: string; snapshot_hash: string }>(
    `SELECT business_slug, snapshot_hash
       FROM scheduler_demands
      WHERE demand_id = $1
      FOR UPDATE`,
    [input.demand.demandId],
  );
  const row = existing.rows[0];
  if (row) {
    if (row.business_slug !== input.businessSlug || row.snapshot_hash !== snapshotHash) {
      throw new SchedulerReservationError(
        'SCHEDULING_DEMAND_INVALID',
        `demand ${input.demand.demandId} already exists with different immutable material`,
      );
    }
    return;
  }

  await client.query(
    `INSERT INTO scheduler_demands (
       demand_id, schema_version, business_slug,
       service_id, service_revision, offering_id, offering_revision,
       duration_minutes, capacity_units, required_capabilities,
       buffer_before_minutes, buffer_after_minutes, snapshot_hash
     ) VALUES ($1,1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10,$11,$12)`,
    [
      input.demand.demandId,
      input.businessSlug,
      input.demand.service.serviceId,
      input.demand.service.revision,
      input.demand.offering.offeringId,
      input.demand.offering.revision,
      input.demand.offering.durationMinutes,
      input.demand.capacityUnits,
      JSON.stringify(input.demand.requiredCapabilities),
      input.demand.buffers.beforeMinutes,
      input.demand.buffers.afterMinutes,
      snapshotHash,
    ],
  );
}

async function loadReservation(client: PoolClient, businessSlug: string, reservationId: string): Promise<SchedulerReservation> {
  const reservationResult = await client.query<{
    reservation_id: string;
    business_slug: string;
    demand_id: string;
    start_at: Date | string;
    end_at: Date | string;
    time_zone: string;
    status: SchedulerReservation['status'];
    revision: number;
    created_at: Date | string;
    updated_at: Date | string;
  }>(
    `SELECT reservation_id, business_slug, demand_id, start_at, end_at, time_zone,
            status, revision, created_at, updated_at
       FROM scheduler_reservations
      WHERE business_slug = $1 AND reservation_id = $2`,
    [businessSlug, reservationId],
  );
  const row = reservationResult.rows[0];
  if (!row) throw new SchedulerReservationError('RESERVATION_NOT_FOUND', `reservation ${reservationId} is missing`);
  const assignmentsResult = await client.query<{ resource_id: string; capacity_units: number }>(
    `SELECT resource_id, capacity_units
       FROM scheduler_reservation_assignments
      WHERE business_slug = $1 AND reservation_id = $2
      ORDER BY resource_id ASC`,
    [businessSlug, reservationId],
  );
  const reservation: SchedulerReservation = {
    reservationId: row.reservation_id,
    businessSlug: row.business_slug,
    demandId: row.demand_id,
    startAt: new Date(row.start_at).toISOString(),
    endAt: new Date(row.end_at).toISOString(),
    timeZone: row.time_zone,
    assignments: assignmentsResult.rows.map((assignment) => ({
      resourceId: assignment.resource_id,
      capacityUnits: assignment.capacity_units,
    })),
    status: row.status,
    revision: row.revision,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
  const issues = validateSchedulerReservation(reservation);
  if (issues.length > 0) throw new Error(`SCHEDULER_PERSISTED_RESERVATION_INVALID:${JSON.stringify(issues)}`);
  return reservation;
}

async function resolveCandidate(
  pool: Pool,
  input: ConfirmReservationInput,
  now: string,
): Promise<SlotCandidate | undefined> {
  if (!input.candidateId) return undefined;
  const zones = await pool.query<{ time_zone: string }>(
    `SELECT DISTINCT time_zone
       FROM scheduler_resources
      WHERE business_slug = $1 AND status = 'ACTIVE'
      ORDER BY time_zone ASC`,
    [input.businessSlug],
  );
  const startMs = Date.parse(input.requestedStartAt);
  const endAt = new Date(startMs + input.demand.offering.durationMinutes * MINUTE_MS).toISOString();
  for (const zone of zones.rows) {
    const result = await queryDeterministicMultiResourceAvailability(pool, {
      businessSlug: input.businessSlug,
      requestId: `confirm-multi:${input.operationId}:${zone.time_zone}`,
      demand: input.demand,
      window: {
        startAt: new Date(startMs).toISOString(),
        endAt,
        timeZone: zone.time_zone,
      },
    }, {
      granularityMinutes: 1,
      generatedAt: now,
      asOf: now,
    });
    const candidate = result.slots.find((slot) => slot.candidateId === input.candidateId);
    if (candidate) return candidate;
  }
  return undefined;
}

async function hasCapacityConflict(
  client: PoolClient,
  input: ConfirmReservationInput,
  assignments: readonly ResourceAssignment[],
  now: string,
): Promise<boolean> {
  const startMs = Date.parse(input.requestedStartAt);
  const endMs = startMs + input.demand.offering.durationMinutes * MINUTE_MS;
  for (const assignment of assignments) {
    const resource = await client.query<{ capacity: number }>(
      `SELECT capacity
         FROM scheduler_resources
        WHERE business_slug = $1 AND resource_id = $2`,
      [input.businessSlug, assignment.resourceId],
    );
    const capacity = resource.rows[0]?.capacity;
    if (capacity === undefined) return false;
    const usage = await client.query<{ used: string }>(
      `SELECT COALESCE(SUM(a.capacity_units),0)::text AS used
         FROM scheduler_reservations r
         JOIN scheduler_reservation_assignments a
           ON a.business_slug = r.business_slug AND a.reservation_id = r.reservation_id
        WHERE r.business_slug = $1
          AND a.resource_id = $2
          AND r.status = 'RESERVED'
          AND r.start_at < $4::timestamptz
          AND r.end_at > $3::timestamptz`,
      [input.businessSlug, assignment.resourceId, new Date(startMs).toISOString(), new Date(endMs).toISOString()],
    );
    const holds = await client.query<{ used: string }>(
      `SELECT COALESCE(SUM(a.capacity_units),0)::text AS used
         FROM scheduler_holds h
         JOIN scheduler_hold_assignments a
           ON a.business_slug = h.business_slug AND a.hold_id = h.hold_id
        WHERE h.business_slug = $1
          AND a.resource_id = $2
          AND h.status = 'ACTIVE'
          AND h.expires_at > $5::timestamptz
          AND h.start_at < $4::timestamptz
          AND h.end_at > $3::timestamptz`,
      [input.businessSlug, assignment.resourceId, new Date(startMs).toISOString(), new Date(endMs).toISOString(), now],
    );
    const used = Number(usage.rows[0]?.used ?? '0') + Number(holds.rows[0]?.used ?? '0');
    if (used + assignment.capacityUnits > capacity) return true;
  }
  return false;
}

/**
 * G2-S8 direct multi-resource confirmation. Holds remain the one-resource G2-S4
 * contract; multi-resource hold lifecycle is intentionally not claimed here.
 */
export async function confirmMultiResourceReservationAtomic(
  pool: Pool,
  input: ConfirmReservationInput,
  options: ConfirmReservationOptions = {},
): Promise<ConfirmReservationResult> {
  const issues = validateConfirmReservationInput(input);
  if (issues.length > 0) {
    throw new SchedulerReservationError('SCHEDULING_DEMAND_INVALID', JSON.stringify(issues));
  }
  if (input.demand.requiredCapabilities.length < 2) {
    throw new SchedulerReservationError('SCHEDULING_DEMAND_INVALID', 'G2-S8 multi-resource confirmation requires at least two capability demands');
  }
  if (!input.candidateId || input.holdId) {
    throw new SchedulerReservationError(
      'SCHEDULING_DEMAND_INVALID',
      'G2-S8 multi-resource confirmation requires candidateId and does not certify multi-resource hold consumption',
    );
  }

  const nowValue = options.now ?? new Date().toISOString();
  if (!Number.isFinite(Date.parse(nowValue))) {
    throw new SchedulerReservationError('SCHEDULING_DEMAND_INVALID', 'confirmation now must be an unambiguous instant');
  }
  const now = new Date(Date.parse(nowValue)).toISOString();
  const initialCandidate = await resolveCandidate(pool, input, now);
  if (!initialCandidate || initialCandidate.assignments.length < 2) {
    throw new SchedulerReservationError('SLOT_NO_LONGER_AVAILABLE', `candidate ${input.candidateId} is not currently available`);
  }

  const material = commandMaterial(input);
  const materialHash = sha256(stableJson(material));
  const reservationId = `schedres_${sha256(`${input.businessSlug}:${input.operationId}`).slice(0, 32)}`;

  return transaction(pool, async (client) => {
    await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [
      `scheduler-operation:${input.businessSlug}:${input.operationId}`,
    ]);

    const previousCommand = await client.query<{
      command_type: string;
      material_hash: string;
      result_type: string | null;
      result_id: string | null;
    }>(
      `SELECT command_type, material_hash, result_type, result_id
         FROM scheduler_commands
        WHERE business_slug = $1 AND operation_id = $2
        FOR UPDATE`,
      [input.businessSlug, input.operationId],
    );
    const previous = previousCommand.rows[0];
    if (previous) {
      if (
        previous.command_type !== 'ConfirmReservation'
        || previous.material_hash !== materialHash
        || previous.result_type !== 'RESERVATION'
        || previous.result_id !== reservationId
      ) {
        throw new SchedulerReservationError(
          'IDEMPOTENCY_MATERIAL_CONFLICT',
          `operation ${input.operationId} was already used with different material or result identity`,
        );
      }
      return {
        reservation: await loadReservation(client, input.businessSlug, reservationId),
        replayed: true,
      };
    }

    const assignments = [...initialCandidate.assignments]
      .sort((a, b) => a.resourceId.localeCompare(b.resourceId));
    for (const assignment of assignments) {
      await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [
        `scheduler-capacity:${input.businessSlug}:${assignment.resourceId}`,
      ]);
    }

    const lockedResources = await client.query<{ resource_id: string; status: 'ACTIVE' | 'INACTIVE'; time_zone: string; capacity: number }>(
      `SELECT resource_id, status, time_zone, capacity
         FROM scheduler_resources
        WHERE business_slug = $1 AND resource_id = ANY($2::text[])
        ORDER BY resource_id ASC
        FOR UPDATE`,
      [input.businessSlug, assignments.map((assignment) => assignment.resourceId)],
    );
    if (lockedResources.rows.length !== assignments.length) {
      throw new SchedulerReservationError('SLOT_NO_LONGER_AVAILABLE', 'one or more candidate resources no longer exist');
    }
    if (lockedResources.rows.some((resource) => resource.status !== 'ACTIVE')) {
      throw new SchedulerReservationError('RESOURCE_INACTIVE', 'one or more candidate resources became inactive');
    }

    const revalidated = await resolveCandidate(pool, input, now);
    if (
      !revalidated
      || assignmentKey(revalidated.assignments) !== assignmentKey(assignments)
      || revalidated.startAt !== initialCandidate.startAt
      || revalidated.endAt !== initialCandidate.endAt
    ) {
      if (await hasCapacityConflict(client, input, assignments, now)) {
        throw new SchedulerReservationError(
          'CAPACITY_CONFLICT',
          'one or more resources in the multi-resource candidate were consumed before confirmation committed',
        );
      }
      throw new SchedulerReservationError(
        'SLOT_NO_LONGER_AVAILABLE',
        'multi-resource candidate failed commit-time schedule/capability/override revalidation',
      );
    }

    await persistDemandSnapshot(client, input);
    await client.query(
      `INSERT INTO scheduler_reservations (
         reservation_id, business_slug, demand_id, start_at, end_at,
         time_zone, status, revision
       ) VALUES ($1,$2,$3,$4,$5,$6,'RESERVED',1)`,
      [
        reservationId,
        input.businessSlug,
        input.demand.demandId,
        initialCandidate.startAt,
        initialCandidate.endAt,
        initialCandidate.timeZone,
      ],
    );
    for (const assignment of assignments) {
      await client.query(
        `INSERT INTO scheduler_reservation_assignments (
           business_slug, reservation_id, resource_id, capacity_units
         ) VALUES ($1,$2,$3,$4)`,
        [input.businessSlug, reservationId, assignment.resourceId, assignment.capacityUnits],
      );
    }

    const commandId = `schedcmd_${sha256(`${input.businessSlug}:${input.operationId}`).slice(0, 32)}`;
    await client.query(
      `INSERT INTO scheduler_commands (
         command_id, business_slug, operation_id, command_type,
         material_hash, command_material, result_type, result_id
       ) VALUES ($1,$2,$3,'ConfirmReservation',$4,$5::jsonb,'RESERVATION',$6)`,
      [commandId, input.businessSlug, input.operationId, materialHash, JSON.stringify(material), reservationId],
    );

    return {
      reservation: await loadReservation(client, input.businessSlug, reservationId),
      replayed: false,
    };
  });
}
