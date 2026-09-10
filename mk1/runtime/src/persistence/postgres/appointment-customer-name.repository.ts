import { Pool } from 'pg';
import { loadRuntimeConfig } from '../../config/runtime-config.js';
import type { ResolveAppointmentCustomerResult } from './appointment.repository.js';

let pool: Pool | undefined;

function db(): Pool {
  pool ??= new Pool({ connectionString: loadRuntimeConfig().postgresUrl, max: 4 });
  return pool;
}

export function normalizeCustomerDiscoveryName(value: string | undefined): string | undefined {
  const normalized = value?.trim().replace(/\s+/g, ' ').toLowerCase();
  return normalized || undefined;
}

/**
 * Name is a discovery key, not a globally unique identity.
 *
 * A single active exact normalized match can be reused deterministically.
 * Zero or multiple matches require stronger material (email/phone/document)
 * before the Appointment workflow may create or choose a Customer.
 */
export async function resolveAppointmentCustomerByName(
  businessSlug: string,
  rawName: string | undefined,
): Promise<ResolveAppointmentCustomerResult> {
  const name = normalizeCustomerDiscoveryName(rawName);
  if (!name) return { kind: 'NONE' };

  const result = await db().query<{ customer_id: string }>(
    `SELECT customer_id
       FROM customers
      WHERE business_slug = $1
        AND status = 'ACTIVE'
        AND regexp_replace(lower(btrim(customer_name)), '[[:space:]]+', ' ', 'g') = $2
      ORDER BY customer_id`,
    [businessSlug, name],
  );

  if (result.rows.length === 1) {
    return { kind: 'EXISTING', customerId: result.rows[0]!.customer_id };
  }
  if (result.rows.length > 1) {
    return {
      kind: 'AMBIGUOUS',
      candidateCustomerIds: result.rows.map((row) => row.customer_id),
    };
  }
  return { kind: 'NONE' };
}

export async function closeAppointmentCustomerNameRepository(): Promise<void> {
  const current = pool;
  pool = undefined;
  if (current) await current.end();
}
