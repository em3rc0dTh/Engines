import { createHash } from 'node:crypto';
import { Pool, type PoolClient } from 'pg';
import { loadRuntimeConfig } from '../../config/runtime-config.js';
import type {
  ResourceCapability,
  ScheduleOverride,
  ScheduleTemplate,
  SchedulerHold,
  SchedulerReservation,
  SchedulerResource,
  SchedulingDemand,
  WeeklyAvailabilityWindow,
} from '../../contracts/scheduler-engine/index.js';
import {
  validateScheduleOverride,
  validateScheduleTemplate,
  validateSchedulerHold,
  validateSchedulerReservation,
  validateSchedulerResource,
  validateSchedulingDemand,
} from '../../contracts/scheduler-engine/index.js';

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function stableJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${stableJson(record[key])}`).join(',')}}`;
}

function asRecord(value: unknown): Readonly<Record<string, unknown>> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value as Readonly<Record<string, unknown>>;
}

function asCapabilityDemand(value: unknown): SchedulingDemand['requiredCapabilities'] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return [];
    const record = entry as Record<string, unknown>;
    if (typeof record.code !== 'string' || typeof record.quantity !== 'number') return [];
    const resourceKinds = Array.isArray(record.resourceKinds)
      ? record.resourceKinds.filter((kind): kind is string => typeof kind === 'string')
      : undefined;
    return [{
      code: record.code,
      quantity: record.quantity,
      ...(resourceKinds === undefined ? {} : { resourceKinds }),
    }];
  });
}

