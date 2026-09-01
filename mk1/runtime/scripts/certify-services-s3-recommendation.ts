import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { loadRuntimeConfig } from '../src/config/runtime-config.js';
import { PostgresServicesRepository } from '../src/persistence/postgres/services.repository.js';
import { recommendOfferings } from '../src/services/eligibility-engine.js';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`SERVICES_S3_ASSERTION_FAILED:${message}`);
}

async function run(): Promise<void> {
  const pool = new Pool({ connectionString: loadRuntimeConfig().postgresUrl, max: 4 });
  const repository = new PostgresServicesRepository(pool);
  const token = randomUUID().replaceAll('-', '').slice(0, 12);
  const business = `s3-${token}`;
  const serviceId = `svc_${token}`;
  const baseOffering = `prd_${token}_base`;
  const premiumOffering = `prd_${token}_premium`;
  const blockedOffering = `prd_${token}_blocked`;

  try {
    await pool.query(
      `INSERT INTO service_catalog (
         service_id, business_slug, service_code, service_name, description, active, revision, tags
       ) VALUES ($1, $2, 'inspection', 'Inspection', 'S3 deterministic recommendation fixture', TRUE, 1, '[]'::jsonb)`,
      [serviceId, business],
    );

    await pool.query(
      `INSERT INTO service_products (
         product_id, service_id, business_slug, product_code, product_name, description,
         duration_minutes, active, revision, priority, tags,
         price_kind, price_amount_minor, price_currency
       ) VALUES
         ($1, $2, $3, 'base', 'Base Inspection', 'Base option', 30, TRUE, 1, 5, '[]'::jsonb, 'FIXED', 5000, 'PEN'),
         ($4, $2, $3, 'premium', 'Premium Inspection', 'High-priority eligible option', 60, TRUE, 2, 20, '["featured"]'::jsonb, 'FIXED', 12000, 'PEN'),
         ($5, $2, $3, 'blocked', 'Blocked Inspection', 'Higher priority but ineligible', 45, TRUE, 1, 50, '[]'::jsonb, 'FREE', NULL, NULL)`,
      [baseOffering, serviceId, business, premiumOffering, blockedOffering],
    );

    await pool.query(
      `INSERT INTO service_requirements (
         requirement_id, business_slug, product_id, requirement_code, requirement_kind, required, config
       ) VALUES ($1, $2, $3, 'customer-contact', 'CUSTOMER_DATA', TRUE, '{"path":"customer.contact"}'::jsonb)`,
      [`req_${token}`, business, premiumOffering],
    );

    await pool.query(
      `INSERT INTO service_dependencies (
         dependency_id, business_slug, source_product_id, target_product_id, relation
       ) VALUES ($1, $2, $3, $4, 'REQUIRES')`,
      [`dep_${token}`, business, premiumOffering, baseOffering],
    );

    await pool.query(
      `INSERT INTO service_eligibility_rules (
         rule_id, business_slug, product_id, mode, predicates, failure_code
       ) VALUES
         ($1, $2, $3, 'ALL', '[{"path":"vehicle.year","operator":"GTE","value":2020}]'::jsonb, 'VEHICLE_TOO_OLD'),
         ($4, $2, $5, 'ALL', '[{"path":"customer.country","operator":"EQ","value":"US"}]'::jsonb, 'COUNTRY_NOT_SUPPORTED')`,
      [`elg_${token}_premium`, business, premiumOffering, `elg_${token}_blocked`, blockedOffering],
    );

    const offerings = await repository.listOfferings(business, serviceId);
    assert(offerings.length === 3, 'fixture must hydrate three active Offerings');

    const context = {
      facts: { vehicle: { year: 2024 }, customer: { country: 'PE' } },
      satisfiedRequirementCodes: ['customer-contact'],
      selectedOfferingIds: [baseOffering],
    } as const;

    const first = recommendOfferings(offerings, context);
    const second = recommendOfferings([...offerings].reverse(), context);
    assert(JSON.stringify(first) === JSON.stringify(second), 'recommendation must be input-order independent');
    assert(first.recommendations.length === 2, 'blocked Offering must be excluded');
    assert(first.recommendations[0]!.offering.offeringId === premiumOffering,
      'eligible higher-priority Offering must rank first');
    assert(first.recommendations[1]!.offering.offeringId === baseOffering,
      'base Offering must rank second');

    const blocked = first.evaluations.find((item) => item.offeringId === blockedOffering);
    assert(blocked?.eligible === false, 'blocked Offering must be ineligible');
    assert(blocked?.reasonCodes.includes('COUNTRY_NOT_SUPPORTED'), 'configured failure code must be preserved');

    const withoutRequirements = recommendOfferings(offerings, {
      facts: context.facts,
      satisfiedRequirementCodes: [],
      selectedOfferingIds: [],
    });
    const premiumBlocked = withoutRequirements.evaluations.find((item) => item.offeringId === premiumOffering);
    assert(premiumBlocked?.reasonCodes.includes('REQUIREMENT_UNSATISFIED:customer-contact'),
      'required requirement must participate in eligibility');
    assert(premiumBlocked?.reasonCodes.includes(`DEPENDENCY_REQUIRED:${baseOffering}`),
      'REQUIRES dependency must participate in eligibility');

    console.log('SERVICES_S3_RECOMMENDATION_PASS', JSON.stringify({
      recommendationOrder: first.recommendations.map((item) => item.offering.name),
      stableAcrossInputOrdering: true,
      explicitReasonCodes: true,
      requirementEvaluation: true,
      dependencyEvaluation: true,
      databaseHydrationToPureEngine: true,
      agentDependency: false,
    }));
  } finally {
    await pool.query('DELETE FROM service_eligibility_rules WHERE business_slug = $1', [business]).catch(() => undefined);
    await pool.query('DELETE FROM service_dependencies WHERE business_slug = $1', [business]).catch(() => undefined);
    await pool.query('DELETE FROM service_requirements WHERE business_slug = $1', [business]).catch(() => undefined);
    await pool.query('DELETE FROM service_products WHERE business_slug = $1', [business]).catch(() => undefined);
    await pool.query('DELETE FROM service_catalog WHERE business_slug = $1', [business]).catch(() => undefined);
    await pool.end();
  }
}

run().catch((error: unknown) => {
  console.error(`SERVICES_S3_RECOMMENDATION_FAILED ${JSON.stringify({
    error: error instanceof Error ? error.message : String(error),
  })}`);
  process.exitCode = 1;
});
