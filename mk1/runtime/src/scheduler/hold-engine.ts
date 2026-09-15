import { createHash } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
import type {
  CreateHoldInput,
  SchedulerFailureCode,
  SchedulerHold,
  SchedulingDemand,
} from '../contracts/scheduler-engine/index.js';
import {
  validateCreateHoldInput,
  validateSchedulerHold,
  validateSchedulingDemand,
} from '../contracts/scheduler-engine/index.js';
import { queryDeterministicAvailability } from './availability-engine.js';

const MINUTE_MS = 60_000;

export type CreateHoldAtomicInput = Readonly<{
  businessSlug: string;
  operationId: string;
  demand: SchedulingDemand;
  candidateId: string;
  requestedStartAt: string;
  expiresInSeconds: number;
}>;

export type ReleaseHoldInput = Readonly<{
  businessSlug: string;
  operationId: string;
  holdId: string;
}>;

export type HoldMutationOptions = Readonly<{
  now?: string;
}>;

export type HoldMutationResult = Readonly<{
  hold: SchedulerHold;
  replayed: boolean;
}>;

export class SchedulerHoldError extends Error {
  readonly code: SchedulerFailureCode;

  constructor(code: SchedulerFailureCode, message: string) {
    super(message);
    this.name = 'SchedulerHoldError';
    this.code = code;
  }
}

type ResourceRow = Readonly<{
  resource_id: string;
  status: 'ACTIVE' | 'INACTIVE';
  time_zone: string;
}>;

