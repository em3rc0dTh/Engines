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

async function run(): Promise<void> {
  const config = loadRuntimeConfig();
  const connection = await Connection.connect({ address: config.temporalAddress });
  const client = new Client({ connection, namespace: config.temporalNamespace });
  const pool = new Pool({ connectionString: config.postgresUrl, max: 2 });
  const mongo = new MongoClient(config.mongoUrl, { maxPoolSize: 2 });
  await mongo.connect();

  const workflowIds: string[] = [];
  async function execute(label: string, command: ServicesMutationCommand): Promise<ServicesMutationOutcome> {
    const workflowId = `mk1-s4:${label}:${randomUUID()}`;
    workflowIds.push(workflowId);
    return client.workflow.execute<(input: ServicesMutationCommand) => Promise<ServicesMutationOutcome>>(
      'servicesManagementWorkflow',
      {
        workflowId,
        taskQueue: config.temporalTaskQueue,
        args: [command],
      },
    );
  }

  const serviceA: ServicesMutationCommand = {
    operation: 'CreateService',
    businessSlug: 's4-business-a',
    idempotencyKey: 'shared-create-service-key',
    service: {
      serviceId: 'svc_s4_business_a',
      code: 'vehicle-care',
      name: 'Vehicle Care',
      description: 'Versioned S4 management fixture',
      tags: ['vehicle', 'care'],
    },
  };

  const serviceB: ServicesMutationCommand = {
    operation: 'CreateService',
    businessSlug: 's4-business-b',
    idempotencyKey: 'shared-create-service-key',
    service: {
      serviceId: 'svc_s4_business_b',
      code: 'consultation',
      name: 'Consultation',
      tags: ['consulting'],
    },
  };

  const createA = await execute('create-a', serviceA);
  assert.equal(createA.status, 'APPLIED');
  assert.equal(createA.revision, 1);

  const replayA = await execute('replay-a', serviceA);
  assert.equal(replayA.status, 'REPLAYED');
  assert.equal(replayA.revision, 1);

  const materialConflict = await execute('material-conflict-a', {
    ...serviceA,
    service: { ...serviceA.service, name: 'Different Material' },
  });
  assert.equal(materialConflict.status, 'REJECTED');
  if (materialConflict.status !== 'REJECTED') throw new Error('S4_EXPECTED_MATERIAL_CONFLICT');
  assert.equal(materialConflict.code, 'IDEMPOTENCY_CONFLICT');

  const createB = await execute('create-b', serviceB);
  assert.equal(createB.status, 'APPLIED');
  assert.equal(createB.revision, 1);

  const updateService = await execute('update-service-a', {
    operation: 'UpdateService',
    businessSlug: 's4-business-a',
    idempotencyKey: 'update-service-a-v1',
    serviceId: 'svc_s4_business_a',
    expectedRevision: 1,
    patch: {
      name: 'Vehicle Care Plus',
      tags: ['vehicle', 'care', 'plus'],
    },
  });
  assert.equal(updateService.status, 'APPLIED');
  assert.equal(updateService.revision, 2);

  const offeringCreate = await execute('create-offering-a', {
    operation: 'CreateOffering',
    businessSlug: 's4-business-a',
    idempotencyKey: 'create-offering-a',
    offering: {
      offeringId: 'off_s4_vehicle_care_basic',
      serviceId: 'svc_s4_business_a',
      code: 'basic-care',
      name: 'Basic Care',
      durationMinutes: 45,
      pricing: { kind: 'FIXED', amountMinor: 4500, currency: 'PEN' },
      priority: 10,
      tags: ['basic'],
      requirements: [
        {
          code: 'customer-phone',
          kind: 'CUSTOMER_DATA',
          required: true,
          config: { path: 'customer.phone' },
        },
      ],
      dependencies: [],
      eligibilityRuleSet: {
        mode: 'ALL',
        predicates: [{ path: 'vehicle.type', operator: 'EXISTS' }],
        failureCode: 'VEHICLE_TYPE_REQUIRED',
      },
    },
  });
  assert.equal(offeringCreate.status, 'APPLIED');
  assert.equal(offeringCreate.revision, 1);

  const offeringUpdate = await execute('update-offering-a', {
    operation: 'UpdateOffering',
    businessSlug: 's4-business-a',
    idempotencyKey: 'update-offering-a-v1',
    offeringId: 'off_s4_vehicle_care_basic',
    expectedRevision: 1,
    patch: {
      durationMinutes: 60,
      pricing: { kind: 'FROM', amountMinor: 5500, currency: 'PEN' },
      priority: 20,
    },
  });
  assert.equal(offeringUpdate.status, 'APPLIED');
  assert.equal(offeringUpdate.revision, 2);

  const staleOffering = await execute('stale-offering-a', {
    operation: 'UpdateOffering',
    businessSlug: 's4-business-a',
    idempotencyKey: 'stale-offering-a',
    offeringId: 'off_s4_vehicle_care_basic',
    expectedRevision: 1,
    patch: { durationMinutes: 30 },
  });
  assert.equal(staleOffering.status, 'REJECTED');
  if (staleOffering.status !== 'REJECTED') throw new Error('S4_EXPECTED_STALE_OFFERING_REJECTION');
  assert.equal(staleOffering.code, 'REVISION_CONFLICT');
  assert.equal(staleOffering.currentRevision, 2);

  const offeringStatus = await execute('status-offering-a', {
    operation: 'SetOfferingStatus',
    businessSlug: 's4-business-a',
    idempotencyKey: 'status-offering-a-v2',
    offeringId: 'off_s4_vehicle_care_basic',
    expectedRevision: 2,
    status: 'INACTIVE',
  });
  assert.equal(offeringStatus.status, 'APPLIED');
  assert.equal(offeringStatus.revision, 3);

  const staleService = await execute('stale-service-a', {
    operation: 'UpdateService',
    businessSlug: 's4-business-a',
    idempotencyKey: 'stale-service-a',
    serviceId: 'svc_s4_business_a',
    expectedRevision: 1,
    patch: { name: 'Must Not Win' },
  });
  assert.equal(staleService.status, 'REJECTED');
  if (staleService.status !== 'REJECTED') throw new Error('S4_EXPECTED_STALE_SERVICE_REJECTION');
  assert.equal(staleService.code, 'REVISION_CONFLICT');
  assert.equal(staleService.currentRevision, 2);

  const serviceStatus = await execute('status-service-a', {
    operation: 'SetServiceStatus',
    businessSlug: 's4-business-a',
    idempotencyKey: 'status-service-a-v2',
    serviceId: 'svc_s4_business_a',
    expectedRevision: 2,
    status: 'INACTIVE',
  });
  assert.equal(serviceStatus.status, 'APPLIED');
  assert.equal(serviceStatus.revision, 3);

  const serviceRows = await pool.query<{
    service_id: string;
    service_name: string;
    revision: number;
    active: boolean;
  }>(
    `SELECT service_id, service_name, revision, active
       FROM service_catalog
      WHERE service_id IN ('svc_s4_business_a', 'svc_s4_business_b')
      ORDER BY service_id ASC`,
  );
  assert.equal(serviceRows.rowCount, 2);
  const finalServiceA = serviceRows.rows.find((row) => row.service_id === 'svc_s4_business_a');
  assert.ok(finalServiceA);
  assert.equal(finalServiceA.service_name, 'Vehicle Care Plus');
  assert.equal(finalServiceA.revision, 3);
  assert.equal(finalServiceA.active, false);

  const offeringRows = await pool.query<{
    product_id: string;
    duration_minutes: number;
    price_kind: string;
    price_amount_minor: string | number | null;
    revision: number;
    active: boolean;
  }>(
    `SELECT product_id, duration_minutes, price_kind, price_amount_minor, revision, active
       FROM service_products
      WHERE product_id = 'off_s4_vehicle_care_basic'`,
  );
  assert.equal(offeringRows.rowCount, 1);
  const finalOffering = offeringRows.rows[0]!;
  assert.equal(finalOffering.duration_minutes, 60);
  assert.equal(finalOffering.price_kind, 'FROM');
  assert.equal(Number(finalOffering.price_amount_minor), 5500);
  assert.equal(finalOffering.revision, 3);
  assert.equal(finalOffering.active, false);

  const createCommandRows = await pool.query<{ count: string }>(
    `SELECT COUNT(*)::text AS count
       FROM service_mutation_commands
      WHERE operation = 'CreateService'
        AND business_slug = 's4-business-a'
        AND entity_id = 'svc_s4_business_a'`,
  );
  assert.equal(Number(createCommandRows.rows[0]!.count), 1);

  const auditCollection = mongo.db(config.mongoDb).collection('services_mutation_audit');
  const auditCount = await auditCollection.countDocuments({ workflowId: { $in: workflowIds } });
  assert.equal(auditCount, workflowIds.length);

  console.log(`SERVICES_S4_MANAGEMENT_PASS ${JSON.stringify({
    workflows: workflowIds.length,
    exactReplay: replayA.status === 'REPLAYED',
    materialConflict: materialConflict.status === 'REJECTED' && materialConflict.code === 'IDEMPOTENCY_CONFLICT',
    businessScopedIdempotency: createA.status === 'APPLIED' && createB.status === 'APPLIED',
    serviceRevision: finalServiceA.revision,
    offeringRevision: finalOffering.revision,
    staleServiceRejected: staleService.status === 'REJECTED',
    staleOfferingRejected: staleOffering.status === 'REJECTED',
    auditCompleteBeforeResults: auditCount === workflowIds.length,
  })}`);

  await mongo.close();
  await pool.end();
  await connection.close();
}

run().catch((error: unknown) => {
  console.error(`SERVICES_S4_MANAGEMENT_FAILED ${JSON.stringify({
    error: error instanceof Error ? error.stack ?? error.message : String(error),
  })}`);
  process.exitCode = 1;
});
