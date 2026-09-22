import { createHash } from 'node:crypto';
import { Pool, type PoolClient } from 'pg';
import type { ServicesSelectionSnapshot } from '../contracts/services-engine/index.js';
import {
  validateServiceSchedulingProfile,
} from '../contracts/services-engine/index.js';
import type { SchedulingDemand } from '../contracts/scheduler-engine/index.js';
import { validateSchedulingDemand } from '../contracts/scheduler-engine/index.js';

export type ServicesDemandHandoffErrorCode =
  | 'INVALID_DEMAND_ID'
  | 'SNAPSHOT_SCOPE_MISMATCH'
  | 'SNAPSHOT_INACTIVE'
  | 'SCHEDULING_PROFILE_MISSING'
  | 'SCHEDULING_PROFILE_INVALID'
  | 'SCHEDULING_DEMAND_INVALID'
  | 'DEMAND_MATERIAL_CONFLICT';

export class ServicesDemandHandoffError extends Error {
  constructor(
    readonly code: ServicesDemandHandoffErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'ServicesDemandHandoffError';
  }
}

export type PersistSchedulingDemandResult = Readonly<{
  demand: SchedulingDemand;
  snapshotHash: string;
  replayed: boolean;
}>;

function stableJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableJson(record[key])}`)
    .join(',')}}`;
}

function sha256(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

function cloneDemand(value: SchedulingDemand): SchedulingDemand {
  return JSON.parse(JSON.stringify(value)) as SchedulingDemand;
}

async function transaction<T>(
  pool: Pool,
  work: (client: PoolClient) => Promise<T>,
): Promise<T> {
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

/**
 * Freeze the already-selected Services snapshot into the canonical Scheduler
 * demand contract. This function never reads the mutable Services catalog.
 */
export function materializeSchedulingDemandFromServicesSnapshot(
  snapshot: ServicesSelectionSnapshot,
  demandId: string,
): SchedulingDemand {
  if (typeof demandId !== 'string' || demandId.trim().length === 0) {
    throw new ServicesDemandHandoffError('INVALID_DEMAND_ID', 'demandId must be a non-empty string');
  }

  const { service, offering } = snapshot;
  if (
    service.businessSlug !== offering.businessSlug
    || service.serviceId !== offering.serviceId
  ) {
    throw new ServicesDemandHandoffError(
      'SNAPSHOT_SCOPE_MISMATCH',
      'Services snapshot service/offering scope or identity does not match',
    );
  }

  if (service.status !== 'ACTIVE' || offering.status !== 'ACTIVE') {
    throw new ServicesDemandHandoffError(
      'SNAPSHOT_INACTIVE',
      'Only an active frozen Services selection may create a new SchedulingDemand',
    );
  }

  if (!offering.scheduling) {
    throw new ServicesDemandHandoffError(
      'SCHEDULING_PROFILE_MISSING',
      `Offering ${offering.offeringId} has no scheduling profile`,
    );
  }

  const profileIssues = validateServiceSchedulingProfile(offering.scheduling);
  if (profileIssues.length > 0) {
    throw new ServicesDemandHandoffError(
      'SCHEDULING_PROFILE_INVALID',
      JSON.stringify(profileIssues),
    );
  }

  const demand: SchedulingDemand = {
    schemaVersion: 1,
    businessSlug: service.businessSlug,
    demandId,
    service: {
      serviceId: service.serviceId,
      revision: service.revision,
    },
    offering: {
      offeringId: offering.offeringId,
      revision: offering.revision,
      durationMinutes: offering.durationMinutes,
    },
    capacityUnits: offering.scheduling.capacityUnits,
    requiredCapabilities: offering.scheduling.requiredCapabilities.map((capability) => ({
      code: capability.code,
      quantity: capability.quantity,
      ...(capability.resourceKinds === undefined
        ? {}
        : { resourceKinds: [...capability.resourceKinds] }),
    })),
    buffers: {
      beforeMinutes: offering.scheduling.buffers.beforeMinutes,
      afterMinutes: offering.scheduling.buffers.afterMinutes,
    },
  };

  const demandIssues = validateSchedulingDemand(demand);
  if (demandIssues.length > 0) {
    throw new ServicesDemandHandoffError(
      'SCHEDULING_DEMAND_INVALID',
      JSON.stringify(demandIssues),
    );
  }

  return cloneDemand(demand);
}

/**
 * Persist one immutable demand identity. Retry of identical frozen material is
 * a replay; reuse of the same demandId for different material fails closed.
 */
export async function persistSchedulingDemandImmutable(
  pool: Pool,
  demand: SchedulingDemand,
): Promise<PersistSchedulingDemandResult> {
  const issues = validateSchedulingDemand(demand);
  if (issues.length > 0) {
    throw new ServicesDemandHandoffError('SCHEDULING_DEMAND_INVALID', JSON.stringify(issues));
  }

  const snapshotHash = sha256(stableJson(demand));

  return transaction(pool, async (client) => {
    // demand_id is globally unique in the certified schema, so serialize on the
    // durable demand identity rather than only on business scope.
    await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [
      `scheduler-demand:${demand.demandId}`,
    ]);

    const existing = await client.query<{
      business_slug: string;
      snapshot_hash: string;
    }>(
      `SELECT business_slug, snapshot_hash
         FROM scheduler_demands
        WHERE demand_id = $1
        FOR UPDATE`,
      [demand.demandId],
    );

    const row = existing.rows[0];
    if (row) {
      if (row.business_slug !== demand.businessSlug || row.snapshot_hash !== snapshotHash) {
        throw new ServicesDemandHandoffError(
          'DEMAND_MATERIAL_CONFLICT',
          `demandId ${demand.demandId} already exists with different immutable material`,
        );
      }
      return {
        demand: cloneDemand(demand),
        snapshotHash,
        replayed: true,
      };
    }

    await client.query(
      `INSERT INTO scheduler_demands (
         demand_id, schema_version, business_slug,
         service_id, service_revision, offering_id, offering_revision,
         duration_minutes, capacity_units, required_capabilities,
         buffer_before_minutes, buffer_after_minutes, snapshot_hash
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11,$12,$13)`,
      [
        demand.demandId,
        demand.schemaVersion,
        demand.businessSlug,
        demand.service.serviceId,
        demand.service.revision,
        demand.offering.offeringId,
        demand.offering.revision,
        demand.offering.durationMinutes,
        demand.capacityUnits,
        JSON.stringify(demand.requiredCapabilities),
        demand.buffers.beforeMinutes,
        demand.buffers.afterMinutes,
        snapshotHash,
      ],
    );

    return {
      demand: cloneDemand(demand),
      snapshotHash,
      replayed: false,
    };
  });
}

export async function materializeAndPersistSchedulingDemand(
  pool: Pool,
  snapshot: ServicesSelectionSnapshot,
  demandId: string,
): Promise<PersistSchedulingDemandResult> {
  const demand = materializeSchedulingDemandFromServicesSnapshot(snapshot, demandId);
  return persistSchedulingDemandImmutable(pool, demand);
}