type HoldRow = Readonly<{
  hold_id: string;
  business_slug: string;
  demand_id: string;
  start_at: Date | string;
  end_at: Date | string;
  expires_at: Date | string;
  status: SchedulerHold['status'];
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

function parseNow(options: HoldMutationOptions): string {
  const now = options.now ?? new Date().toISOString();
  if (!Number.isFinite(Date.parse(now))) {
    throw new SchedulerHoldError('SCHEDULING_DEMAND_INVALID', 'hold mutation now must be an unambiguous instant');
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
  input: Pick<CreateHoldAtomicInput, 'businessSlug' | 'demand' | 'requestedStartAt'>,
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

async function persistDemandSnapshot(client: PoolClient, input: CreateHoldAtomicInput): Promise<void> {
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
      throw new SchedulerHoldError(
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

async function loadHold(client: PoolClient, businessSlug: string, holdId: string): Promise<SchedulerHold> {
  const result = await client.query<HoldRow>(
    `SELECT hold_id, business_slug, demand_id, start_at, end_at, expires_at, status
       FROM scheduler_holds
      WHERE business_slug = $1 AND hold_id = $2`,
    [businessSlug, holdId],
  );
  const row = result.rows[0];
  if (!row) throw new SchedulerHoldError('HOLD_NOT_FOUND', `hold ${holdId} not found`);

  const assignments = await client.query<{ resource_id: string; capacity_units: number }>(
    `SELECT resource_id, capacity_units
       FROM scheduler_hold_assignments
      WHERE business_slug = $1 AND hold_id = $2
      ORDER BY resource_id ASC`,
    [businessSlug, holdId],
  );
  const hold: SchedulerHold = {
    holdId: row.hold_id,
    businessSlug: row.business_slug,
    demandId: row.demand_id,
    startAt: new Date(row.start_at).toISOString(),
    endAt: new Date(row.end_at).toISOString(),
    assignments: assignments.rows.map((assignment) => ({
      resourceId: assignment.resource_id,
      capacityUnits: assignment.capacity_units,
    })),
    expiresAt: new Date(row.expires_at).toISOString(),
    status: row.status,
  };
  const issues = validateSchedulerHold(hold);
  if (issues.length > 0) throw new Error(`SCHEDULER_G2_S4_PERSISTED_HOLD_INVALID:${JSON.stringify(issues)}`);
  return hold;
}

function validateCreateAtomic(input: CreateHoldAtomicInput): void {
  const base: CreateHoldInput = {
    businessSlug: input.businessSlug,
    operationId: input.operationId,
    demandId: input.demand.demandId,
    candidateId: input.candidateId,
    expiresInSeconds: input.expiresInSeconds,
  };
  const issues = [
    ...validateCreateHoldInput(base),
    ...validateSchedulingDemand(input.demand),
  ];
  if (input.demand.businessSlug !== input.businessSlug) {
    throw new SchedulerHoldError('SCHEDULING_DEMAND_INVALID', 'hold demand scope must match command scope');
  }
  if (!Number.isFinite(Date.parse(input.requestedStartAt))) {
    throw new SchedulerHoldError('SCHEDULING_DEMAND_INVALID', 'requestedStartAt must be an unambiguous instant');
  }
  if (issues.length > 0) {
    throw new SchedulerHoldError('SCHEDULING_DEMAND_INVALID', JSON.stringify(issues));
  }
}

export async function createHoldAtomic(
  pool: Pool,
  input: CreateHoldAtomicInput,
  options: HoldMutationOptions = {},
): Promise<HoldMutationResult> {
  validateCreateAtomic(input);
  const now = parseNow(options);
  const expiresAt = new Date(Date.parse(now) + input.expiresInSeconds * 1000).toISOString();
  const material = {
    demand: input.demand,
    candidateId: input.candidateId,
    requestedStartAt: new Date(Date.parse(input.requestedStartAt)).toISOString(),
    expiresInSeconds: input.expiresInSeconds,
  };
  const materialHash = sha256(stableJson(material));
  const holdId = `schedhold_${sha256(`${input.businessSlug}:${input.operationId}`).slice(0, 32)}`;

  return transaction(pool, async (client) => {
    await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [
      `scheduler-operation:${input.businessSlug}:${input.operationId}`,
    ]);

    const previous = await client.query<{
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
    const command = previous.rows[0];
    if (command) {
      if (
        command.command_type !== 'CreateHold'
        || command.material_hash !== materialHash
        || command.result_type !== 'HOLD'
        || command.result_id !== holdId
      ) {
        throw new SchedulerHoldError(
          'IDEMPOTENCY_MATERIAL_CONFLICT',
          `operation ${input.operationId} was already used with different material or result identity`,
        );
      }
      return { hold: await loadHold(client, input.businessSlug, holdId), replayed: true };
    }

    const resources = await client.query<ResourceRow>(
      `SELECT resource_id, status, time_zone
         FROM scheduler_resources
        WHERE business_slug = $1
        ORDER BY resource_id ASC`,
      [input.businessSlug],
    );
    if (resources.rows.length === 0) {
      throw new SchedulerHoldError('BUSINESS_SCOPE_NOT_FOUND', `no Scheduler resources exist for ${input.businessSlug}`);
    }
    const selected = resources.rows.find((resource) =>
      canonicalCandidateId(input, resource.resource_id, resource.time_zone) === input.candidateId,
    );
    if (!selected) {
      throw new SchedulerHoldError('SLOT_NO_LONGER_AVAILABLE', 'candidate no longer resolves against current resource truth');
    }

    await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [
      `scheduler-capacity:${input.businessSlug}:${selected.resource_id}`,
    ]);
    const locked = await client.query<ResourceRow>(
      `SELECT resource_id, status, time_zone
         FROM scheduler_resources
        WHERE business_slug = $1 AND resource_id = $2
        FOR UPDATE`,
      [input.businessSlug, selected.resource_id],
    );
    const resource = locked.rows[0];
    if (!resource) throw new SchedulerHoldError('SLOT_NO_LONGER_AVAILABLE', 'resource disappeared before hold commit');
    if (resource.status !== 'ACTIVE') throw new SchedulerHoldError('RESOURCE_INACTIVE', `resource ${resource.resource_id} is inactive`);

    const startMs = Date.parse(input.requestedStartAt);
    const serviceEnd = startMs + input.demand.offering.durationMinutes * MINUTE_MS;
    const serviceStartIso = new Date(startMs).toISOString();
    const serviceEndIso = new Date(serviceEnd).toISOString();
    const current = await queryDeterministicAvailability(pool, {
      businessSlug: input.businessSlug,
      requestId: `hold-${input.operationId}`,
      demand: input.demand,
      window: {
        startAt: serviceStartIso,
        endAt: serviceEndIso,
        timeZone: resource.time_zone,
      },
      preferredResourceIds: [resource.resource_id],
    }, {
      granularityMinutes: 1,
      generatedAt: now,
      asOf: now,
    });
    const stillAvailable = current.slots.some((slot) =>
      slot.candidateId === input.candidateId
      && slot.startAt === serviceStartIso
      && slot.endAt === serviceEndIso
      && slot.assignments.length === 1
      && slot.assignments[0]?.resourceId === resource.resource_id
      && slot.assignments[0]?.capacityUnits === input.demand.capacityUnits,
    );
    if (!stillAvailable) {
      throw new SchedulerHoldError('SLOT_NO_LONGER_AVAILABLE', `candidate ${input.candidateId} is no longer available for hold`);
    }

    await persistDemandSnapshot(client, input);
    const occupiedStart = new Date(startMs - input.demand.buffers.beforeMinutes * MINUTE_MS).toISOString();
    const occupiedEnd = new Date(serviceEnd + input.demand.buffers.afterMinutes * MINUTE_MS).toISOString();
    await client.query(
      `INSERT INTO scheduler_holds (
         hold_id, business_slug, demand_id, start_at, end_at, expires_at, status
       ) VALUES ($1,$2,$3,$4,$5,$6,'ACTIVE')`,
      [holdId, input.businessSlug, input.demand.demandId, occupiedStart, occupiedEnd, expiresAt],
    );
    await client.query(
      `INSERT INTO scheduler_hold_assignments (
         business_slug, hold_id, resource_id, capacity_units
       ) VALUES ($1,$2,$3,$4)`,
      [input.businessSlug, holdId, resource.resource_id, input.demand.capacityUnits],
    );
    const commandId = `schedcmd_${sha256(`${input.businessSlug}:${input.operationId}`).slice(0, 32)}`;
    await client.query(
      `INSERT INTO scheduler_commands (
         command_id, business_slug, operation_id, command_type,
         material_hash, command_material, result_type, result_id
       ) VALUES ($1,$2,$3,'CreateHold',$4,$5::jsonb,'HOLD',$6)`,
      [commandId, input.businessSlug, input.operationId, materialHash, JSON.stringify(material), holdId],
    );

    return { hold: await loadHold(client, input.businessSlug, holdId), replayed: false };
  });
}

export async function releaseHoldAtomic(
  pool: Pool,
  input: ReleaseHoldInput,
  options: HoldMutationOptions = {},
): Promise<HoldMutationResult> {
  if (!input.businessSlug.trim() || !input.operationId.trim() || !input.holdId.trim()) {
    throw new SchedulerHoldError('SCHEDULING_DEMAND_INVALID', 'businessSlug, operationId and holdId are required');
  }
  const now = parseNow(options);
  const material = { holdId: input.holdId };
  const materialHash = sha256(stableJson(material));

  return transaction(pool, async (client) => {
    await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [
      `scheduler-operation:${input.businessSlug}:${input.operationId}`,
    ]);
    const previous = await client.query<{
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
    const command = previous.rows[0];
    if (command) {
      if (
        command.command_type !== 'ReleaseHold'
        || command.material_hash !== materialHash
        || command.result_type !== 'HOLD'
        || command.result_id !== input.holdId
      ) {
        throw new SchedulerHoldError('IDEMPOTENCY_MATERIAL_CONFLICT', 'release operation identity was reused with different material');
      }
      return { hold: await loadHold(client, input.businessSlug, input.holdId), replayed: true };
    }

    const current = await client.query<HoldRow>(
      `SELECT hold_id, business_slug, demand_id, start_at, end_at, expires_at, status
         FROM scheduler_holds
        WHERE business_slug = $1 AND hold_id = $2
        FOR UPDATE`,
      [input.businessSlug, input.holdId],
    );
    const row = current.rows[0];
    if (!row) throw new SchedulerHoldError('HOLD_NOT_FOUND', `hold ${input.holdId} not found`);
    if (row.status === 'ACTIVE' && Date.parse(new Date(row.expires_at).toISOString()) <= Date.parse(now)) {
      throw new SchedulerHoldError('HOLD_EXPIRED', `hold ${input.holdId} is logically expired`);
    }
    if (row.status === 'EXPIRED') throw new SchedulerHoldError('HOLD_EXPIRED', `hold ${input.holdId} is expired`);
    if (row.status === 'CONSUMED') throw new SchedulerHoldError('HOLD_NOT_FOUND', `hold ${input.holdId} was already consumed`);
    if (row.status === 'ACTIVE') {
      await client.query(
        `UPDATE scheduler_holds
            SET status = 'RELEASED', updated_at = NOW()
          WHERE business_slug = $1 AND hold_id = $2`,
        [input.businessSlug, input.holdId],
      );
    }

    const commandId = `schedcmd_${sha256(`${input.businessSlug}:${input.operationId}`).slice(0, 32)}`;
    await client.query(
      `INSERT INTO scheduler_commands (
         command_id, business_slug, operation_id, command_type,
         material_hash, command_material, result_type, result_id
       ) VALUES ($1,$2,$3,'ReleaseHold',$4,$5::jsonb,'HOLD',$6)`,
      [commandId, input.businessSlug, input.operationId, materialHash, JSON.stringify(material), input.holdId],
    );
    return { hold: await loadHold(client, input.businessSlug, input.holdId), replayed: false };
  });
}

/** Housekeeping only: correctness already uses expires_at directly in availability/confirmation. */
export async function expireHoldsHousekeeping(pool: Pool, asOf: string): Promise<readonly string[]> {
  if (!Number.isFinite(Date.parse(asOf))) {
    throw new SchedulerHoldError('SCHEDULING_DEMAND_INVALID', 'housekeeping asOf must be an unambiguous instant');
  }
  const result = await pool.query<{ hold_id: string }>(
    `UPDATE scheduler_holds
        SET status = 'EXPIRED', updated_at = NOW()
      WHERE status = 'ACTIVE' AND expires_at <= $1::timestamptz
      RETURNING hold_id`,
    [new Date(Date.parse(asOf)).toISOString()],
  );
  return result.rows.map((row) => row.hold_id).sort();
}
