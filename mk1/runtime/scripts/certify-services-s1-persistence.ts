import { randomUUID } from 'node:crypto';
import { Pool, type PoolClient } from 'pg';
import { loadRuntimeConfig } from '../src/config/runtime-config.js';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`SERVICES_S1_ASSERTION_FAILED:${message}`);
}

let savepointCounter = 0;

async function expectPgError(
  client: PoolClient,
  expectedCode: string,
  query: string,
  params: readonly unknown[],
  label: string,
): Promise<void> {
  const savepoint = `s1_expected_${savepointCounter++}`;
  await client.query(`SAVEPOINT ${savepoint}`);
  try {
    await client.query(query, [...params]);
    throw new Error(`SERVICES_S1_EXPECTED_DB_ERROR_MISSING:${label}`);
  } catch (error: unknown) {
    const code = typeof error === 'object' && error !== null && 'code' in error
      ? String((error as { code?: unknown }).code ?? '')
      : '';
    await client.query(`ROLLBACK TO SAVEPOINT ${savepoint}`);
    if (code !== expectedCode) throw error;
  } finally {
    await client.query(`RELEASE SAVEPOINT ${savepoint}`);
  }
}

async function run(): Promise<void> {
  const pool = new Pool({ connectionString: loadRuntimeConfig().postgresUrl, max: 1 });
  const client = await pool.connect();
  const token = randomUUID().replaceAll('-', '').slice(0, 12);
  const businessA = `s1-auto-${token}`;
  const businessB = `s1-vet-${token}`;
  const serviceA = `svc_${token}_a`;
  const serviceB = `svc_${token}_b`;
  const offeringA = `prd_${token}_a`;
  const offeringA2 = `prd_${token}_a2`;

  try {
    await client.query('BEGIN');

    const inherited = await client.query<{
      status: string;
      revision: number;
      tags: unknown;
      price_kind: string;
      price_amount_minor: string | null;
      price_currency: string | null;
    }>(
      `SELECT s.status, s.revision, s.tags,
              p.price_kind, p.price_amount_minor, p.price_currency
         FROM service_catalog s
         JOIN service_products p ON p.service_id = s.service_id AND p.business_slug = s.business_slug
        WHERE s.business_slug = 'golden-business'
          AND s.service_id = 'svc_car_wash'
          AND p.product_id = 'prd_car_wash_basic'`,
    );
    assert(inherited.rowCount === 1, 'existing MK0 catalog seed must survive migration');
    assert(inherited.rows[0]!.status === 'ACTIVE', 'existing service must expose ACTIVE generated status');
    assert(inherited.rows[0]!.revision === 1, 'existing service must begin at revision 1');
    assert(inherited.rows[0]!.price_kind === 'QUOTE_REQUIRED', 'legacy offering must receive truthful quote-required default');
    assert(inherited.rows[0]!.price_amount_minor === null, 'legacy quote-required offering must not fabricate amount');
    assert(inherited.rows[0]!.price_currency === null, 'legacy quote-required offering must not fabricate currency');

    await client.query(
      `INSERT INTO service_catalog (
         service_id, business_slug, service_code, service_name, description, active, revision, tags
       ) VALUES
         ($1, $2, 'vehicle-care', 'Vehicle Care', 'Synthetic automotive service', TRUE, 1, '["automotive"]'::jsonb),
         ($3, $4, 'consultation', 'Consultation', 'Synthetic veterinary service', TRUE, 1, '["veterinary"]'::jsonb)`,
      [serviceA, businessA, serviceB, businessB],
    );

    await client.query(
      `INSERT INTO service_products (
         product_id, service_id, business_slug, product_code, product_name, description,
         duration_minutes, active, revision, priority, tags, price_kind, price_amount_minor, price_currency
       ) VALUES
         ($1, $2, $3, 'basic-wash', 'Basic Wash', 'Synthetic offering',
          30, TRUE, 1, 10, '["wash"]'::jsonb, 'FIXED', 3500, 'PEN'),
         ($4, $2, $3, 'detail-quote', 'Detail Quote', 'Synthetic quote offering',
          60, TRUE, 1, 5, '[]'::jsonb, 'QUOTE_REQUIRED', NULL, NULL)`,
      [offeringA, serviceA, businessA, offeringA2],
    );

    const projection = await client.query<{
      status: string;
      revision: number;
      price_kind: string;
      price_amount_minor: string;
      price_currency: string;
    }>(
      `SELECT status, revision, price_kind, price_amount_minor, price_currency
         FROM service_products
        WHERE business_slug = $1 AND product_id = $2`,
      [businessA, offeringA],
    );
    assert(projection.rows[0]!.status === 'ACTIVE', 'offering status must derive from active lifecycle');
    assert(projection.rows[0]!.revision === 1, 'offering revision must be explicit');
    assert(projection.rows[0]!.price_kind === 'FIXED', 'fixed pricing kind must persist');
    assert(projection.rows[0]!.price_amount_minor === '3500', 'minor-unit price must persist exactly');
    assert(projection.rows[0]!.price_currency === 'PEN', 'currency must persist exactly');

    await client.query(
      `INSERT INTO service_requirements (
         requirement_id, business_slug, product_id, requirement_code, requirement_kind, required, config
       ) VALUES ($1, $2, $3, 'contact-required', 'CUSTOMER_DATA', TRUE, '{"path":"customer.contact"}'::jsonb)`,
      [`req_${token}`, businessA, offeringA],
    );

    await client.query(
      `INSERT INTO service_dependencies (
         dependency_id, business_slug, source_product_id, target_product_id, relation
       ) VALUES ($1, $2, $3, $4, 'REQUIRES')`,
      [`dep_${token}`, businessA, offeringA2, offeringA],
    );

    await client.query(
      `INSERT INTO service_eligibility_rules (
         rule_id, business_slug, product_id, mode, predicates, failure_code
       ) VALUES ($1, $2, $3, 'ALL', '[{"path":"customer.contact","operator":"EXISTS"}]'::jsonb, 'CONTACT_REQUIRED')`,
      [`elg_${token}`, businessA, offeringA],
    );

    await expectPgError(
      client,
      '23514',
      `INSERT INTO service_products (
         product_id, service_id, business_slug, product_code, product_name,
         duration_minutes, active, price_kind, price_amount_minor, price_currency
       ) VALUES ($1, $2, $3, 'negative-price', 'Negative Price', 30, TRUE, 'FIXED', -1, 'PEN')`,
      [`bad_price_${token}`, serviceA, businessA],
      'negative price',
    );

    await expectPgError(
      client,
      '23514',
      `INSERT INTO service_products (
         product_id, service_id, business_slug, product_code, product_name,
         duration_minutes, active, price_kind, price_amount_minor, price_currency
       ) VALUES ($1, $2, $3, 'bad-currency', 'Bad Currency', 30, TRUE, 'FIXED', 100, 'pen')`,
      [`bad_currency_${token}`, serviceA, businessA],
      'malformed currency',
    );

    await expectPgError(
      client,
      '23514',
      `INSERT INTO service_products (
         product_id, service_id, business_slug, product_code, product_name,
         duration_minutes, active, price_kind
       ) VALUES ($1, $2, $3, 'zero-duration', 'Zero Duration', 0, TRUE, 'QUOTE_REQUIRED')`,
      [`bad_duration_${token}`, serviceA, businessA],
      'zero duration',
    );

    await expectPgError(
      client,
      '23503',
      `INSERT INTO service_requirements (
         requirement_id, business_slug, product_id, requirement_code, requirement_kind, required, config
       ) VALUES ($1, $2, $3, 'cross-business', 'PRECONDITION', TRUE, '{}'::jsonb)`,
      [`cross_req_${token}`, businessB, offeringA],
      'cross-business offering reference',
    );

    await expectPgError(
      client,
      '23514',
      `INSERT INTO service_dependencies (
         dependency_id, business_slug, source_product_id, target_product_id, relation
       ) VALUES ($1, $2, $3, $3, 'REQUIRES')`,
      [`self_dep_${token}`, businessA, offeringA],
      'self dependency',
    );

    await expectPgError(
      client,
      '23505',
      `INSERT INTO service_dependencies (
         dependency_id, business_slug, source_product_id, target_product_id, relation
       ) VALUES ($1, $2, $3, $4, 'EXCLUDES')`,
      [`contradictory_dep_${token}`, businessA, offeringA2, offeringA],
      'contradictory dependency pair',
    );

    await expectPgError(
      client,
      '23514',
      `INSERT INTO service_eligibility_rules (
         rule_id, business_slug, product_id, mode, predicates, failure_code
       ) VALUES ($1, $2, $3, 'ALL', '{}'::jsonb, 'BAD_SHAPE')`,
      [`bad_rule_${token}`, businessA, offeringA2],
      'eligibility predicates must be an array',
    );

    console.log('SERVICES_S1_PERSISTENCE_PASS', JSON.stringify({
      inheritedCatalogPreserved: true,
      generatedLifecycle: true,
      revisionColumns: true,
      pricingConstraints: true,
      requirementBusinessScope: true,
      dependencyConstraints: true,
      eligibilityShapeConstraint: true,
    }));
  } finally {
    await client.query('ROLLBACK').catch(() => undefined);
    client.release();
    await pool.end();
  }
}

run().catch((error: unknown) => {
  console.error(`SERVICES_S1_PERSISTENCE_FAILED ${JSON.stringify({
    error: error instanceof Error ? error.message : String(error),
  })}`);
  process.exitCode = 1;
});
