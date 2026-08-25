import { fileURLToPath } from 'node:url';
import { NativeConnection, Worker } from '@temporalio/worker';
import { loadRuntimeConfig } from '../../../config/runtime-config.js';
import {
  attachmentStoreActivities,
  closeAttachmentStoreActivities,
} from '../activities/attachment-store.activities.js';
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
    const workflowsPath = fileURLToPath(new URL('../workflows/b7.workflows.ts', import.meta.url));
    const worker = await Worker.create({
      connection,
      namespace: topology.namespace,
      taskQueue: topology.taskQueue,
      workflowsPath,
      activities: {
        ...postgresRegistrationActivities,
        ...mongoRegistrationAuditActivities,
        ...attachmentStoreActivities,
      },
    });

    console.log(
      `B7_WORKER_STARTED ${JSON.stringify({
        temporalAddress: topology.address,
        namespace: topology.namespace,
        taskQueue: topology.taskQueue,
        attachmentStoreRoot: loadRuntimeConfig().attachmentStoreRoot,
        pid: process.pid,
      })}`,
    );

    await worker.run();
  } finally {
    await Promise.all([
      closePostgresRegistrationActivities(),
      closeMongoRegistrationAuditActivities(),
      closeAttachmentStoreActivities(),
    ]);
    await connection.close();
  }
}

run().catch((error: unknown) => {
  console.error(
    `B7_WORKER_FAILED ${JSON.stringify({
      error: error instanceof Error ? error.message : String(error),
    })}`,
  );
  process.exitCode = 1;
});
