import { createHash } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
import type {
  ConfirmReservationInput,
  SchedulerFailureCode,
  SchedulerReservation,
} from '../contracts/scheduler-engine/index.js';
import {
  validateConfirmReservationInput,
  validateSchedulerReservation,
} from '../contracts/scheduler-engine/index.js';
import { queryDeterministicAvailability } from './availability-engine.js';

const MINUTE_MS = 60_000;

export type ConfirmReservationResult = Readonly<{
  reservation: SchedulerReservation;
  replayed: boolean;
}>;

export type ConfirmReservationOptions = Readonly<{
  now?: string;
}>;

export class SchedulerReservationError extends Error {
  readonly code: SchedulerFailureCode;

  constructor(code: SchedulerFailureCode, message: string) {
    super(message);
    this.name = 'SchedulerReservationError';
    this.code = code;
  }
}

type ResourceRow = Readonly<{
  resource_id: string;
  status: 'ACTIVE' | 'INACTIVE';
  time_zone: string;
  capacity: number;
}>;

type AllocationRow = Readonly<{
  start_at: Date | string;
  end_at: Date | string;
  capacity_units: number;
}>;

type HoldRow = Readonly<{
  hold_id: string;
  demand_id: string;
  start_at: Date | string;
  end_at: Date | string;
  expires_at: Date | string;
  status: 'ACTIVE' | 'EXPIRED' | 'RELEASED' | 'CONSUMED';
}>;

type HoldAssignmentRow = Readonly<{
  resource_id: string;
  capacity_units: number;
}>;

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function stableJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${stableJson(record[key])}`).join(',')}}`;
}

function asMs(value: Date | string): number {
  return value instanceof Date ? value.getTime() : Date.parse(value);
}

