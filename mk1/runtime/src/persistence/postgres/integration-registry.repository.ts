import { createHash } from 'node:crypto';
import { Pool, type PoolClient } from 'pg';
import type {
  IntegrationConnection,
  IntegrationConnectionStatus,
  IntegrationProviderDefinition,
  IntegrationSecretReference,
} from '../../integration/registry.js';
import {
  assertRegistryValid,
  validateIntegrationConnection,
  validateIntegrationProviderDefinition,
} from '../../integration/registry.js';

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function stableJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${stableJson(record[key])}`).join(',')}}`;
}

function asIso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
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

export class IntegrationRegistryError extends Error {
  constructor(readonly code: string, message: string = code) {
    super(message);
    this.name = 'IntegrationRegistryError';
  }
}

export class PostgresIntegrationRegistryRepository {
  constructor(private readonly pool: Pool) {}

  async registerProvider(value: IntegrationProviderDefinition): Promise<IntegrationProviderDefinition> {
    assertRegistryValid('INTEGRATION_PROVIDER', validateIntegrationProviderDefinition(value));
    const materialHash = sha256(stableJson(value));
    const inserted = await this.pool.query<{ provider_kind: string }>(
      `INSERT INTO integration_providers (
         provider_kind, display_name, status, capabilities, revision, material_hash
       ) VALUES ($1,$2,$3,$4::text[],$5,$6)
       ON CONFLICT (provider_kind) DO NOTHING
       RETURNING provider_kind`,
      [value.providerKind, value.displayName, value.status, value.capabilities, value.revision, materialHash],
    );
    if (inserted.rowCount === 0) {
      const existing = await this.pool.query<{ material_hash: string }>(
        `SELECT material_hash FROM integration_providers WHERE provider_kind = $1`,
        [value.providerKind],
      );
      if (existing.rows[0]?.material_hash !== materialHash) {
        throw new IntegrationRegistryError('PROVIDER_CONFLICT');
      }
    }
    return (await this.getProvider(value.providerKind))!;
  }

  async getProvider(providerKind: string): Promise<IntegrationProviderDefinition | undefined> {
    const result = await this.pool.query<{
      provider_kind: string;
      display_name: string;
      status: IntegrationProviderDefinition['status'];
      capabilities: string[];
      revision: number;
    }>(
      `SELECT provider_kind, display_name, status, capabilities, revision
         FROM integration_providers
        WHERE provider_kind = $1`,
      [providerKind],
    );
    const row = result.rows[0];
    if (!row) return undefined;
    return {
      providerKind: row.provider_kind,
      displayName: row.display_name,
      status: row.status,
      capabilities: row.capabilities,
      revision: row.revision,
    };
  }

  async registerConnection(value: IntegrationConnection): Promise<IntegrationConnection> {
    assertRegistryValid('INTEGRATION_CONNECTION', validateIntegrationConnection(value));
    const materialHash = sha256(stableJson(value));
    return transaction(this.pool, async (client) => {
      const providerResult = await client.query<{
        status: IntegrationProviderDefinition['status'];
        capabilities: string[];
      }>(
        `SELECT status, capabilities FROM integration_providers WHERE provider_kind = $1 FOR SHARE`,
        [value.providerKind],
      );
      const provider = providerResult.rows[0];
      if (!provider) throw new IntegrationRegistryError('PROVIDER_NOT_FOUND');
      if (provider.status !== 'ENABLED') throw new IntegrationRegistryError('PROVIDER_DISABLED');
      const unsupported = value.capabilities.filter((capability) => !provider.capabilities.includes(capability));
      if (unsupported.length > 0) throw new IntegrationRegistryError('CAPABILITY_NOT_SUPPORTED');

      const inserted = await client.query<{ connection_ref: string }>(
        `INSERT INTO integration_connections (
           business_slug, connection_ref, provider_kind, external_account_ref,
           status, capabilities, revision, material_hash, created_at, updated_at
         ) VALUES ($1,$2,$3,$4,$5,$6::text[],$7,$8,$9,$10)
         ON CONFLICT (business_slug, connection_ref) DO NOTHING
         RETURNING connection_ref`,
        [
          value.businessSlug,
          value.connectionRef,
          value.providerKind,
          value.externalAccountRef ?? null,
          value.status,
          value.capabilities,
          value.revision,
          materialHash,
          value.createdAt,
          value.updatedAt,
        ],
      );

      if (inserted.rowCount === 0) {
        const existing = await client.query<{ material_hash: string }>(
          `SELECT material_hash
             FROM integration_connections
            WHERE business_slug = $1 AND connection_ref = $2`,
          [value.businessSlug, value.connectionRef],
        );
        if (existing.rows[0]?.material_hash !== materialHash) {
          throw new IntegrationRegistryError('CONNECTION_CONFLICT');
        }
      } else {
        for (const secretRef of value.secretRefs) {
          await client.query(
            `INSERT INTO integration_secret_references (
               business_slug, connection_ref, secret_ref, purpose, binding_kind, binding_ref
             ) VALUES ($1,$2,$3,$4,$5,$6)`,
            [
              value.businessSlug,
              value.connectionRef,
              secretRef.secretRef,
              secretRef.purpose,
              secretRef.bindingKind,
              secretRef.bindingRef,
            ],
          );
        }
      }

      const result = await this.getConnectionWithClient(client, value.businessSlug, value.connectionRef);
      if (!result) throw new IntegrationRegistryError('CONNECTION_NOT_FOUND');
      return result;
    });
  }

