import { createHash } from 'node:crypto';
import { Pool, type PoolClient } from 'pg';
import {
  validateIntegrationEvent,
  type IntegrationEvent,
} from '../../contracts/integration-engine/index.js';
import type {
  IntegrationInboundAcceptance,
  IntegrationInboundEventLedger,
} from '../../integration/inbound.js';

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function stableJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${stableJson(record[key])}`).join(',')}}`;
}

function eventMaterial(event: IntegrationEvent): string {
  return stableJson({
    schemaVersion: event.schemaVersion,
    connectionRef: event.connectionRef,
    capability: event.capability,
    eventType: event.eventType,
    payload: event.payload,
    ...(event.occurredAt === undefined ? {} : { occurredAt: event.occurredAt }),
    ...(event.correlation === undefined ? {} : { correlation: event.correlation }),
  });
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

export class IntegrationInboundLedgerError extends Error {
  constructor(readonly code: string, message: string = code) {
    super(message);
    this.name = 'IntegrationInboundLedgerError';
  }
}

type EventRow = Readonly<{
  event_json: IntegrationEvent;
  material_hash: string;
}>;

export class PostgresIntegrationInboundLedger implements IntegrationInboundEventLedger {
  constructor(private readonly pool: Pool) {}

  async accept(eventInput: IntegrationEvent): Promise<IntegrationInboundAcceptance> {
    const event = validateIntegrationEvent(eventInput);
    const materialHash = sha256(eventMaterial(event));

    return transaction(this.pool, async (client) => {
      const connectionResult = await client.query<{ status: string; capabilities: string[] }>(
        `SELECT status, capabilities
           FROM integration_connections
          WHERE business_slug = $1 AND connection_ref = $2
          FOR SHARE`,
        [event.businessSlug, event.connectionRef],
      );
      const connection = connectionResult.rows[0];
      if (!connection) throw new IntegrationInboundLedgerError('CONNECTION_NOT_FOUND');
      if (connection.status !== 'ENABLED') throw new IntegrationInboundLedgerError('CONNECTION_DISABLED');
      if (!connection.capabilities.includes(event.capability)) {
        throw new IntegrationInboundLedgerError('CAPABILITY_NOT_SUPPORTED');
      }

      const inserted = await client.query(
        `INSERT INTO integration_inbound_events (
           business_slug, connection_ref, provider_event_identity, event_id,
           capability, event_type, event_json, material_hash, received_at
         ) VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9)
         ON CONFLICT (business_slug, connection_ref, provider_event_identity) DO NOTHING`,
        [
          event.businessSlug,
          event.connectionRef,
          event.providerEventIdentity,
          event.eventId,
          event.capability,
          event.eventType,
          JSON.stringify(event),
          materialHash,
          event.receivedAt,
        ],
      );

      if (inserted.rowCount === 0) {
        const existing = await this.getRowWithClient(
          client,
          event.businessSlug,
          event.connectionRef,
          event.providerEventIdentity,
        );
        if (!existing) throw new IntegrationInboundLedgerError('INBOUND_EVENT_NOT_FOUND');
        if (existing.material_hash !== materialHash) {
          throw new IntegrationInboundLedgerError('IDEMPOTENCY_CONFLICT');
        }
        return {
          event: validateIntegrationEvent(existing.event_json),
          replayed: true,
        };
      }

      const stored = await this.getRowWithClient(
        client,
        event.businessSlug,
        event.connectionRef,
        event.providerEventIdentity,
      );
      if (!stored) throw new IntegrationInboundLedgerError('INBOUND_EVENT_NOT_FOUND');
      return {
        event: validateIntegrationEvent(stored.event_json),
        replayed: false,
      };
    });
  }

  async get(
    businessSlug: string,
    connectionRef: string,
    providerEventIdentity: string,
  ): Promise<IntegrationEvent | undefined> {
    const client = await this.pool.connect();
    try {
      const row = await this.getRowWithClient(client, businessSlug, connectionRef, providerEventIdentity);
      return row === undefined ? undefined : validateIntegrationEvent(row.event_json);
    } finally {
      client.release();
    }
  }

  private async getRowWithClient(
    client: PoolClient,
    businessSlug: string,
    connectionRef: string,
    providerEventIdentity: string,
  ): Promise<EventRow | undefined> {
    const result = await client.query<EventRow>(
      `SELECT event_json, material_hash
         FROM integration_inbound_events
        WHERE business_slug = $1
          AND connection_ref = $2
          AND provider_event_identity = $3`,
      [businessSlug, connectionRef, providerEventIdentity],
    );
    return result.rows[0];
  }
}
