import { fileURLToPath } from 'node:url';
import { NativeConnection, Worker } from '@temporalio/worker';
import { loadRuntimeConfig } from '../../../config/runtime-config.js';
import {
  closeMongoRegistrationAuditActivities,
  mongoRegistrationAuditActivities,
} from '../activities/mongo-registration-audit.activities.js';
import {
  closePostgresRegistrationActivities,
  postgresRegistrationActivities,
} from '../activities/postgres-registration.activities.js';
import { assertMk0TemporalTopology, temporalTopologyFrom } from '../topology.js';

async function run(): Promise<void> {
  const topology = temporalTopologyFrom(loadRuntimeConfig());
  assertMk0TemporalTopology(topology);
  const connection = await NativeConnection.connect({ address: topology.address });

  try {
    const workflowsPath = fileURLToPath(new URL('../workflows/b6.workflows.ts', import.meta.url));
    const worker = await Worker.create({
      connection,
      namespace: topology.namespace,
      taskQueue: topology.taskQueue,
      workflowsPath,
      activities: {
        ...postgresRegistrationActivities,
        ...mongoRegistrationAuditActivities,
      },
    });

    console.log(
      JSON.stringify({
        event: 'B6_WORKER_STARTED',
        temporalAddress: topology.address,
        namespace: topology.namespace,
        taskQueue: topology.taskQueue,
        forcedMongoAuditFailure: process.env.B6_FORCE_MONGO_AUDIT_FAILURE === '1',
        pid: process.pid,
      }),
    );

    await worker.run();
  } finally {
    await Promise.all([
      closePostgresRegistrationActivities(),
      closeMongoRegistrationAuditActivities(),
    ]);
    await connection.close();
  }
}

run().catch((error: unknown) => {
  console.error(
    JSON.stringify({
      event: 'B6_WORKER_FAILED',
      error: error instanceof Error ? error.message : String(error),
    }),
  );
  process.exitCode = 1;
});