function asIso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function assertValid(kind: string, issues: readonly { code: string; path: string }[]): void {
  if (issues.length === 0) return;
  throw new Error(`${kind}_VALIDATION_FAILED:${issues.map((entry) => `${entry.code}@${entry.path}`).join(',')}`);
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

export type SchedulerCommandIdentity = Readonly<{
  commandId: string;
  businessSlug: string;
  operationId: string;
  commandType: string;
  material: Readonly<Record<string, unknown>>;
  resultType?: string;
  resultId?: string;
}>;

export class PostgresSchedulerFoundationRepository {
  constructor(private readonly pool: Pool) {}

  async insertResource(value: SchedulerResource): Promise<void> {
    assertValid('SCHEDULER_RESOURCE', validateSchedulerResource(value));
    await transaction(this.pool, async (client) => {
      await client.query(
        `INSERT INTO scheduler_resources (
           resource_id, business_slug, resource_code, resource_kind, resource_name,
           status, time_zone, capacity, revision
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [
          value.resourceId,
          value.businessSlug,
          value.code,
          value.kind,
          value.name,
          value.status,
          value.timeZone,
          value.capacity,
          value.revision,
        ],
      );
      for (const capability of value.capabilities) {
        await client.query(
          `INSERT INTO scheduler_resource_capabilities (
             business_slug, resource_id, capability_code, capacity_units, metadata
           ) VALUES ($1,$2,$3,$4,$5::jsonb)`,
          [
            value.businessSlug,
            value.resourceId,
            capability.code,
            capability.capacityUnits ?? null,
            JSON.stringify(capability.metadata ?? {}),
          ],
        );
      }
    });
  }

  async getResource(businessSlug: string, resourceId: string): Promise<SchedulerResource | undefined> {
    const result = await this.pool.query<{
      resource_id: string;
      business_slug: string;
      resource_code: string;
      resource_kind: string;
      resource_name: string;
      status: SchedulerResource['status'];
      time_zone: string;
      capacity: number;
      revision: number;
    }>(
      `SELECT resource_id, business_slug, resource_code, resource_kind, resource_name,
              status, time_zone, capacity, revision
         FROM scheduler_resources
        WHERE business_slug = $1 AND resource_id = $2`,
      [businessSlug, resourceId],
    );
    const row = result.rows[0];
    if (!row) return undefined;
    const capabilities = await this.pool.query<{
      capability_code: string;
      capacity_units: number | null;
      metadata: unknown;
    }>(
      `SELECT capability_code, capacity_units, metadata
         FROM scheduler_resource_capabilities
        WHERE business_slug = $1 AND resource_id = $2
        ORDER BY capability_code ASC`,
      [businessSlug, resourceId],
    );
    return {
      resourceId: row.resource_id,
      businessSlug: row.business_slug,
      code: row.resource_code,
      kind: row.resource_kind,
      name: row.resource_name,
      status: row.status,
      timeZone: row.time_zone,
      capacity: row.capacity,
      capabilities: capabilities.rows.map((entry): ResourceCapability => ({
        code: entry.capability_code,
        ...(entry.capacity_units === null ? {} : { capacityUnits: entry.capacity_units }),
        ...(Object.keys(asRecord(entry.metadata)).length === 0 ? {} : { metadata: asRecord(entry.metadata) }),
      })),
      revision: row.revision,
    };
  }

  async insertScheduleTemplate(value: ScheduleTemplate): Promise<void> {
    assertValid('SCHEDULER_SCHEDULE', validateScheduleTemplate(value));
    await transaction(this.pool, async (client) => {
      await client.query(
        `INSERT INTO scheduler_schedule_templates (
           schedule_id, business_slug, resource_id, time_zone, revision
         ) VALUES ($1,$2,$3,$4,$5)`,
        [value.scheduleId, value.businessSlug, value.resourceId, value.timeZone, value.revision],
      );
      for (let index = 0; index < value.weeklyWindows.length; index += 1) {
        const window = value.weeklyWindows[index]!;
        await client.query(
          `INSERT INTO scheduler_schedule_windows (
             business_slug, schedule_id, window_index, weekday,
             start_local, end_local, capacity
           ) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
          [
            value.businessSlug,
            value.scheduleId,
            index,
            window.weekday,
            window.startLocal,
            window.endLocal,
            window.capacity ?? null,
          ],
        );
      }
    });
  }

  async getScheduleTemplate(businessSlug: string, scheduleId: string): Promise<ScheduleTemplate | undefined> {
    const result = await this.pool.query<{
      schedule_id: string;
      business_slug: string;
      resource_id: string;
      time_zone: string;
      revision: number;
    }>(
      `SELECT schedule_id, business_slug, resource_id, time_zone, revision
         FROM scheduler_schedule_templates
        WHERE business_slug = $1 AND schedule_id = $2`,
      [businessSlug, scheduleId],
    );
    const row = result.rows[0];
    if (!row) return undefined;
    const windows = await this.pool.query<{
      weekday: number;
      start_local: string;
      end_local: string;
      capacity: number | null;
    }>(
      `SELECT weekday, start_local::text, end_local::text, capacity
         FROM scheduler_schedule_windows
        WHERE business_slug = $1 AND schedule_id = $2
        ORDER BY window_index ASC`,
      [businessSlug, scheduleId],
    );
    return {
      scheduleId: row.schedule_id,
      businessSlug: row.business_slug,
      resourceId: row.resource_id,
      timeZone: row.time_zone,
      weeklyWindows: windows.rows.map((entry): WeeklyAvailabilityWindow => ({
        weekday: entry.weekday,
        startLocal: entry.start_local.slice(0, 5),
        endLocal: entry.end_local.slice(0, 5),
        ...(entry.capacity === null ? {} : { capacity: entry.capacity }),
      })),
      revision: row.revision,
    };
  }

  async insertScheduleOverride(value: ScheduleOverride): Promise<void> {
    assertValid('SCHEDULER_OVERRIDE', validateScheduleOverride(value));
    await this.pool.query(
      `INSERT INTO scheduler_schedule_overrides (
         override_id, business_slug, resource_id, start_at, end_at,
         override_kind, capacity, reason_code, revision
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [
        value.overrideId,
        value.businessSlug,
        value.resourceId,
        value.startAt,
        value.endAt,
        value.kind,
        value.capacity ?? null,
        value.reasonCode ?? null,
        value.revision,
      ],
    );
  }

  async getScheduleOverride(businessSlug: string, overrideId: string): Promise<ScheduleOverride | undefined> {
    const result = await this.pool.query<{
      override_id: string;
      business_slug: string;
      resource_id: string;
      start_at: Date | string;
      end_at: Date | string;
      override_kind: ScheduleOverride['kind'];
      capacity: number | null;
      reason_code: string | null;
      revision: number;
    }>(
      `SELECT override_id, business_slug, resource_id, start_at, end_at,
              override_kind, capacity, reason_code, revision
         FROM scheduler_schedule_overrides
        WHERE business_slug = $1 AND override_id = $2`,
      [businessSlug, overrideId],
    );
    const row = result.rows[0];
    if (!row) return undefined;
    return {
      overrideId: row.override_id,
      businessSlug: row.business_slug,
      resourceId: row.resource_id,
      startAt: asIso(row.start_at),
      endAt: asIso(row.end_at),
      kind: row.override_kind,
      ...(row.capacity === null ? {} : { capacity: row.capacity }),
      ...(row.reason_code === null ? {} : { reasonCode: row.reason_code }),
      revision: row.revision,
    };
  }

  async insertDemand(value: SchedulingDemand): Promise<string> {
    assertValid('SCHEDULER_DEMAND', validateSchedulingDemand(value));
    const snapshotHash = sha256(stableJson(value));
    await this.pool.query(
      `INSERT INTO scheduler_demands (
         demand_id, schema_version, business_slug,
         service_id, service_revision, offering_id, offering_revision,
         duration_minutes, capacity_units, required_capabilities,
         buffer_before_minutes, buffer_after_minutes, snapshot_hash
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11,$12,$13)`,
      [
        value.demandId,
        value.schemaVersion,
        value.businessSlug,
        value.service.serviceId,
        value.service.revision,
        value.offering.offeringId,
        value.offering.revision,
        value.offering.durationMinutes,
        value.capacityUnits,
        JSON.stringify(value.requiredCapabilities),
        value.buffers.beforeMinutes,
        value.buffers.afterMinutes,
        snapshotHash,
      ],
    );
    return snapshotHash;
  }

  async getDemand(businessSlug: string, demandId: string): Promise<SchedulingDemand | undefined> {
    const result = await this.pool.query<{
      demand_id: string;
      schema_version: 1;
      business_slug: string;
      service_id: string;
      service_revision: number;
      offering_id: string;
      offering_revision: number;
      duration_minutes: number;
      capacity_units: number;
      required_capabilities: unknown;
      buffer_before_minutes: number;
      buffer_after_minutes: number;
    }>(
      `SELECT demand_id, schema_version, business_slug,
              service_id, service_revision, offering_id, offering_revision,
              duration_minutes, capacity_units, required_capabilities,
              buffer_before_minutes, buffer_after_minutes
         FROM scheduler_demands
        WHERE business_slug = $1 AND demand_id = $2`,
      [businessSlug, demandId],
    );
    const row = result.rows[0];
    if (!row) return undefined;
    return {
      schemaVersion: row.schema_version,
      businessSlug: row.business_slug,
      demandId: row.demand_id,
      service: { serviceId: row.service_id, revision: row.service_revision },
      offering: {
        offeringId: row.offering_id,
        revision: row.offering_revision,
        durationMinutes: row.duration_minutes,
      },
      capacityUnits: row.capacity_units,
      requiredCapabilities: asCapabilityDemand(row.required_capabilities),
      buffers: {
        beforeMinutes: row.buffer_before_minutes,
        afterMinutes: row.buffer_after_minutes,
      },
    };
  }

  async insertHold(value: SchedulerHold): Promise<void> {
    assertValid('SCHEDULER_HOLD', validateSchedulerHold(value));
    await transaction(this.pool, async (client) => {
      await client.query(
        `INSERT INTO scheduler_holds (
           hold_id, business_slug, demand_id, start_at, end_at, expires_at, status
         ) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [value.holdId, value.businessSlug, value.demandId, value.startAt, value.endAt, value.expiresAt, value.status],
      );
      for (const assignment of value.assignments) {
        await client.query(
          `INSERT INTO scheduler_hold_assignments (
             business_slug, hold_id, resource_id, capacity_units
           ) VALUES ($1,$2,$3,$4)`,
          [value.businessSlug, value.holdId, assignment.resourceId, assignment.capacityUnits],
        );
      }
    });
  }

  async insertReservation(value: SchedulerReservation): Promise<void> {
    assertValid('SCHEDULER_RESERVATION', validateSchedulerReservation(value));
    await transaction(this.pool, async (client) => {
      await client.query(
        `INSERT INTO scheduler_reservations (
           reservation_id, business_slug, demand_id, start_at, end_at,
           time_zone, status, revision, created_at, updated_at
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [
          value.reservationId,
          value.businessSlug,
          value.demandId,
          value.startAt,
          value.endAt,
          value.timeZone,
          value.status,
          value.revision,
          value.createdAt,
          value.updatedAt,
        ],
      );
      for (const assignment of value.assignments) {
        await client.query(
          `INSERT INTO scheduler_reservation_assignments (
             business_slug, reservation_id, resource_id, capacity_units
           ) VALUES ($1,$2,$3,$4)`,
          [value.businessSlug, value.reservationId, assignment.resourceId, assignment.capacityUnits],
        );
      }
    });
  }

  async insertCommandIdentity(value: SchedulerCommandIdentity): Promise<string> {
    const materialHash = sha256(stableJson(value.material));
    await this.pool.query(
      `INSERT INTO scheduler_commands (
         command_id, business_slug, operation_id, command_type,
         material_hash, command_material, result_type, result_id
       ) VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7,$8)`,
      [
        value.commandId,
        value.businessSlug,
        value.operationId,
        value.commandType,
        materialHash,
        JSON.stringify(value.material),
        value.resultType ?? null,
        value.resultId ?? null,
      ],
    );
    return materialHash;
  }

  async tableCounts(businessSlug: string): Promise<Readonly<{
    resources: number;
    demands: number;
    holds: number;
    reservations: number;
    commands: number;
  }>> {
    const result = await this.pool.query<{
      resources: string;
      demands: string;
      holds: string;
      reservations: string;
      commands: string;
    }>(
      `SELECT
         (SELECT COUNT(*)::text FROM scheduler_resources WHERE business_slug = $1) AS resources,
         (SELECT COUNT(*)::text FROM scheduler_demands WHERE business_slug = $1) AS demands,
         (SELECT COUNT(*)::text FROM scheduler_holds WHERE business_slug = $1) AS holds,
         (SELECT COUNT(*)::text FROM scheduler_reservations WHERE business_slug = $1) AS reservations,
         (SELECT COUNT(*)::text FROM scheduler_commands WHERE business_slug = $1) AS commands`,
      [businessSlug],
    );
    const row = result.rows[0];
    if (!row) return { resources: 0, demands: 0, holds: 0, reservations: 0, commands: 0 };
    return {
      resources: Number(row.resources),
      demands: Number(row.demands),
      holds: Number(row.holds),
      reservations: Number(row.reservations),
      commands: Number(row.commands),
    };
  }
}

let defaultPool: Pool | undefined;
let defaultRepository: PostgresSchedulerFoundationRepository | undefined;

export function schedulerFoundationRepository(): PostgresSchedulerFoundationRepository {
  defaultPool ??= new Pool({ connectionString: loadRuntimeConfig().postgresUrl, max: 8 });
  defaultRepository ??= new PostgresSchedulerFoundationRepository(defaultPool);
  return defaultRepository;
}
