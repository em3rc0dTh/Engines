import { createHash, randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { loadRuntimeConfig } from '../../config/runtime-config.js';
import type { ManagedEntityCandidate } from '../../contracts/register-new-appointment/managed-entity-policy.js';

let pool: Pool | undefined;

function db(): Pool {
  pool ??= new Pool({ connectionString: loadRuntimeConfig().postgresUrl, max: 6 });
  return pool;
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, child]) => `${JSON.stringify(key)}:${canonicalJson(child)}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

function fingerprint(value: unknown): string {
  return createHash('sha256').update(canonicalJson(value), 'utf8').digest('hex');
}

function normalizedExternalRef(value: string): string {
  return value.trim().toLowerCase();
}

export type ManagedEntityRecord = Readonly<{
  managedEntityId: string;
  businessSlug: string;
  customerId: string;
  type: string;
  displayName: string;
  summary?: string;
  data: Readonly<Record<string, unknown>>;
  externalRef: string;
  status: 'ACTIVE' | 'INACTIVE';
}>;

export type CreateManagedEntityInput = Readonly<{
  businessSlug: string;
  customerId: string;
  type: string;
  displayName: string;
  summary?: string;
  data?: Readonly<Record<string, unknown>>;
  externalRef: string;
}>;

export type CreateManagedEntityResult =
  | Readonly<{ kind: 'CREATED'; managedEntity: ManagedEntityRecord }>
  | Readonly<{ kind: 'EXISTING'; managedEntity: ManagedEntityRecord }>
  | Readonly<{ kind: 'CONFLICT'; managedEntityId: string }>;

function toRecord(row: {
  managed_entity_id: string;
  business_slug: string;
  customer_id: string;
  entity_type: string;
  display_name: string;
  summary: string | null;
  data_json: Record<string, unknown> | null;
  external_ref: string;
  status: 'ACTIVE' | 'INACTIVE';
}): ManagedEntityRecord {
  return {
    managedEntityId: row.managed_entity_id,
    businessSlug: row.business_slug,
    customerId: row.customer_id,
    type: row.entity_type,
    displayName: row.display_name,
    ...(row.summary ? { summary: row.summary } : {}),
    data: row.data_json ?? {},
    externalRef: row.external_ref,
    status: row.status,
  };
}

export async function listManagedEntitiesForCustomer(
  businessSlug: string,
  customerId: string,
  type: string,
): Promise<readonly ManagedEntityCandidate[]> {
  const result = await db().query<{
    managed_entity_id: string;
    entity_type: string;
    display_name: string;
    summary: string | null;
  }>(
    `SELECT managed_entity_id, entity_type, display_name, summary
       FROM managed_entities
      WHERE business_slug = $1
        AND customer_id = $2
        AND entity_type = $3
        AND status = 'ACTIVE'
      ORDER BY created_at, managed_entity_id`,
    [businessSlug, customerId, type],
  );
  return result.rows.map((row) => ({
    managedEntityId: row.managed_entity_id,
    type: row.entity_type,
    displayName: row.display_name,
    ...(row.summary ? { summary: row.summary } : {}),
  }));
}

export async function getManagedEntityForCustomer(
  businessSlug: string,
  customerId: string,
  managedEntityId: string,
): Promise<ManagedEntityRecord | undefined> {
  const result = await db().query<{
    managed_entity_id: string;
    business_slug: string;
    customer_id: string;
    entity_type: string;
    display_name: string;
    summary: string | null;
    data_json: Record<string, unknown> | null;
    external_ref: string;
    status: 'ACTIVE' | 'INACTIVE';
  }>(
    `SELECT managed_entity_id, business_slug, customer_id, entity_type,
            display_name, summary, data_json, external_ref, status
       FROM managed_entities
      WHERE business_slug = $1
        AND customer_id = $2
        AND managed_entity_id = $3`,
    [businessSlug, customerId, managedEntityId],
  );
  const row = result.rows[0];
  return row ? toRecord(row) : undefined;
}

export async function createManagedEntityForCustomer(
  input: CreateManagedEntityInput,
): Promise<CreateManagedEntityResult> {
  const businessSlug = input.businessSlug.trim();
  const customerId = input.customerId.trim();
  const type = input.type.trim();
  const displayName = input.displayName.trim();
  const externalRef = normalizedExternalRef(input.externalRef);
  const summary = input.summary?.trim() || undefined;
  const data = input.data ?? {};

  if (!businessSlug || !customerId || !type || !displayName || !externalRef) {
    throw new Error('MANAGED_ENTITY_INVALID_INPUT');
  }

  const customer = await db().query(
    `SELECT 1 FROM customers WHERE business_slug = $1 AND customer_id = $2 AND status = 'ACTIVE'`,
    [businessSlug, customerId],
  );
  if ((customer.rowCount ?? 0) === 0) throw new Error('MANAGED_ENTITY_CUSTOMER_NOT_FOUND');

  const managedEntityId = `men_${randomUUID()}`;
  const inserted = await db().query<{
    managed_entity_id: string;
    business_slug: string;
    customer_id: string;
    entity_type: string;
    display_name: string;
    summary: string | null;
    data_json: Record<string, unknown> | null;
    external_ref: string;
    status: 'ACTIVE' | 'INACTIVE';
  }>(
    `INSERT INTO managed_entities (
       managed_entity_id, business_slug, customer_id, entity_type, external_ref,
       display_name, summary, data_json, status
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,'ACTIVE')
     ON CONFLICT (business_slug, customer_id, entity_type, external_ref) DO NOTHING
     RETURNING managed_entity_id, business_slug, customer_id, entity_type,
               display_name, summary, data_json, external_ref, status`,
    [managedEntityId, businessSlug, customerId, type, externalRef, displayName, summary ?? null, JSON.stringify(data)],
  );
  if (inserted.rows[0]) return { kind: 'CREATED', managedEntity: toRecord(inserted.rows[0]) };

  const existing = await db().query<{
    managed_entity_id: string;
    business_slug: string;
    customer_id: string;
    entity_type: string;
    display_name: string;
    summary: string | null;
    data_json: Record<string, unknown> | null;
    external_ref: string;
    status: 'ACTIVE' | 'INACTIVE';
  }>(
    `SELECT managed_entity_id, business_slug, customer_id, entity_type,
            display_name, summary, data_json, external_ref, status
       FROM managed_entities
      WHERE business_slug = $1
        AND customer_id = $2
        AND entity_type = $3
        AND external_ref = $4`,
    [businessSlug, customerId, type, externalRef],
  );
  const row = existing.rows[0];
  if (!row) throw new Error('MANAGED_ENTITY_CONFLICT_WITHOUT_ROW');
  const record = toRecord(row);
  const expectedMaterial = fingerprint({ type, displayName, summary: summary ?? null, data, externalRef });
  const actualMaterial = fingerprint({
    type: record.type,
    displayName: record.displayName,
    summary: record.summary ?? null,
    data: record.data,
    externalRef: record.externalRef,
  });
  if (expectedMaterial !== actualMaterial) {
    return { kind: 'CONFLICT', managedEntityId: record.managedEntityId };
  }
  if (record.status !== 'ACTIVE') {
    await db().query(
      `UPDATE managed_entities SET status = 'ACTIVE', updated_at = NOW() WHERE managed_entity_id = $1`,
      [record.managedEntityId],
    );
    return { kind: 'EXISTING', managedEntity: { ...record, status: 'ACTIVE' } };
  }
  return { kind: 'EXISTING', managedEntity: record };
}

export async function closeManagedEntityRepository(): Promise<void> {
  const current = pool;
  pool = undefined;
  if (current) await current.end();
}