  async getConnection(businessSlug: string, connectionRef: string): Promise<IntegrationConnection | undefined> {
    const client = await this.pool.connect();
    try {
      return await this.getConnectionWithClient(client, businessSlug, connectionRef);
    } finally {
      client.release();
    }
  }

  async resolveConnection(
    businessSlug: string,
    connectionRef: string,
    capability: string,
  ): Promise<IntegrationConnection> {
    const connection = await this.getConnection(businessSlug, connectionRef);
    if (!connection) throw new IntegrationRegistryError('CONNECTION_NOT_FOUND');
    if (connection.status !== 'ENABLED') throw new IntegrationRegistryError('CONNECTION_DISABLED');
    if (!connection.capabilities.includes(capability)) {
      throw new IntegrationRegistryError('CAPABILITY_NOT_SUPPORTED');
    }
    return connection;
  }

  async setConnectionStatus(
    businessSlug: string,
    connectionRef: string,
    expectedRevision: number,
    status: IntegrationConnectionStatus,
  ): Promise<IntegrationConnection> {
    const result = await this.pool.query(
      `UPDATE integration_connections
          SET status = $4, revision = revision + 1, updated_at = NOW()
        WHERE business_slug = $1 AND connection_ref = $2 AND revision = $3`,
      [businessSlug, connectionRef, expectedRevision, status],
    );
    if (result.rowCount === 0) {
      const existing = await this.getConnection(businessSlug, connectionRef);
      if (!existing) throw new IntegrationRegistryError('CONNECTION_NOT_FOUND');
      throw new IntegrationRegistryError('CONNECTION_REVISION_CONFLICT');
    }
    return (await this.getConnection(businessSlug, connectionRef))!;
  }

  private async getConnectionWithClient(
    client: PoolClient,
    businessSlug: string,
    connectionRef: string,
  ): Promise<IntegrationConnection | undefined> {
    const result = await client.query<{
      connection_ref: string;
      business_slug: string;
      provider_kind: string;
      external_account_ref: string | null;
      status: IntegrationConnection['status'];
      capabilities: string[];
      revision: number;
      created_at: Date | string;
      updated_at: Date | string;
    }>(
      `SELECT connection_ref, business_slug, provider_kind, external_account_ref,
              status, capabilities, revision, created_at, updated_at
         FROM integration_connections
        WHERE business_slug = $1 AND connection_ref = $2`,
      [businessSlug, connectionRef],
    );
    const row = result.rows[0];
    if (!row) return undefined;

    const secretRows = await client.query<{
      secret_ref: string;
      purpose: string;
      binding_kind: IntegrationSecretReference['bindingKind'];
      binding_ref: string;
    }>(
      `SELECT secret_ref, purpose, binding_kind, binding_ref
         FROM integration_secret_references
        WHERE business_slug = $1 AND connection_ref = $2
        ORDER BY purpose ASC, secret_ref ASC`,
      [businessSlug, connectionRef],
    );

    return {
      connectionRef: row.connection_ref,
      businessSlug: row.business_slug,
      providerKind: row.provider_kind,
      ...(row.external_account_ref === null ? {} : { externalAccountRef: row.external_account_ref }),
      status: row.status,
      capabilities: row.capabilities,
      secretRefs: secretRows.rows.map((secret): IntegrationSecretReference => ({
        secretRef: secret.secret_ref,
        purpose: secret.purpose,
        bindingKind: secret.binding_kind,
        bindingRef: secret.binding_ref,
      })),
      revision: row.revision,
      createdAt: asIso(row.created_at),
      updatedAt: asIso(row.updated_at),
    };
  }
}
