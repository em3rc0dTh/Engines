import { createHash } from 'node:crypto';
import { Pool, type PoolClient } from 'pg';
import {
  validateIntegrationCommand,
  type IntegrationCommand,
  type IntegrationErrorCode,
} from '../../contracts/integration-engine/index.js';
import type {
  IntegrationDeliveryClaim,
  IntegrationDeliveryOutcome,
  IntegrationOutboundAttemptRecord,
  IntegrationOutboundCommandRecord,
  IntegrationOutboundStatus,
} from '../../integration/outbound.js';

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function stableJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${stableJson(record[key])}`).join(',')}}`;
}

function commandMaterial(command: IntegrationCommand): string {
  return stableJson({
    schemaVersion: command.schemaVersion,
    connectionRef: command.connectionRef,
    capability: command.capability,
    action: command.action,
    ...(command.subjectRef === undefined ? {} : { subjectRef: command.subjectRef }),
    ...(command.targetRef === undefined ? {} : { targetRef: command.targetRef }),
    payload: command.payload,
  });
}

function iso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function optionalIso(value: Date | string | null): string | undefined {
  return value === null ? undefined : iso(value);
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

export class IntegrationOutboundLedgerError extends Error {
  constructor(readonly code: string, message: string = code) {
    super(message);
    this.name = 'IntegrationOutboundLedgerError';
  }
}

type CommandRow = {
  business_slug: string;
  operation_id: string;
  command_json: IntegrationCommand;
  material_hash: string;
  status: IntegrationOutboundStatus;
  attempt_count: number;
  max_attempts: number;
  next_attempt_at: Date | string | null;
  lease_expires_at: Date | string | null;
  current_attempt_id: string | null;
  last_error_code: IntegrationErrorCode | null;
  provider_receipt_ref: string | null;
  created_at: Date | string;
  updated_at: Date | string;
};

function rowToRecord(row: CommandRow): IntegrationOutboundCommandRecord {
  return {
    command: validateIntegrationCommand(row.command_json),
    status: row.status,
    attemptCount: row.attempt_count,
    maxAttempts: row.max_attempts,
    ...(optionalIso(row.next_attempt_at) === undefined ? {} : { nextAttemptAt: optionalIso(row.next_attempt_at)! }),
    ...(optionalIso(row.lease_expires_at) === undefined ? {} : { leaseExpiresAt: optionalIso(row.lease_expires_at)! }),
    ...(row.current_attempt_id === null ? {} : { currentAttemptId: row.current_attempt_id }),
    ...(row.last_error_code === null ? {} : { lastErrorCode: row.last_error_code }),
    ...(row.provider_receipt_ref === null ? {} : { providerReceiptRef: row.provider_receipt_ref }),
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
  };
}

export class PostgresIntegrationOutboundLedger {
  constructor(private readonly pool: Pool) {}

  async enqueue(commandInput: IntegrationCommand, maxAttempts = 3): Promise<IntegrationOutboundCommandRecord> {
    const command = validateIntegrationCommand(commandInput);
    if (!Number.isInteger(maxAttempts) || maxAttempts < 1 || maxAttempts > 20) {
      throw new IntegrationOutboundLedgerError('INVALID_MAX_ATTEMPTS');
    }
    const materialHash = sha256(commandMaterial(command));

    return transaction(this.pool, async (client) => {
      const connection = await client.query<{ status: string; capabilities: string[] }>(
        `SELECT status, capabilities
           FROM integration_connections
          WHERE business_slug = $1 AND connection_ref = $2
          FOR SHARE`,
        [command.businessSlug, command.connectionRef],
      );
      const configured = connection.rows[0];
      if (!configured) throw new IntegrationOutboundLedgerError('CONNECTION_NOT_FOUND');
      if (configured.status !== 'ENABLED') throw new IntegrationOutboundLedgerError('CONNECTION_DISABLED');
      if (!configured.capabilities.includes(command.capability)) {
        throw new IntegrationOutboundLedgerError('CAPABILITY_NOT_SUPPORTED');
      }

      const inserted = await client.query(
        `INSERT INTO integration_outbound_commands (
           business_slug, operation_id, command_id, connection_ref, capability, action,
           command_json, material_hash, status, attempt_count, max_attempts,
           created_at, updated_at
         ) VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8,'READY',0,$9,NOW(),NOW())
         ON CONFLICT (business_slug, operation_id) DO NOTHING`,
        [
          command.businessSlug,
          command.operationId,
          command.commandId,
          command.connectionRef,
          command.capability,
          command.action,
          JSON.stringify(command),
          materialHash,
          maxAttempts,
        ],
      );

      if (inserted.rowCount === 0) {
        const existing = await this.getWithClient(client, command.businessSlug, command.operationId, true);
        if (!existing) throw new IntegrationOutboundLedgerError('OUTBOUND_COMMAND_NOT_FOUND');
        const existingHash = await client.query<{ material_hash: string }>(
          `SELECT material_hash FROM integration_outbound_commands
            WHERE business_slug = $1 AND operation_id = $2`,
          [command.businessSlug, command.operationId],
        );
        if (existingHash.rows[0]?.material_hash !== materialHash) {
          throw new IntegrationOutboundLedgerError('IDEMPOTENCY_CONFLICT');
        }
        return existing;
      }

      const stored = await this.getWithClient(client, command.businessSlug, command.operationId, true);
      if (!stored) throw new IntegrationOutboundLedgerError('OUTBOUND_COMMAND_NOT_FOUND');
      return stored;
    });
  }

  async get(businessSlug: string, operationId: string): Promise<IntegrationOutboundCommandRecord | undefined> {
    const client = await this.pool.connect();
    try {
      return await this.getWithClient(client, businessSlug, operationId, false);
    } finally {
      client.release();
    }
  }

  async claim(
    businessSlug: string,
    operationId: string,
    now: string,
    leaseSeconds = 30,
  ): Promise<IntegrationDeliveryClaim | undefined> {
    if (!Number.isFinite(Date.parse(now))) throw new IntegrationOutboundLedgerError('INVALID_NOW');
    if (!Number.isInteger(leaseSeconds) || leaseSeconds < 1 || leaseSeconds > 3600) {
      throw new IntegrationOutboundLedgerError('INVALID_LEASE_SECONDS');
    }

    return transaction(this.pool, async (client) => {
      const result = await client.query<CommandRow>(
        `SELECT business_slug, operation_id, command_json, material_hash, status,
                attempt_count, max_attempts, next_attempt_at, lease_expires_at,
                current_attempt_id, last_error_code, provider_receipt_ref,
                created_at, updated_at
           FROM integration_outbound_commands
          WHERE business_slug = $1 AND operation_id = $2
          FOR UPDATE`,
        [businessSlug, operationId],
      );
      const row = result.rows[0];
      if (!row) throw new IntegrationOutboundLedgerError('OUTBOUND_COMMAND_NOT_FOUND');
      if (row.status === 'SUCCEEDED' || row.status === 'FAILED_PERMANENT') return undefined;

      const nowEpoch = Date.parse(now);
      if (row.status === 'RETRY_WAIT') {
        if (row.next_attempt_at === null || Date.parse(iso(row.next_attempt_at)) > nowEpoch) return undefined;
      }
      if (row.status === 'IN_FLIGHT') {
        if (row.lease_expires_at === null || Date.parse(iso(row.lease_expires_at)) > nowEpoch) return undefined;
        await client.query(
          `UPDATE integration_outbound_attempts
              SET finished_at = $4, outcome = 'LEASE_EXPIRED', error_code = 'TIMEOUT'
            WHERE business_slug = $1 AND operation_id = $2 AND attempt_number = $3
              AND finished_at IS NULL`,
          [businessSlug, operationId, row.attempt_count, now],
        );
      }

      if (row.attempt_count >= row.max_attempts) {
        await client.query(
          `UPDATE integration_outbound_commands
              SET status = 'FAILED_PERMANENT', last_error_code = COALESCE(last_error_code, 'TIMEOUT'),
                  next_attempt_at = NULL, lease_expires_at = NULL, current_attempt_id = NULL,
                  updated_at = $3
            WHERE business_slug = $1 AND operation_id = $2`,
          [businessSlug, operationId, now],
        );
        return undefined;
      }

      const attemptNumber = row.attempt_count + 1;
      const attemptId = `integration-attempt:${encodeURIComponent(businessSlug)}:${encodeURIComponent(operationId)}:${attemptNumber}`;
      const leaseExpiresAt = new Date(nowEpoch + leaseSeconds * 1000).toISOString();

      await client.query(
        `INSERT INTO integration_outbound_attempts (
           business_slug, operation_id, attempt_number, attempt_id, started_at
         ) VALUES ($1,$2,$3,$4,$5)`,
        [businessSlug, operationId, attemptNumber, attemptId, now],
      );
      await client.query(
        `UPDATE integration_outbound_commands
            SET status = 'IN_FLIGHT', attempt_count = $3, next_attempt_at = NULL,
                lease_expires_at = $4, current_attempt_id = $5, updated_at = $6
          WHERE business_slug = $1 AND operation_id = $2`,
        [businessSlug, operationId, attemptNumber, leaseExpiresAt, attemptId, now],
      );

      return {
        command: validateIntegrationCommand(row.command_json),
        attemptId,
        attemptNumber,
        leaseExpiresAt,
      };
    });
  }

  async complete(
    claim: IntegrationDeliveryClaim,
    outcome: IntegrationDeliveryOutcome,
    finishedAt: string,
  ): Promise<IntegrationOutboundCommandRecord> {
    if (!Number.isFinite(Date.parse(finishedAt))) throw new IntegrationOutboundLedgerError('INVALID_FINISHED_AT');
    const command = claim.command;

    return transaction(this.pool, async (client) => {
      const result = await client.query<CommandRow>(
        `SELECT business_slug, operation_id, command_json, material_hash, status,
                attempt_count, max_attempts, next_attempt_at, lease_expires_at,
                current_attempt_id, last_error_code, provider_receipt_ref,
                created_at, updated_at
           FROM integration_outbound_commands
          WHERE business_slug = $1 AND operation_id = $2
          FOR UPDATE`,
        [command.businessSlug, command.operationId],
      );
      const row = result.rows[0];
      if (!row) throw new IntegrationOutboundLedgerError('OUTBOUND_COMMAND_NOT_FOUND');
      if (row.status !== 'IN_FLIGHT' || row.current_attempt_id !== claim.attemptId || row.attempt_count !== claim.attemptNumber) {
        throw new IntegrationOutboundLedgerError('STALE_DELIVERY_ATTEMPT');
      }

      if (outcome.kind === 'SUCCEEDED') {
        await client.query(
          `UPDATE integration_outbound_attempts
              SET finished_at = $4, outcome = 'SUCCEEDED', provider_receipt_ref = $5
            WHERE business_slug = $1 AND operation_id = $2 AND attempt_number = $3`,
          [command.businessSlug, command.operationId, claim.attemptNumber, finishedAt, outcome.providerReceiptRef ?? null],
        );
        await client.query(
          `UPDATE integration_outbound_commands
              SET status = 'SUCCEEDED', next_attempt_at = NULL, lease_expires_at = NULL,
                  current_attempt_id = NULL, last_error_code = NULL,
                  provider_receipt_ref = $3, updated_at = $4
            WHERE business_slug = $1 AND operation_id = $2`,
          [command.businessSlug, command.operationId, outcome.providerReceiptRef ?? null, finishedAt],
        );
      } else if (outcome.kind === 'FAILED_PERMANENT' || row.attempt_count >= row.max_attempts) {
        const errorCode = outcome.kind === 'FAILED_PERMANENT' ? outcome.errorCode : outcome.errorCode;
        await client.query(
          `UPDATE integration_outbound_attempts
              SET finished_at = $4, outcome = 'FAILED_PERMANENT', error_code = $5
            WHERE business_slug = $1 AND operation_id = $2 AND attempt_number = $3`,
          [command.businessSlug, command.operationId, claim.attemptNumber, finishedAt, errorCode],
        );
        await client.query(
          `UPDATE integration_outbound_commands
              SET status = 'FAILED_PERMANENT', next_attempt_at = NULL, lease_expires_at = NULL,
                  current_attempt_id = NULL, last_error_code = $3, updated_at = $4
            WHERE business_slug = $1 AND operation_id = $2`,
          [command.businessSlug, command.operationId, errorCode, finishedAt],
        );
      } else {
        if (Date.parse(outcome.nextAttemptAt) <= Date.parse(finishedAt)) {
          throw new IntegrationOutboundLedgerError('INVALID_NEXT_ATTEMPT_AT');
        }
        await client.query(
          `UPDATE integration_outbound_attempts
              SET finished_at = $4, outcome = 'RETRYABLE', error_code = $5, next_attempt_at = $6
            WHERE business_slug = $1 AND operation_id = $2 AND attempt_number = $3`,
          [command.businessSlug, command.operationId, claim.attemptNumber, finishedAt, outcome.errorCode, outcome.nextAttemptAt],
        );
        await client.query(
          `UPDATE integration_outbound_commands
              SET status = 'RETRY_WAIT', next_attempt_at = $3, lease_expires_at = NULL,
                  current_attempt_id = NULL, last_error_code = $4, updated_at = $5
            WHERE business_slug = $1 AND operation_id = $2`,
          [command.businessSlug, command.operationId, outcome.nextAttemptAt, outcome.errorCode, finishedAt],
        );
      }

      const stored = await this.getWithClient(client, command.businessSlug, command.operationId, true);
      if (!stored) throw new IntegrationOutboundLedgerError('OUTBOUND_COMMAND_NOT_FOUND');
      return stored;
    });
  }

  async listAttempts(businessSlug: string, operationId: string): Promise<readonly IntegrationOutboundAttemptRecord[]> {
    const result = await this.pool.query<{
      business_slug: string;
      operation_id: string;
      attempt_number: number;
      attempt_id: string;
      started_at: Date | string;
      finished_at: Date | string | null;
      outcome: IntegrationOutboundAttemptRecord['outcome'] | null;
      error_code: IntegrationErrorCode | null;
      provider_receipt_ref: string | null;
      next_attempt_at: Date | string | null;
    }>(
      `SELECT business_slug, operation_id, attempt_number, attempt_id, started_at,
              finished_at, outcome, error_code, provider_receipt_ref, next_attempt_at
         FROM integration_outbound_attempts
        WHERE business_slug = $1 AND operation_id = $2
        ORDER BY attempt_number ASC`,
      [businessSlug, operationId],
    );

    return result.rows.map((row): IntegrationOutboundAttemptRecord => ({
      businessSlug: row.business_slug,
      operationId: row.operation_id,
      attemptNumber: row.attempt_number,
      attemptId: row.attempt_id,
      startedAt: iso(row.started_at),
      ...(optionalIso(row.finished_at) === undefined ? {} : { finishedAt: optionalIso(row.finished_at)! }),
      ...(row.outcome === null ? {} : { outcome: row.outcome }),
      ...(row.error_code === null ? {} : { errorCode: row.error_code }),
      ...(row.provider_receipt_ref === null ? {} : { providerReceiptRef: row.provider_receipt_ref }),
      ...(optionalIso(row.next_attempt_at) === undefined ? {} : { nextAttemptAt: optionalIso(row.next_attempt_at)! }),
    }));
  }

  private async getWithClient(
    client: PoolClient,
    businessSlug: string,
    operationId: string,
    forUpdate: boolean,
  ): Promise<IntegrationOutboundCommandRecord | undefined> {
    const result = await client.query<CommandRow>(
      `SELECT business_slug, operation_id, command_json, material_hash, status,
              attempt_count, max_attempts, next_attempt_at, lease_expires_at,
              current_attempt_id, last_error_code, provider_receipt_ref,
              created_at, updated_at
         FROM integration_outbound_commands
        WHERE business_slug = $1 AND operation_id = $2${forUpdate ? ' FOR UPDATE' : ''}`,
      [businessSlug, operationId],
    );
    const row = result.rows[0];
    return row === undefined ? undefined : rowToRecord(row);
  }
}
