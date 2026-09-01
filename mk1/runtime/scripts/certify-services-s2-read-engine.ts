import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { Pool } from 'pg';
import { loadRuntimeConfig } from '../src/config/runtime-config.js';
import { PostgresServicesRepository } from '../src/persistence/postgres/services.repository.js';
import {
  snapshotOffering,
  toAppointmentProduct,
  toAppointmentService,
} from '../src/services/appointment-catalog.compat.js';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`SERVICES_S2_ASSERTION_FAILED:${message}`);
}

async function run(): Promise<void> {
  const pool = new Pool({ connectionString: loadRuntimeConfig().postgresUrl, max: 4 });
  const repository = new PostgresServicesRepository(pool);
  const token = randomUUID().replaceAll('-', '').slice(0, 12);
  const businessA = `s2-a-${token}`;
  const businessB = `s2-b-${token}`;
  const alphaService = `svc_${token}_alpha`;
  const zuluService = `svc_${token}_zulu`;
  const inactiveService = `svc_${token}_inactive`;
  const foreignService = `svc_${token}_foreign`;
  const offeringAlpha = `prd_${token}_alpha`;
  const offeringBeta = `prd_${token}_beta`;
  const offeringLow = `prd_${token}_low`;
  const offeringInactive = `prd_${token}_inactive`;

  try {
    await pool.query(
      `INSERT INTO service_catalog (
         service_id, business_slug, service_code, service_name, description, active, revision, tags
       ) VALUES
         ($1, $2, 'shared-code', 'Alpha Service', 'Primary S2 service', TRUE, 2, '["alpha"]'::jsonb),
         ($3, $2, 'zulu-service', 'Zulu Service', 'Secondary S2 service', TRUE, 1, '[]'::jsonb),
         ($4, $2, 'hidden-service', 'Hidden Service', 'Inactive S2 service', FALSE, 3, '[]'::jsonb),
         ($5, $6, 'shared-code', 'Foreign Service', 'Second business', TRUE, 5, '["foreign"]'::jsonb)`,
      [alphaService, businessA, zuluService, inactiveService, foreignService, businessB],
    );

    await pool.query(
      `INSERT INTO service_products (
         product_id, service_id, business_slug, product_code, product_name, description,
         duration_minutes, active, revision, priority, tags,
         price_kind, price_amount_minor, price_currency
       ) VALUES
         ($1, $2, $3, 'alpha-offering', 'Alpha Offering', 'First same-priority offering',
          45, TRUE, 4, 10, '["featured"]'::jsonb, 'FIXED', 8000, 'PEN'),
         ($4, $2, $3, 'beta-offering', 'Beta Offering', 'Second same-priority offering',
          30, TRUE, 2, 10, '[]'::jsonb, 'FROM', 5000, 'PEN'),
         ($5, $2, $3, 'low-offering', 'Low Offering', 'Lower priority offering',
          60, TRUE, 1, 5, '[]'::jsonb, 'QUOTE_REQUIRED', NULL, NULL),
         ($6, $2, $3, 'hidden-offering', 'Hidden Offering', 'Inactive offering',
          15, FALSE, 9, 999, '[]'::jsonb, 'FREE', NULL, NULL)`,
      [offeringAlpha, alphaService, businessA, offeringBeta, offeringLow, offeringInactive],
    );

    await pool.query(
      `INSERT INTO service_requirements (
         requirement_id, business_slug, product_id, requirement_code, requirement_kind, required, config
       ) VALUES
         ($1, $2, $3, 'contact-required', 'CUSTOMER_DATA', TRUE, '{"path":"customer.contact"}'::jsonb),
         ($4, $2, $3, 'document-optional', 'DOCUMENT', FALSE, '{"type":"id"}'::jsonb)`,
      [`req_${token}_a`, businessA, offeringAlpha, `req_${token}_b`],
    );

    await pool.query(
      `INSERT INTO service_dependencies (
         dependency_id, business_slug, source_product_id, target_product_id, relation
       ) VALUES ($1, $2, $3, $4, 'REQUIRES')`,
      [`dep_${token}`, businessA, offeringLow, offeringAlpha],
    );

    await pool.query(
      `INSERT INTO service_eligibility_rules (
         rule_id, business_slug, product_id, mode, predicates, failure_code
       ) VALUES ($1, $2, $3, 'ALL',
         '[{"path":"managedEntity.species","operator":"EXISTS"}]'::jsonb,
         'SPECIES_REQUIRED')`,
      [`elg_${token}`, businessA, offeringAlpha],
    );

    const services = await repository.listServices(businessA);
    assert(services.length === 2, 'ListServices must exclude inactive Service');
    assert(services[0]!.serviceId === alphaService && services[1]!.serviceId === zuluService,
      'ListServices must order by name then id deterministically');
    assert(services[0]!.revision === 2, 'Service revision must be returned');
    assert(services[0]!.tags[0] === 'alpha', 'Service tags must be returned');

    const sameCodeA = await repository.getService(businessA, 'shared-code');
    const sameCodeB = await repository.getService(businessB, 'shared-code');
    assert(sameCodeA?.serviceId === alphaService, 'same Service code must resolve inside business A only');
    assert(sameCodeB?.serviceId === foreignService, 'same Service code must resolve independently in business B');
    assert((await repository.getService(businessB, alphaService)) === undefined,
      'foreign business cannot retrieve Service by another business id');

    const explicitInactive = await repository.getService(businessA, inactiveService);
    assert(explicitInactive?.status === 'INACTIVE', 'explicit historical Service lookup must retain lifecycle status');

    const offerings = await repository.listOfferings(businessA, alphaService);
    assert(offerings.length === 3, 'ListOfferings must exclude inactive Offering');
    assert(
      offerings.map((item) => item.offeringId).join(',') === [offeringAlpha, offeringBeta, offeringLow].join(','),
      'Offerings must sort priority DESC then name ASC then id ASC',
    );

    const alpha = offerings[0]!;
    assert(alpha.revision === 4, 'Offering revision must be returned');
    assert(alpha.pricing.kind === 'FIXED', 'typed FIXED pricing must project');
    assert(alpha.pricing.kind !== 'FIXED' || alpha.pricing.amountMinor === 8000, 'minor-unit amount must project exactly');
    assert(alpha.requirements.length === 2, 'Offering requirements must hydrate');
    assert(alpha.requirements[0]!.code === 'contact-required', 'requirements must order deterministically');
    assert(alpha.eligibilityRuleSet?.failureCode === 'SPECIES_REQUIRED', 'eligibility rule data must hydrate');

    const low = offerings[2]!;
    assert(low.dependencies.length === 1, 'dependencies must hydrate');
    assert(low.dependencies[0]!.targetOfferingId === offeringAlpha, 'dependency target must project');
    assert(low.pricing.kind === 'QUOTE_REQUIRED', 'QUOTE_REQUIRED must project without fake price');

    const inactiveOffering = await repository.getOffering(businessA, offeringInactive);
    assert(inactiveOffering?.status === 'INACTIVE', 'explicit Offering lookup must return inactive historical identity');
    assert((await repository.getOffering(businessB, offeringAlpha)) === undefined,
      'foreign business cannot retrieve Offering by another business id');

    const appointmentService = toAppointmentService(services[0]!);
    const appointmentProduct = toAppointmentProduct(alpha);
    assert(appointmentService.serviceId === alphaService, 'Appointment Service compatibility projection must preserve id');
    assert(appointmentProduct.productId === offeringAlpha, 'Appointment Product compatibility projection must preserve offering identity');
    assert(appointmentProduct.durationMinutes === 45, 'Appointment compatibility must preserve duration');

    const snapshot = snapshotOffering(services[0]!, alpha);
    assert(snapshot.serviceRevision === 2 && snapshot.offeringRevision === 4,
      'snapshot must capture both current revisions');
    assert(snapshot.pricing.kind === 'FIXED', 'snapshot must carry pricing semantics');

    const repositorySourcePath = fileURLToPath(
      new URL('../src/persistence/postgres/services.repository.ts', import.meta.url),
    );
    const repositorySource = await readFile(repositorySourcePath, 'utf8');
    for (const forbidden of ['golden-auto', 'golden-vet', 'automotive', 'veterinary']) {
      assert(!repositorySource.includes(forbidden), `read engine must not branch on vertical token ${forbidden}`);
    }

    console.log('SERVICES_S2_READ_ENGINE_PASS', JSON.stringify({
      serviceOrder: services.map((item) => item.name),
      offeringOrder: offerings.map((item) => item.name),
      businessIsolation: true,
      inactiveListFiltering: true,
      explicitHistoricalLookup: true,
      fullOfferingHydration: true,
      appointmentCompatibility: true,
      revisionSnapshot: true,
      verticalNeutralRepository: true,
    }));
  } finally {
    await pool.query('DELETE FROM service_eligibility_rules WHERE business_slug IN ($1, $2)', [businessA, businessB]).catch(() => undefined);
    await pool.query('DELETE FROM service_dependencies WHERE business_slug IN ($1, $2)', [businessA, businessB]).catch(() => undefined);
    await pool.query('DELETE FROM service_requirements WHERE business_slug IN ($1, $2)', [businessA, businessB]).catch(() => undefined);
    await pool.query('DELETE FROM service_products WHERE business_slug IN ($1, $2)', [businessA, businessB]).catch(() => undefined);
    await pool.query('DELETE FROM service_catalog WHERE business_slug IN ($1, $2)', [businessA, businessB]).catch(() => undefined);
    await pool.end();
  }
}

run().catch((error: unknown) => {
  console.error(`SERVICES_S2_READ_ENGINE_FAILED ${JSON.stringify({
    error: error instanceof Error ? error.message : String(error),
  })}`);
  process.exitCode = 1;
});