function parseNow(options: ConfirmReservationOptions): string {
  const now = options.now ?? new Date().toISOString();
  if (!Number.isFinite(Date.parse(now))) {
    throw new SchedulerReservationError('SCHEDULING_DEMAND_INVALID', 'confirmation now must be an unambiguous instant');
  }
  return new Date(Date.parse(now)).toISOString();
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

function canonicalCandidateId(
  input: ConfirmReservationInput,
  resourceId: string,
  timeZone: string,
): string {
  const startMs = Date.parse(input.requestedStartAt);
  const endMs = startMs + input.demand.offering.durationMinutes * MINUTE_MS;
  const material = {
    businessSlug: input.businessSlug,
    demandId: input.demand.demandId,
    startAt: new Date(startMs).toISOString(),
    endAt: new Date(endMs).toISOString(),
    timeZone,
    assignments: [{ resourceId, capacityUnits: input.demand.capacityUnits }],
  };
  return `slot_${sha256(stableJson(material)).slice(0, 32)}`;
}

function commandMaterial(input: ConfirmReservationInput): Readonly<Record<string, unknown>> {
  return {
    demand: input.demand,
    candidateId: input.candidateId ?? null,
    holdId: input.holdId ?? null,
    requestedStartAt: new Date(Date.parse(input.requestedStartAt)).toISOString(),
  };
}

function maximumConcurrentUsage(rows: readonly AllocationRow[], start: number, end: number): number {
  const events: { at: number; delta: number }[] = [];
  for (const row of rows) {
    const allocationStart = Math.max(start, asMs(row.start_at));
    const allocationEnd = Math.min(end, asMs(row.end_at));
    if (allocationStart >= allocationEnd) continue;
    events.push({ at: allocationStart, delta: row.capacity_units });
    events.push({ at: allocationEnd, delta: -row.capacity_units });
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

async function loadReservation(
  client: PoolClient,
  businessSlug: string,
  reservationId: string,
): Promise<SchedulerReservation> {
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
  if (!row) {
    throw new SchedulerReservationError(
      'RESERVATION_NOT_FOUND',
      `reservation ${reservationId} referenced by command ledger is missing`,
    );
  }
  const assignmentsResult = await client.query<{
    resource_id: string;
    capacity_units: number;
  }>(
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
  if (issues.length > 0) {
    throw new Error(`SCHEDULER_PERSISTED_RESERVATION_INVALID:${JSON.stringify(issues)}`);
  }
  return reservation;
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

async function currentBlockingUsage(
  client: PoolClient,
  businessSlug: string,
  resourceId: string,
  occupancyStart: number,
  occupancyEnd: number,
  asOf: string,
  excludeHoldId?: string,
): Promise<number> {
  const [reservations, holds] = await Promise.all([
    client.query<AllocationRow>(
      `SELECT r.start_at, r.end_at, a.capacity_units
         FROM scheduler_reservations r
         JOIN scheduler_reservation_assignments a
           ON a.business_slug = r.business_slug AND a.reservation_id = r.reservation_id
        WHERE r.business_slug = $1
          AND a.resource_id = $2
          AND r.status = 'RESERVED'
          AND r.start_at < $4::timestamptz
          AND r.end_at > $3::timestamptz`,
      [businessSlug, resourceId, new Date(occupancyStart).toISOString(), new Date(occupancyEnd).toISOString()],
    ),
    client.query<AllocationRow>(
      `SELECT h.start_at, h.end_at, a.capacity_units
         FROM scheduler_holds h
         JOIN scheduler_hold_assignments a
           ON a.business_slug = h.business_slug AND a.hold_id = h.hold_id
        WHERE h.business_slug = $1
          AND a.resource_id = $2
          AND h.status = 'ACTIVE'
          AND h.expires_at > $5::timestamptz
          AND ($6::text IS NULL OR h.hold_id <> $6::text)
          AND h.start_at < $4::timestamptz
          AND h.end_at > $3::timestamptz`,
      [
        businessSlug,
        resourceId,
        new Date(occupancyStart).toISOString(),
        new Date(occupancyEnd).toISOString(),
        asOf,
        excludeHoldId ?? null,
      ],
    ),
  ]);
  return maximumConcurrentUsage([...reservations.rows, ...holds.rows], occupancyStart, occupancyEnd);
}

async function lockHoldForConsumption(
  client: PoolClient,
  input: ConfirmReservationInput,
  now: string,
): Promise<{ row: HoldRow; assignment: HoldAssignmentRow }> {
  if (!input.holdId) throw new SchedulerReservationError('HOLD_NOT_FOUND', 'holdId is required');
  const holdResult = await client.query<HoldRow>(
    `SELECT hold_id, demand_id, start_at, end_at, expires_at, status
       FROM scheduler_holds
      WHERE business_slug = $1 AND hold_id = $2
      FOR UPDATE`,
    [input.businessSlug, input.holdId],
  );
  const row = holdResult.rows[0];
  if (!row) throw new SchedulerReservationError('HOLD_NOT_FOUND', `hold ${input.holdId} not found`);
  if (row.demand_id !== input.demand.demandId) {
    throw new SchedulerReservationError('HOLD_NOT_FOUND', 'hold demand identity does not match reservation demand');
  }
  if (row.status === 'EXPIRED' || (row.status === 'ACTIVE' && asMs(row.expires_at) <= Date.parse(now))) {
    throw new SchedulerReservationError('HOLD_EXPIRED', `hold ${input.holdId} is logically expired`);
  }
  if (row.status !== 'ACTIVE') {
    throw new SchedulerReservationError('HOLD_NOT_FOUND', `hold ${input.holdId} is not active`);
  }

  const assignments = await client.query<HoldAssignmentRow>(
    `SELECT resource_id, capacity_units
       FROM scheduler_hold_assignments
      WHERE business_slug = $1 AND hold_id = $2
      ORDER BY resource_id ASC`,
    [input.businessSlug, input.holdId],
  );
  if (assignments.rows.length !== 1) {
    throw new SchedulerReservationError('SLOT_NO_LONGER_AVAILABLE', 'G2-S4 hold consumption certifies one resource only');
  }
  const assignment = assignments.rows[0]!;
  if (assignment.capacity_units !== input.demand.capacityUnits) {
    throw new SchedulerReservationError('SLOT_NO_LONGER_AVAILABLE', 'hold capacity material no longer matches demand');
  }

  const startMs = Date.parse(input.requestedStartAt);
  const serviceEnd = startMs + input.demand.offering.durationMinutes * MINUTE_MS;
  const expectedOccupiedStart = startMs - input.demand.buffers.beforeMinutes * MINUTE_MS;
  const expectedOccupiedEnd = serviceEnd + input.demand.buffers.afterMinutes * MINUTE_MS;
  if (asMs(row.start_at) !== expectedOccupiedStart || asMs(row.end_at) !== expectedOccupiedEnd) {
    throw new SchedulerReservationError('SLOT_NO_LONGER_AVAILABLE', 'hold occupied interval no longer matches requested demand interval');
  }
  return { row, assignment };
}

/**
 * G2-S3 direct confirmation remains certified. G2-S4 extends the same transaction
 * to consume one unexpired persisted hold atomically when holdId is supplied.
 */
export async function confirmReservationAtomic(
  pool: Pool,
  input: ConfirmReservationInput,
  options: ConfirmReservationOptions = {},
): Promise<ConfirmReservationResult> {
  const issues = validateConfirmReservationInput(input);
  if (issues.length > 0) {
    throw new SchedulerReservationError('SCHEDULING_DEMAND_INVALID', JSON.stringify(issues));
  }
  const now = parseNow(options);

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

    const lockedHold = input.holdId
      ? await lockHoldForConsumption(client, input, now)
      : undefined;
    if (!lockedHold && !input.candidateId) {
      throw new SchedulerReservationError('SLOT_NO_LONGER_AVAILABLE', 'candidateId or holdId is required for confirmation');
    }

    const resources = await client.query<ResourceRow>(
      `SELECT resource_id, status, time_zone, capacity
         FROM scheduler_resources
        WHERE business_slug = $1
        ORDER BY resource_id ASC`,
      [input.businessSlug],
    );
    if (resources.rows.length === 0) {
      throw new SchedulerReservationError('BUSINESS_SCOPE_NOT_FOUND', `no Scheduler resources exist for ${input.businessSlug}`);
    }

    const selected = lockedHold
      ? resources.rows.find((resource) => resource.resource_id === lockedHold.assignment.resource_id)
      : resources.rows.find((resource) =>
          canonicalCandidateId(input, resource.resource_id, resource.time_zone) === input.candidateId,
        );
    if (!selected) {
      throw new SchedulerReservationError(
        'SLOT_NO_LONGER_AVAILABLE',
        'candidate/hold resource identity no longer resolves against current business truth',
      );
    }

    const expectedCandidateId = canonicalCandidateId(input, selected.resource_id, selected.time_zone);
    if (input.candidateId !== undefined && input.candidateId !== expectedCandidateId) {
      throw new SchedulerReservationError('SLOT_NO_LONGER_AVAILABLE', 'candidate identity does not match current hold/resource material');
    }

    await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [
      `scheduler-capacity:${input.businessSlug}:${selected.resource_id}`,
    ]);
    const lockedResourceResult = await client.query<ResourceRow>(
      `SELECT resource_id, status, time_zone, capacity
         FROM scheduler_resources
        WHERE business_slug = $1 AND resource_id = $2
        FOR UPDATE`,
      [input.businessSlug, selected.resource_id],
    );
    const lockedResource = lockedResourceResult.rows[0];
    if (!lockedResource) {
      throw new SchedulerReservationError('SLOT_NO_LONGER_AVAILABLE', `resource ${selected.resource_id} no longer exists`);
    }
    if (lockedResource.status !== 'ACTIVE') {
      throw new SchedulerReservationError('RESOURCE_INACTIVE', `resource ${selected.resource_id} is inactive`);
    }
    if (lockedResource.time_zone !== selected.time_zone) {
      throw new SchedulerReservationError('SLOT_NO_LONGER_AVAILABLE', 'resource timezone changed after candidate generation');
    }

    const startMs = Date.parse(input.requestedStartAt);
    const endMs = startMs + input.demand.offering.durationMinutes * MINUTE_MS;
    const canonicalStart = new Date(startMs).toISOString();
    const canonicalEnd = new Date(endMs).toISOString();
    const currentAvailability = await queryDeterministicAvailability(pool, {
      businessSlug: input.businessSlug,
      requestId: `confirm-${input.operationId}`,
      demand: input.demand,
      window: {
        startAt: canonicalStart,
        endAt: canonicalEnd,
        timeZone: lockedResource.time_zone,
      },
      preferredResourceIds: [lockedResource.resource_id],
    }, {
      granularityMinutes: 1,
      generatedAt: now,
      asOf: now,
      ...(input.holdId ? { excludeHoldId: input.holdId } : {}),
    });

    const stillAvailable = currentAvailability.slots.some((slot) =>
      slot.candidateId === expectedCandidateId
      && slot.startAt === canonicalStart
      && slot.endAt === canonicalEnd
      && slot.assignments.length === 1
      && slot.assignments[0]?.resourceId === lockedResource.resource_id
      && slot.assignments[0]?.capacityUnits === input.demand.capacityUnits,
    );

    if (!stillAvailable) {
      const occupancyStart = startMs - input.demand.buffers.beforeMinutes * MINUTE_MS;
      const occupancyEnd = endMs + input.demand.buffers.afterMinutes * MINUTE_MS;
      const usedCapacity = await currentBlockingUsage(
        client,
        input.businessSlug,
        lockedResource.resource_id,
        occupancyStart,
        occupancyEnd,
        now,
        input.holdId,
      );
      if (usedCapacity + input.demand.capacityUnits > lockedResource.capacity) {
        throw new SchedulerReservationError(
          'CAPACITY_CONFLICT',
          `resource ${lockedResource.resource_id} capacity was consumed before confirmation committed`,
        );
      }
      throw new SchedulerReservationError(
        'SLOT_NO_LONGER_AVAILABLE',
        `candidate ${expectedCandidateId} failed commit-time schedule/capability/override revalidation`,
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
        canonicalStart,
        canonicalEnd,
        lockedResource.time_zone,
      ],
    );
    await client.query(
      `INSERT INTO scheduler_reservation_assignments (
         business_slug, reservation_id, resource_id, capacity_units
       ) VALUES ($1,$2,$3,$4)`,
      [input.businessSlug, reservationId, lockedResource.resource_id, input.demand.capacityUnits],
    );

    if (lockedHold && input.holdId) {
      const consumed = await client.query(
        `UPDATE scheduler_holds
            SET status = 'CONSUMED', updated_at = NOW()
          WHERE business_slug = $1 AND hold_id = $2 AND status = 'ACTIVE'`,
        [input.businessSlug, input.holdId],
      );
      if (consumed.rowCount !== 1) {
        throw new SchedulerReservationError('HOLD_NOT_FOUND', `hold ${input.holdId} could not be consumed atomically`);
      }
    }

    const commandId = `schedcmd_${sha256(`${input.businessSlug}:${input.operationId}`).slice(0, 32)}`;
    await client.query(
      `INSERT INTO scheduler_commands (
         command_id, business_slug, operation_id, command_type,
         material_hash, command_material, result_type, result_id
       ) VALUES ($1,$2,$3,'ConfirmReservation',$4,$5::jsonb,'RESERVATION',$6)`,
      [
        commandId,
        input.businessSlug,
        input.operationId,
        materialHash,
        JSON.stringify(material),
        reservationId,
      ],
    );

    return {
      reservation: await loadReservation(client, input.businessSlug, reservationId),
      replayed: false,
    };
  });
}
