import { fileURLToPath } from 'node:url';
import { NativeConnection, Worker } from '@temporalio/worker';
import { loadRuntimeConfig } from '../../../config/runtime-config.js';

async function run(): Promise<void> {
  const config = loadRuntimeConfig();
  const connection = await NativeConnection.connect({
    address: config.temporalAddress,
  });

  try {
    const workflowsPath = fileURLToPath(
      new URL('../workflows/b0-smoke.workflow.ts', import.meta.url),
    );

    const worker = await Worker.create({
      connection,
      namespace: config.temporalNamespace,
      taskQueue: config.temporalTaskQueue,
      workflowsPath,
      activities: {},
    });

    console.log(
      JSON.stringify({
        event: 'B0_WORKER_STARTED',
        temporalAddress: config.temporalAddress,
        namespace: config.temporalNamespace,
        taskQueue: config.temporalTaskQueue,
      }),
    );

    await worker.run();
  } finally {
    await connection.close();
  }
}

run().catch((error: unknown) => {
  console.error(
    JSON.stringify({
      event: 'B0_WORKER_FAILED',
      error: error instanceof Error ? error.message : String(error),
    }),
  );
  process.exitCode = 1;
});
