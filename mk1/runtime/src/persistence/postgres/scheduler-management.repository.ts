import { createHash } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
import type {
  CreateResourceCommand,
  DeleteScheduleOverrideCommand,
  PutScheduleOverrideCommand,
  ResourceCapability,
  ScheduleOverride,
  ScheduleTemplate,
  SchedulerManagementCommandResult,
  SchedulerManagementCommandType,
  SchedulerManagementFailureCode,
  SchedulerManagementResultType,
  SchedulerResource,
  SetResourceStatusCommand,
  SetScheduleTemplateCommand,
  UpdateResourceCommand,
  WeeklyAvailabilityWindow,
} from '../../contracts/scheduler-engine/index.js';
import {
  validateScheduleOverride,
  validateScheduleTemplate,
  validateSchedulerResource,
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

function assertValid(kind: string, issues: readonly { code: string; path: string }[]): void {
  if (issues.length === 0) return;
  throw new Error(`${kind}_VALIDATION_FAILED:${issues.map((entry) => `${entry.code}@${entry.path}`).join(',')}`);
}

export class SchedulerManagementError extends Error {
  readonly code: SchedulerManagementFailureCode;

  constructor(code: SchedulerManagementFailureCode, message: string) {
    super(message);
    this.name = 'SchedulerManagementError';
    this.code = code;
  }
}

type CommandEnvelope = Readonly<{
  businessSlug: string;
  operationId: string;
  commandType: SchedulerManagementCommandType;
  material: Readonly<Record<string, unknown>>;
  resultType: SchedulerManagementResultType;
  resultId: string;
}>;

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

export class PostgresSchedulerManagementRepository {
  constructor(private readonly pool: Pool) {}

  private async withCommand(
    envelope: CommandEnvelope,
    mutate: (client: PoolClient) => Promise<void>,
  ): Promise<SchedulerManagementCommandResult> {
    const materialHash = sha256(stableJson(envelope.material));
    return transaction(this.pool, async (client) => {
      await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [
        `${envelope.businessSlug}:${envelope.operationId}`,
      ]);

      const existing = await client.query<{
        command_type: string;
        material_hash: string;
        result_type: SchedulerManagementResultType | null;
        result_id: string | null;
      }>(
        `SELECT command_type, material_hash, result_type, result_id
           FROM scheduler_commands
          WHERE business_slug = $1 AND operation_id = $2
          FOR UPDATE`,
        [envelope.businessSlug, envelope.operationId],
      );
      const previous = existing.rows[0];
      if (previous) {
        if (previous.command_type !== envelope.commandType || previous.material_hash !== materialHash) {
          throw new SchedulerManagementError(
            'IDEMPOTENCY_MATERIAL_CONFLICT',
            `operation ${envelope.operationId} was already used with different material`,
          );
        }
        if (previous.result_type !== envelope.resultType || previous.result_id !== envelope.resultId) {
          throw new SchedulerManagementError(
            'IDEMPOTENCY_MATERIAL_CONFLICT',
            `operation ${envelope.operationId} has a different persisted result identity`,
          );
        }
        return {
          businessSlug: envelope.businessSlug,
          operationId: envelope.operationId,
          commandType: envelope.commandType,
          resultType: envelope.resultType,
          resultId: envelope.resultId,
          replayed: true,
        };
      }

      await mutate(client);
      const commandId = `schedcmd_${sha256(`${envelope.businessSlug}:${envelope.operationId}`).slice(0, 32)}`;
      await client.query(
        `INSERT INTO scheduler_commands (
           command_id, business_slug, operation_id, command_type,
           material_hash, command_material, result_type, result_id
         ) VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7,$8)`,
        [
          commandId,
          envelope.businessSlug,
          envelope.operationId,
          envelope.commandType,
          materialHash,
          JSON.stringify(envelope.material),
          envelope.resultType,
          envelope.resultId,
        ],
      );
      return {
        businessSlug: envelope.businessSlug,
        operationId: envelope.operationId,
        commandType: envelope.commandType,
        resultType: envelope.resultType,
        resultId: envelope.resultId,
        replayed: false,
      };
    });
  }

  private async insertCapabilities(
    client: PoolClient,
    businessSlug: string,
    resourceId: string,
    capabilities: readonly ResourceCapability[],
  ): Promise<void> {
    for (const capability of capabilities) {
      await client.query(
        `INSERT INTO scheduler_resource_capabilities (
           business_slug, resource_id, capability_code, capacity_units, metadata
         ) VALUES ($1,$2,$3,$4,$5::jsonb)`,
        [
          businessSlug,
          resourceId,
          capability.code,
          capability.capacityUnits ?? null,
          JSON.stringify(capability.metadata ?? {}),
        ],
      );
    }
  }

  private async insertWindows(client: PoolClient, schedule: ScheduleTemplate): Promise<void> {
    for (let index = 0; index < schedule.weeklyWindows.length; index += 1) {
      const window = schedule.weeklyWindows[index]!;
      await client.query(
        `INSERT INTO scheduler_schedule_windows (
           business_slug, schedule_id, window_index, weekday,
           start_local, end_local, capacity
         ) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [
          schedule.businessSlug,
          schedule.scheduleId,
          index,
          window.weekday,
          window.startLocal,
          window.endLocal,
          window.capacity ?? null,
        ],
      );
    }
  }

  async createResource(command: CreateResourceCommand): Promise<SchedulerManagementCommandResult> {
    if (command.resource.businessSlug !== command.businessSlug) {
      throw new Error('SCHEDULER_RESOURCE_VALIDATION_FAILED:INVALID_BUSINESS_SCOPE@resource.businessSlug');
    }
    if (command.resource.revision !== 1) {
      throw new Error('SCHEDULER_RESOURCE_VALIDATION_FAILED:INVALID_REVISION@resource.revision');
    }
    assertValid('SCHEDULER_RESOURCE', validateSchedulerResource(command.resource));

    return this.withCommand({
      businessSlug: command.businessSlug,
      operationId: command.operationId,
      commandType: 'CreateResource',
      material: { resource: command.resource },
      resultType: 'RESOURCE',
      resultId: command.resource.resourceId,
    }, async (client) => {
      const existing = await client.query(
        `SELECT 1 FROM scheduler_resources
          WHERE business_slug = $1 AND resource_id = $2`,
        [command.businessSlug, command.resource.resourceId],
      );
      if (existing.rowCount) {
        throw new SchedulerManagementError('RESOURCE_ALREADY_EXISTS', `resource ${command.resource.resourceId} already exists`);
      }
      await client.query(
        `INSERT INTO scheduler_resources (
           resource_id, business_slug, resource_code, resource_kind, resource_name,
           status, time_zone, capacity, revision
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [
          command.resource.resourceId,
          command.businessSlug,
          command.resource.code,
          command.resource.kind,
          command.resource.name,
          command.resource.status,
          command.resource.timeZone,
          command.resource.capacity,
          command.resource.revision,
        ],
      );
      await this.insertCapabilities(client, command.businessSlug, command.resource.resourceId, command.resource.capabilities);
    });
  }

  async updateResource(command: UpdateResourceCommand): Promise<SchedulerManagementCommandResult> {
    if (command.resource.businessSlug !== command.businessSlug) {
      throw new Error('SCHEDULER_RESOURCE_VALIDATION_FAILED:INVALID_BUSINESS_SCOPE@resource.businessSlug');
    }
    if (command.resource.revision !== command.expectedRevision + 1) {
      throw new Error('SCHEDULER_RESOURCE_VALIDATION_FAILED:INVALID_REVISION@resource.revision');
    }
    assertValid('SCHEDULER_RESOURCE', validateSchedulerResource(command.resource));

    return this.withCommand({
      businessSlug: command.businessSlug,
      operationId: command.operationId,
      commandType: 'UpdateResource',
      material: { expectedRevision: command.expectedRevision, resource: command.resource },
      resultType: 'RESOURCE',
      resultId: command.resource.resourceId,
    }, async (client) => {
      const current = await client.query<{ revision: number }>(
        `SELECT revision FROM scheduler_resources
          WHERE business_slug = $1 AND resource_id = $2
          FOR UPDATE`,
        [command.businessSlug, command.resource.resourceId],
      );
      const row = current.rows[0];
      if (!row) throw new SchedulerManagementError('RESOURCE_NOT_FOUND', `resource ${command.resource.resourceId} not found`);
      if (row.revision !== command.expectedRevision) {
        throw new SchedulerManagementError(
          'RESOURCE_REVISION_CONFLICT',
          `resource ${command.resource.resourceId} revision ${row.revision} != expected ${command.expectedRevision}`,
        );
      }
      await client.query(
        `UPDATE scheduler_resources
            SET resource_code = $3,
                resource_kind = $4,
                resource_name = $5,
                status = $6,
                time_zone = $7,
                capacity = $8,
                revision = $9,
                updated_at = NOW()
          WHERE business_slug = $1 AND resource_id = $2`,
        [
          command.businessSlug,
          command.resource.resourceId,
          command.resource.code,
          command.resource.kind,
          command.resource.name,
          command.resource.status,
          command.resource.timeZone,
          command.resource.capacity,
          command.resource.revision,
        ],
      );
      await client.query(
        `DELETE FROM scheduler_resource_capabilities
          WHERE business_slug = $1 AND resource_id = $2`,
        [command.businessSlug, command.resource.resourceId],
      );
      await this.insertCapabilities(client, command.businessSlug, command.resource.resourceId, command.resource.capabilities);
    });
  }

  async setResourceStatus(command: SetResourceStatusCommand): Promise<SchedulerManagementCommandResult> {
    return this.withCommand({
      businessSlug: command.businessSlug,
      operationId: command.operationId,
      commandType: 'SetResourceStatus',
      material: {
        resourceId: command.resourceId,
        expectedRevision: command.expectedRevision,
        status: command.status,
      },
      resultType: 'RESOURCE',
      resultId: command.resourceId,
    }, async (client) => {
      const current = await client.query<{ revision: number }>(
        `SELECT revision FROM scheduler_resources
          WHERE business_slug = $1 AND resource_id = $2
          FOR UPDATE`,
        [command.businessSlug, command.resourceId],
      );
      const row = current.rows[0];
      if (!row) throw new SchedulerManagementError('RESOURCE_NOT_FOUND', `resource ${command.resourceId} not found`);
      if (row.revision !== command.expectedRevision) {
        throw new SchedulerManagementError(
          'RESOURCE_REVISION_CONFLICT',
          `resource ${command.resourceId} revision ${row.revision} != expected ${command.expectedRevision}`,
        );
      }
      await client.query(
        `UPDATE scheduler_resources
            SET status = $3, revision = revision + 1, updated_at = NOW()
          WHERE business_slug = $1 AND resource_id = $2`,
        [command.businessSlug, command.resourceId, command.status],
      );
    });
  }

  async setScheduleTemplate(command: SetScheduleTemplateCommand): Promise<SchedulerManagementCommandResult> {
    if (command.schedule.businessSlug !== command.businessSlug) {
      throw new Error('SCHEDULER_SCHEDULE_VALIDATION_FAILED:INVALID_BUSINESS_SCOPE@schedule.businessSlug');
    }
    if (command.schedule.revision !== command.expectedRevision + 1) {
      throw new Error('SCHEDULER_SCHEDULE_VALIDATION_FAILED:INVALID_REVISION@schedule.revision');
    }
    assertValid('SCHEDULER_SCHEDULE', validateScheduleTemplate(command.schedule));

    return this.withCommand({
      businessSlug: command.businessSlug,
      operationId: command.operationId,
      commandType: 'SetScheduleTemplate',
      material: { expectedRevision: command.expectedRevision, schedule: command.schedule },
      resultType: 'SCHEDULE',
      resultId: command.schedule.scheduleId,
    }, async (client) => {
      const current = await client.query<{ resource_id: string; revision: number }>(
        `SELECT resource_id, revision FROM scheduler_schedule_templates
          WHERE business_slug = $1 AND schedule_id = $2
          FOR UPDATE`,
        [command.businessSlug, command.schedule.scheduleId],
      );
      const row = current.rows[0];
      if (!row) {
        if (command.expectedRevision !== 0) {
          throw new SchedulerManagementError('SCHEDULE_NOT_FOUND', `schedule ${command.schedule.scheduleId} not found`);
        }
        await client.query(
          `INSERT INTO scheduler_schedule_templates (
             schedule_id, business_slug, resource_id, time_zone, revision
           ) VALUES ($1,$2,$3,$4,$5)`,
          [
            command.schedule.scheduleId,
            command.businessSlug,
            command.schedule.resourceId,
            command.schedule.timeZone,
            command.schedule.revision,
          ],
        );
      } else {
        if (row.revision !== command.expectedRevision) {
          throw new SchedulerManagementError(
            'SCHEDULE_REVISION_CONFLICT',
            `schedule ${command.schedule.scheduleId} revision ${row.revision} != expected ${command.expectedRevision}`,
          );
        }
        if (row.resource_id !== command.schedule.resourceId) {
          throw new SchedulerManagementError(
            'SCHEDULE_RESOURCE_IMMUTABLE',
            `schedule ${command.schedule.scheduleId} cannot move between resources`,
          );
        }
        await client.query(
          `UPDATE scheduler_schedule_templates
              SET time_zone = $3, revision = $4, updated_at = NOW()
            WHERE business_slug = $1 AND schedule_id = $2`,
          [command.businessSlug, command.schedule.scheduleId, command.schedule.timeZone, command.schedule.revision],
        );
        await client.query(
          `DELETE FROM scheduler_schedule_windows
            WHERE business_slug = $1 AND schedule_id = $2`,
          [command.businessSlug, command.schedule.scheduleId],
        );
      }
      await this.insertWindows(client, command.schedule);
    });
  }

  async putScheduleOverride(command: PutScheduleOverrideCommand): Promise<SchedulerManagementCommandResult> {
    if (command.override.businessSlug !== command.businessSlug) {
      throw new Error('SCHEDULER_OVERRIDE_VALIDATION_FAILED:INVALID_BUSINESS_SCOPE@override.businessSlug');
    }
    if (command.override.revision !== command.expectedRevision + 1) {
      throw new Error('SCHEDULER_OVERRIDE_VALIDATION_FAILED:INVALID_REVISION@override.revision');
    }
    assertValid('SCHEDULER_OVERRIDE', validateScheduleOverride(command.override));

    return this.withCommand({
      businessSlug: command.businessSlug,
      operationId: command.operationId,
      commandType: 'PutScheduleOverride',
      material: { expectedRevision: command.expectedRevision, override: command.override },
      resultType: 'OVERRIDE',
      resultId: command.override.overrideId,
    }, async (client) => {
      const current = await client.query<{ resource_id: string; revision: number }>(
        `SELECT resource_id, revision FROM scheduler_schedule_overrides
          WHERE business_slug = $1 AND override_id = $2
          FOR UPDATE`,
        [command.businessSlug, command.override.overrideId],
      );
      const row = current.rows[0];
      if (!row) {
        if (command.expectedRevision !== 0) {
          throw new SchedulerManagementError('OVERRIDE_NOT_FOUND', `override ${command.override.overrideId} not found`);
        }
        await client.query(
          `INSERT INTO scheduler_schedule_overrides (
             override_id, business_slug, resource_id, start_at, end_at,
             override_kind, capacity, reason_code, revision
           ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
          [
            command.override.overrideId,
            command.businessSlug,
            command.override.resourceId,
            command.override.startAt,
            command.override.endAt,
            command.override.kind,
            command.override.capacity ?? null,
            command.override.reasonCode ?? null,
            command.override.revision,
          ],
        );
      } else {
        if (row.revision !== command.expectedRevision) {
          throw new SchedulerManagementError(
            'OVERRIDE_REVISION_CONFLICT',
            `override ${command.override.overrideId} revision ${row.revision} != expected ${command.expectedRevision}`,
          );
        }
        if (row.resource_id !== command.override.resourceId) {
          throw new SchedulerManagementError(
            'OVERRIDE_RESOURCE_IMMUTABLE',
            `override ${command.override.overrideId} cannot move between resources`,
          );
        }
        await client.query(
          `UPDATE scheduler_schedule_overrides
              SET start_at = $3,
                  end_at = $4,
                  override_kind = $5,
                  capacity = $6,
                  reason_code = $7,
                  revision = $8,
                  updated_at = NOW()
            WHERE business_slug = $1 AND override_id = $2`,
          [
            command.businessSlug,
            command.override.overrideId,
            command.override.startAt,
            command.override.endAt,
            command.override.kind,
            command.override.capacity ?? null,
            command.override.reasonCode ?? null,
            command.override.revision,
          ],
        );
      }
    });
  }

  async deleteScheduleOverride(command: DeleteScheduleOverrideCommand): Promise<SchedulerManagementCommandResult> {
    return this.withCommand({
      businessSlug: command.businessSlug,
      operationId: command.operationId,
      commandType: 'DeleteScheduleOverride',
      material: { overrideId: command.overrideId, expectedRevision: command.expectedRevision },
      resultType: 'OVERRIDE',
      resultId: command.overrideId,
    }, async (client) => {
      const current = await client.query<{ revision: number }>(
        `SELECT revision FROM scheduler_schedule_overrides
          WHERE business_slug = $1 AND override_id = $2
          FOR UPDATE`,
        [command.businessSlug, command.overrideId],
      );
      const row = current.rows[0];
      if (!row) throw new SchedulerManagementError('OVERRIDE_NOT_FOUND', `override ${command.overrideId} not found`);
      if (row.revision !== command.expectedRevision) {
        throw new SchedulerManagementError(
          'OVERRIDE_REVISION_CONFLICT',
          `override ${command.overrideId} revision ${row.revision} != expected ${command.expectedRevision}`,
        );
      }
      await client.query(
        `DELETE FROM scheduler_schedule_overrides
          WHERE business_slug = $1 AND override_id = $2`,
        [command.businessSlug, command.overrideId],
      );
    });
  }

  async readResource(businessSlug: string, resourceId: string): Promise<SchedulerResource | undefined> {
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

  async readScheduleTemplate(businessSlug: string, scheduleId: string): Promise<ScheduleTemplate | undefined> {
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

  async readScheduleOverride(businessSlug: string, overrideId: string): Promise<ScheduleOverride | undefined> {
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
    const asIso = (value: Date | string) => value instanceof Date ? value.toISOString() : new Date(value).toISOString();
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
}
