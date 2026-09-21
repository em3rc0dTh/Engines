import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { Client, Connection } from '@temporalio/client';
import { MongoClient } from 'mongodb';
import { Pool } from 'pg';
import { loadRuntimeConfig } from '../src/config/runtime-config.js';
import type {
  ServicesMutationCommand,
  ServicesMutationOutcome,
} from '../src/contracts/services-engine/index.js';
import { PostgresServicesRepository } from '../src/persistence/postgres/services.repository.js';
import { recommendOfferings } from '../src/services/eligibility-engine.js';

async function run(): Promise<void> {
  const config = loadRuntimeConfig();
  const connection = await Connection.connect({ address: config.temporalAddress });
  const temporal = new Client({ connection, namespace: config.temporalNamespace });
  const pool = new Pool({ connectionString: config.postgresUrl, max: 4 });
  const mongo = new MongoClient(config.mongoUrl, { maxPoolSize: 2 });
  await mongo.connect();
  const reads = new PostgresServicesRepository(pool);

  const businessAuto = 's6-golden-auto';
  const businessVet = 's6-golden-vet';
  const workflowIds: string[] = [];

  async function execute(label: string, command: ServicesMutationCommand): Promise<ServicesMutationOutcome> {
    const workflowId = `mk1-s6:${label}:${randomUUID()}`;
    workflowIds.push(workflowId);
    return temporal.workflow.execute<(input: ServicesMutationCommand) => Promise<ServicesMutationOutcome>>(
      'servicesManagementWorkflow',
      {
        workflowId,
        taskQueue: config.temporalTaskQueue,
        args: [command],
      },
    );
  }

  const autoService: ServicesMutationCommand = {
    operation: 'CreateService',
    businessSlug: businessAuto,
    idempotencyKey: 'shared-service-create',
    service: {
      serviceId: 'svc_s6_auto_primary',
      code: 'primary-service',
      name: 'Vehicle Care',
      description: 'Automotive specimen for S6 generality',
      tags: ['vehicle', 'care'],
    },
  };

  const vetService: ServicesMutationCommand = {
    operation: 'CreateService',
    businessSlug: businessVet,
    idempotencyKey: 'shared-service-create',
    service: {
      serviceId: 'svc_s6_vet_primary',
      code: 'primary-service',
      name: 'Consultation',
      description: 'Veterinary specimen for S6 generality',
      tags: ['veterinary', 'consultation'],
    },
  };

  const autoCreated = await execute('auto-service', autoService);
  const vetCreated = await execute('vet-service', vetService);
  assert.equal(autoCreated.status, 'APPLIED');
  assert.equal(vetCreated.status, 'APPLIED');

  const autoReplay = await execute('auto-service-replay', autoService);
  assert.equal(autoReplay.status, 'REPLAYED');

  const autoOffering: ServicesMutationCommand = {
    operation: 'CreateOffering',
    businessSlug: businessAuto,
    idempotencyKey: 'shared-offering-create',
    offering: {
      offeringId: 'off_s6_auto_standard',
      serviceId: 'svc_s6_auto_primary',
      code: 'standard',
      name: 'Basic Wash',
      durationMinutes: 30,
      pricing: { kind: 'FIXED', amountMinor: 3000, currency: 'PEN' },
      priority: 10,
      tags: ['wash'],
      requirements: [
        {
          code: 'vehicle-profile',
          kind: 'ENTITY_ATTRIBUTE',
          required: true,
          config: { entity: 'vehicle' },
        },
      ],
      dependencies: [],
      eligibilityRuleSet: {
        mode: 'ALL',
        predicates: [{ path: 'vehicle.type', operator: 'EXISTS' }],
        failureCode: 'VEHICLE_TYPE_REQUIRED',
      },
    },
  };

  const vetOffering: ServicesMutationCommand = {
    operation: 'CreateOffering',
    businessSlug: businessVet,
    idempotencyKey: 'shared-offering-create',
    offering: {
      offeringId: 'off_s6_vet_standard',
      serviceId: 'svc_s6_vet_primary',
      code: 'standard',
      name: 'General Consultation',
      durationMinutes: 45,
      pricing: { kind: 'FIXED', amountMinor: 7000, currency: 'PEN' },
      priority: 10,
      tags: ['consultation'],
      requirements: [
        {
          code: 'pet-profile',
          kind: 'ENTITY_ATTRIBUTE',
          required: true,
          config: { entity: 'pet' },
        },
      ],
      dependencies: [],
      eligibilityRuleSet: {
        mode: 'ALL',
        predicates: [{ path: 'pet.species', operator: 'EXISTS' }],
        failureCode: 'PET_SPECIES_REQUIRED',
      },
    },
  };

  const autoOfferingCreated = await execute('auto-offering', autoOffering);
  const vetOfferingCreated = await execute('vet-offering', vetOffering);
  assert.equal(autoOfferingCreated.status, 'APPLIED');
  assert.equal(vetOfferingCreated.status, 'APPLIED');

  const autoByCode = await reads.getService(businessAuto, 'primary-service');
  const vetByCode = await reads.getService(businessVet, 'primary-service');
  assert.equal(autoByCode?.serviceId, 'svc_s6_auto_primary');
  assert.equal(vetByCode?.serviceId, 'svc_s6_vet_primary');
  assert.equal(await reads.getService(businessVet, 'svc_s6_auto_primary'), undefined);
  assert.equal(await reads.getService(businessAuto, 'svc_s6_vet_primary'), undefined);

  const autoOfferingByCode = await reads.getOffering(businessAuto, 'standard');
  const vetOfferingByCode = await reads.getOffering(businessVet, 'standard');
  assert.equal(autoOfferingByCode?.offeringId, 'off_s6_auto_standard');
  assert.equal(vetOfferingByCode?.offeringId, 'off_s6_vet_standard');
  assert.equal(autoOfferingByCode?.durationMinutes, 30);
  assert.equal(vetOfferingByCode?.durationMinutes, 45);
  assert.equal(await reads.getOffering(businessVet, 'off_s6_auto_standard'), undefined);
  assert.equal(await reads.getOffering(businessAuto, 'off_s6_vet_standard'), undefined);

  const crossBusinessDependency = await execute('cross-business-dependency', {
    operation: 'CreateOffering',
    businessSlug: businessVet,
    idempotencyKey: 'cross-business-dependency-rejected',
    offering: {
      offeringId: 'off_s6_vet_invalid_cross_dependency',
      serviceId: 'svc_s6_vet_primary',
      code: 'cross-business-invalid',
      name: 'Cross Business Invalid',
      durationMinutes: 15,
      pricing: { kind: 'FREE' },
      priority: 0,
      tags: [],
      requirements: [],
      dependencies: [
        { relation: 'REQUIRES', targetOfferingId: 'off_s6_auto_standard' },
      ],
    },
  });
  assert.equal(crossBusinessDependency.status, 'REJECTED');
  if (crossBusinessDependency.status !== 'REJECTED') {
    throw new Error('S6_EXPECTED_CROSS_BUSINESS_DEPENDENCY_REJECTION');
  }
  assert.equal(crossBusinessDependency.code, 'NOT_FOUND');
  assert.equal(
    await reads.getOffering(businessVet, 'off_s6_vet_invalid_cross_dependency'),
    undefined,
  );

  assert.ok(autoOfferingByCode);
  assert.ok(vetOfferingByCode);

  const autoContext = {
    facts: { vehicle: { type: 'sedan' } },
    satisfiedRequirementCodes: ['vehicle-profile'],
  } as const;
  const vetContext = {
    facts: { pet: { species: 'dog' } },
    satisfiedRequirementCodes: ['pet-profile'],
  } as const;

  const autoRecommendationA = recommendOfferings([autoOfferingByCode], autoContext);
  const autoRecommendationB = recommendOfferings([autoOfferingByCode], autoContext);
  const vetRecommendationA = recommendOfferings([vetOfferingByCode], vetContext);
  const vetRecommendationB = recommendOfferings([vetOfferingByCode], vetContext);

  assert.deepEqual(autoRecommendationA, autoRecommendationB);
  assert.deepEqual(vetRecommendationA, vetRecommendationB);
  assert.equal(autoRecommendationA.recommendations.length, 1);
  assert.equal(vetRecommendationA.recommendations.length, 1);

  const commandScopeRows = await pool.query<{ business_slug: string; count: string }>(
    `SELECT business_slug, COUNT(*)::text AS count
       FROM service_mutation_commands
      WHERE operation = 'CreateService'
        AND business_slug IN ($1, $2)
      GROUP BY business_slug
      ORDER BY business_slug ASC`,
    [businessAuto, businessVet],
  );
  assert.deepEqual(
    commandScopeRows.rows.map((row) => [row.business_slug, Number(row.count)]),
    [[businessAuto, 1], [businessVet, 1]],
  );

  const audit = mongo.db(config.mongoDb).collection('services_mutation_audit');
  const auditCount = await audit.countDocuments({ workflowId: { $in: workflowIds } });
  assert.equal(auditCount, workflowIds.length);

  console.log(`SERVICES_S6_MULTIBUSINESS_PASS ${JSON.stringify({
    businesses: [businessAuto, businessVet],
    sharedServiceCode: 'primary-service',
    sharedOfferingCode: 'standard',
    businessScopedReads: true,
    businessScopedIdempotency: true,
    crossBusinessDependencyRejected: true,
    deterministicEligibility: true,
    autoDurationMinutes: autoOfferingByCode.durationMinutes,
    vetDurationMinutes: vetOfferingByCode.durationMinutes,
    workflowAuditCount: auditCount,
  })}`);

  await mongo.close();
  await pool.end();
  await connection.close();
}

run().catch((error: unknown) => {
  console.error(`SERVICES_S6_MULTIBUSINESS_FAILED ${JSON.stringify({
    error: error instanceof Error ? error.stack ?? error.message : String(error),
  })}`);
  process.exitCode = 1;
});
