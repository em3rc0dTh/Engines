import { fileURLToPath } from 'node:url';
import { NativeConnection, Worker } from '@temporalio/worker';
import { loadRuntimeConfig } from '../../../config/runtime-config.js';
import { assertMk0TemporalTopology, temporalTopologyFrom } from '../topology.js';

async function run(): Promise<void> {
  const config = loadRuntimeConfig();
  const topology = temporalTopologyFrom(config);
  assertMk0TemporalTopology(topology);

  const connection = await NativeConnection.connect({ address: topology.address });

  try {
    const workflowsPath = fileURLToPath(new URL('../workflows/b2.workflows.ts', import.meta.url));
    const worker = await Worker.create({
      connection,
      namespace: topology.namespace,
      taskQueue: topology.taskQueue,
      workflowsPath,
      activities: {},
    });

    console.log(
      JSON.stringify({
        event: 'B2_WORKER_STARTED',
        role: topology.workerRole,
        temporalAddress: topology.address,
        namespace: topology.namespace,
        taskQueue: topology.taskQueue,
        pid: process.pid,
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
      event: 'B2_WORKER_FAILED',
      error: error instanceof Error ? error.message : String(error),
    }),
  );
  process.exitCode = 1;
});
