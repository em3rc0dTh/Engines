import assert from 'node:assert/strict';
import { Client, Connection } from '@temporalio/client';
import { loadRuntimeConfig } from '../src/config/runtime-config.js';
import type { ServicesSnapshotConsumerState } from '../src/contracts/services-engine/index.js';
import {
  continueServicesSnapshotSignal,
  getServicesSnapshotConsumerStateQuery,
  servicesSnapshotConsumerWorkflow,
} from '../src/orchestration/temporal/workflows/services-snapshot-consumer.workflow.js';

const BUSINESS = 's5-snapshot-business';
const OFFERING_ID = 'off_s5_snapshot';
const ORIGINAL_WORKFLOW_ID = 'mk1-s5:snapshot:original';
const NEW_WORKFLOW_ID = 'mk1-s5:snapshot:new';

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
      // Query handler may not be installed immediately after start/replay.
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`S5_WAITING_TIMEOUT:${workflowId}:${JSON.stringify(last)}`);
}

async function run(): Promise<void> {
  const config = loadRuntimeConfig();
  const connection = await Connection.connect({ address: config.temporalAddress });
  const client = new Client({ connection, namespace: config.temporalNamespace });

  const originalHandle = client.workflow.getHandle(ORIGINAL_WORKFLOW_ID);
  const afterRestart = await waitForWaiting(client, ORIGINAL_WORKFLOW_ID);
  assert.ok(afterRestart.snapshot);
  assert.equal(afterRestart.snapshot.service.revision, 1);
  assert.equal(afterRestart.snapshot.service.name, 'Snapshot Service N1');
  assert.equal(afterRestart.snapshot.offering.revision, 1);
  assert.equal(afterRestart.snapshot.offering.name, 'Snapshot Offering N1');
  assert.equal(afterRestart.snapshot.offering.durationMinutes, 30);
  assert.deepEqual(afterRestart.snapshot.offering.pricing, { kind: 'FIXED', amountMinor: 1000, currency: 'PEN' });
  assert.equal(afterRestart.snapshot.offering.requirements[0]?.code, 'phone-required');
  assert.equal(afterRestart.snapshot.offering.eligibilityRuleSet?.failureCode, 'VEHICLE_TYPE_REQUIRED');

  const newHandle = await client.workflow.start(servicesSnapshotConsumerWorkflow, {
    workflowId: NEW_WORKFLOW_ID,
    taskQueue: config.temporalTaskQueue,
    args: [{ businessSlug: BUSINESS, offeringIdOrCode: OFFERING_ID }],
  });
  const newState = await waitForWaiting(client, NEW_WORKFLOW_ID);
  assert.ok(newState.snapshot);
  assert.equal(newState.snapshot.service.revision, 2);
  assert.equal(newState.snapshot.service.name, 'Snapshot Service N2');
  assert.equal(newState.snapshot.offering.revision, 2);
  assert.equal(newState.snapshot.offering.name, 'Snapshot Offering N2');
  assert.equal(newState.snapshot.offering.durationMinutes, 45);
  assert.deepEqual(newState.snapshot.offering.pricing, { kind: 'FIXED', amountMinor: 2000, currency: 'PEN' });
  assert.equal(newState.snapshot.offering.requirements[0]?.code, 'email-required');
  assert.equal(newState.snapshot.offering.eligibilityRuleSet?.failureCode, 'VIP_REQUIRED');

  await originalHandle.signal(continueServicesSnapshotSignal);
  await newHandle.signal(continueServicesSnapshotSignal);

  const originalResult = await originalHandle.result();
  const newResult = await newHandle.result();

  assert.equal(originalResult.status, 'COMPLETED');
  assert.equal(originalResult.snapshot.service.revision, 1);
  assert.equal(originalResult.snapshot.offering.revision, 1);
  assert.equal(originalResult.snapshot.offering.durationMinutes, 30);
  assert.equal(originalResult.snapshot.offering.requirements[0]?.code, 'phone-required');
  assert.equal(originalResult.snapshot.offering.eligibilityRuleSet?.failureCode, 'VEHICLE_TYPE_REQUIRED');

  assert.equal(newResult.status, 'COMPLETED');
  assert.equal(newResult.snapshot.service.revision, 2);
  assert.equal(newResult.snapshot.offering.revision, 2);
  assert.equal(newResult.snapshot.offering.durationMinutes, 45);
  assert.equal(newResult.snapshot.offering.requirements[0]?.code, 'email-required');
  assert.equal(newResult.snapshot.offering.eligibilityRuleSet?.failureCode, 'VIP_REQUIRED');

  console.log(`SERVICES_S5_SNAPSHOT_PASS ${JSON.stringify({
    originalSurvivedWorkerRestart: true,
    originalServiceRevision: originalResult.snapshot.service.revision,
    originalOfferingRevision: originalResult.snapshot.offering.revision,
    newServiceRevision: newResult.snapshot.service.revision,
    newOfferingRevision: newResult.snapshot.offering.revision,
    originalCompletedWithFrozenSemantics: true,
    newWorkflowObservedCatalogHead: true,
  })}`);

  await connection.close();
}

run().catch((error: unknown) => {
  console.error(`SERVICES_S5_COMPLETE_FAILED ${JSON.stringify({
    error: error instanceof Error ? error.stack ?? error.message : String(error),
  })}`);
  process.exitCode = 1;
});
