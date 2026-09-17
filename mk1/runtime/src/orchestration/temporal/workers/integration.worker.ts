import { fileURLToPath } from 'node:url';
import { NativeConnection, Worker } from '@temporalio/worker';
import { loadRuntimeConfig } from '../../../config/runtime-config.js';
import { createRuntimeIntegrationDeliveryActivities } from '../activities/integration-delivery.activities.js';

const TASK_QUEUE = process.env.ENGINES_INTEGRATION_TASK_QUEUE?.trim() || 'engines-g3-integration';

async function run(): Promise<void> {
  const config = loadRuntimeConfig();
  const connection = await NativeConnection.connect({ address: config.temporalAddress });
  const runtime = createRuntimeIntegrationDeliveryActivities();

  try {
    const workflowsPath = fileURLToPath(new URL('../workflows/integration.workflows.ts', import.meta.url));
    const worker = await Worker.create({
      connection,
      namespace: config.temporalNamespace,
      taskQueue: TASK_QUEUE,
      workflowsPath,
      activities: runtime.activities,
    });

    console.log(`INTEGRATION_G3_TEMPORAL_WORKER_STARTED ${JSON.stringify({
      temporalAddress: config.temporalAddress,
      namespace: config.temporalNamespace,
      taskQueue: TASK_QUEUE,
    })}`);
    await worker.run();
  } finally {
    await runtime.close();
    await connection.close();
  }
}

run().catch((error: unknown) => {
  console.error(`INTEGRATION_G3_TEMPORAL_WORKER_FAILED ${JSON.stringify({
    error: error instanceof Error ? error.message : String(error),
  })}`);
  process.exitCode = 1;
});
