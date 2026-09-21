import assert from 'node:assert/strict';
import { Client, Connection } from '@temporalio/client';
import { loadRuntimeConfig } from '../src/config/runtime-config.js';
import type {
  ServicesMutationCommand,
  ServicesMutationOutcome,
  ServicesSnapshotConsumerState,
} from '../src/contracts/services-engine/index.js';
import { servicesManagementWorkflow } from '../src/orchestration/temporal/workflows/services-management.workflow.js';
import {
  getServicesSnapshotConsumerStateQuery,
  servicesSnapshotConsumerWorkflow,
} from '../src/orchestration/temporal/workflows/services-snapshot-consumer.workflow.js';

const BUSINESS = 's5-snapshot-business';
const SERVICE_ID = 'svc_s5_snapshot';
const OFFERING_ID = 'off_s5_snapshot';
const ORIGINAL_WORKFLOW_ID = 'mk1-s5:snapshot:original';

async function waitForWaiting(
  client: Client,
  workflowId: string,
  timeoutMs = 15_000,
): Promise<ServicesSnapshotConsumerState> {
  const handle = client.workflow.getHandle(workflowId);
  const deadline = Date.now() + timeoutMs;
  let last: ServicesSnapshotConsumerState | undefined;
  while (Date.now() < deadline) {
    try {
      last = await handle.query(getServicesSnapshotConsumerStateQuery);
      if (last.phase === 'WAITING' && last.snapshot) return last;
    } catch {
      // Workflow may not yet have installed its Query handler.
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`S5_WAITING_TIMEOUT:${JSON.stringify(last)}`);
}

async function executeManagement(
  client: Client,
  workflowId: string,
  taskQueue: string,
  command: ServicesMutationCommand,
): Promise<ServicesMutationOutcome> {
  return client.workflow.execute(servicesManagementWorkflow, {
    workflowId,
    taskQueue,
    args: [command],
  });
}

async function run(): Promise<void> {
  const config = loadRuntimeConfig();
  const connection = await Connection.connect({ address: config.temporalAddress });
  const client = new Client({ connection, namespace: config.temporalNamespace });

  const createService = await executeManagement(client, 'mk1-s5:mutation:create-service', config.temporalTaskQueue, {
    operation: 'CreateService',
    businessSlug: BUSINESS,
    idempotencyKey: 's5-create-service',
    service: {
      serviceId: SERVICE_ID,
      code: 'snapshot-service',
      name: 'Snapshot Service N1',
      description: 'S5 revision N fixture',
      tags: ['n1'],
    },
  });
  assert.equal(createService.status, 'APPLIED');
  assert.equal(createService.revision, 1);

  const createOffering = await executeManagement(client, 'mk1-s5:mutation:create-offering', config.temporalTaskQueue, {
    operation: 'CreateOffering',
    businessSlug: BUSINESS,
    idempotencyKey: 's5-create-offering',
    offering: {
      offeringId: OFFERING_ID,
      serviceId: SERVICE_ID,
      code: 'snapshot-offering',
      name: 'Snapshot Offering N1',
      description: 'Original semantics',
      durationMinutes: 30,
      pricing: { kind: 'FIXED', amountMinor: 1000, currency: 'PEN' },
      priority: 10,
      tags: ['n1'],
      requirements: [
        {
          code: 'phone-required',
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
  assert.equal(createOffering.status, 'APPLIED');
  assert.equal(createOffering.revision, 1);

  await client.workflow.start(servicesSnapshotConsumerWorkflow, {
    workflowId: ORIGINAL_WORKFLOW_ID,
    taskQueue: config.temporalTaskQueue,
    args: [{ businessSlug: BUSINESS, offeringIdOrCode: OFFERING_ID }],
  });

  const initial = await waitForWaiting(client, ORIGINAL_WORKFLOW_ID);
  assert.ok(initial.snapshot);
  assert.equal(initial.snapshot.service.revision, 1);
  assert.equal(initial.snapshot.service.name, 'Snapshot Service N1');
  assert.equal(initial.snapshot.offering.revision, 1);
  assert.equal(initial.snapshot.offering.name, 'Snapshot Offering N1');
  assert.equal(initial.snapshot.offering.durationMinutes, 30);
  assert.deepEqual(initial.snapshot.offering.pricing, { kind: 'FIXED', amountMinor: 1000, currency: 'PEN' });
  assert.equal(initial.snapshot.offering.requirements[0]?.code, 'phone-required');
  assert.equal(initial.snapshot.offering.eligibilityRuleSet?.failureCode, 'VEHICLE_TYPE_REQUIRED');

  const updateService = await executeManagement(client, 'mk1-s5:mutation:update-service', config.temporalTaskQueue, {
    operation: 'UpdateService',
    businessSlug: BUSINESS,
    idempotencyKey: 's5-update-service-n2',
    serviceId: SERVICE_ID,
    expectedRevision: 1,
    patch: {
      name: 'Snapshot Service N2',
      description: 'S5 revision N+1 fixture',
      tags: ['n2'],
    },
  });
  assert.equal(updateService.status, 'APPLIED');
  assert.equal(updateService.revision, 2);

  const updateOffering = await executeManagement(client, 'mk1-s5:mutation:update-offering', config.temporalTaskQueue, {
    operation: 'UpdateOffering',
    businessSlug: BUSINESS,
    idempotencyKey: 's5-update-offering-n2',
    offeringId: OFFERING_ID,
    expectedRevision: 1,
    patch: {
      name: 'Snapshot Offering N2',
      description: 'Changed semantics',
      durationMinutes: 45,
      pricing: { kind: 'FIXED', amountMinor: 2000, currency: 'PEN' },
      priority: 20,
      tags: ['n2'],
      requirements: [
        {
          code: 'email-required',
          kind: 'CUSTOMER_DATA',
          required: true,
          config: { path: 'customer.email' },
        },
      ],
      eligibilityRuleSet: {
        mode: 'ALL',
        predicates: [{ path: 'customer.vip', operator: 'EQ', value: true }],
        failureCode: 'VIP_REQUIRED',
      },
    },
  });
  assert.equal(updateOffering.status, 'APPLIED');
  assert.equal(updateOffering.revision, 2);

  const afterCatalogChange = await client.workflow
    .getHandle(ORIGINAL_WORKFLOW_ID)
    .query(getServicesSnapshotConsumerStateQuery);
  assert.ok(afterCatalogChange.snapshot);
  assert.equal(afterCatalogChange.phase, 'WAITING');
  assert.equal(afterCatalogChange.snapshot.service.revision, 1);
  assert.equal(afterCatalogChange.snapshot.service.name, 'Snapshot Service N1');
  assert.equal(afterCatalogChange.snapshot.offering.revision, 1);
  assert.equal(afterCatalogChange.snapshot.offering.name, 'Snapshot Offering N1');
  assert.equal(afterCatalogChange.snapshot.offering.durationMinutes, 30);
  assert.deepEqual(afterCatalogChange.snapshot.offering.pricing, { kind: 'FIXED', amountMinor: 1000, currency: 'PEN' });
  assert.equal(afterCatalogChange.snapshot.offering.requirements[0]?.code, 'phone-required');
  assert.equal(afterCatalogChange.snapshot.offering.eligibilityRuleSet?.failureCode, 'VEHICLE_TYPE_REQUIRED');

  console.log(`SERVICES_S5_PRE_RESTART_PASS ${JSON.stringify({
    workflowId: ORIGINAL_WORKFLOW_ID,
    originalServiceRevision: afterCatalogChange.snapshot.service.revision,
    originalOfferingRevision: afterCatalogChange.snapshot.offering.revision,
    publishedServiceRevision: updateService.revision,
    publishedOfferingRevision: updateOffering.revision,
    mutableHeadDidNotChangeWaitingSnapshot: true,
  })}`);

  await connection.close();
}

run().catch((error: unknown) => {
  console.error(`SERVICES_S5_PREPARE_FAILED ${JSON.stringify({
    error: error instanceof Error ? error.stack ?? error.message : String(error),
  })}`);
  process.exitCode = 1;
});
