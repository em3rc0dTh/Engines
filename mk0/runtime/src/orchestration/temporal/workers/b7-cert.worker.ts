import { fileURLToPath } from 'node:url';
import { NativeConnection, Worker } from '@temporalio/worker';
import { loadRuntimeConfig } from '../../../config/runtime-config.js';
import {
  attachmentStoreActivities,
  closeAttachmentStoreActivities,
} from '../activities/attachment-store.activities.js';
import type { AttachmentStoreActivities } from '../activities/attachment-store.types.js';
import {
  closeMongoRegistrationAuditActivities,
  mongoRegistrationAuditActivities,
} from '../activities/mongo-registration-audit.activities.js';
import {
  closePostgresRegistrationActivities,
  postgresRegistrationActivities,
} from '../activities/postgres-registration.activities.js';
import { assertMk0TemporalTopology, temporalTopologyFrom } from '../topology.js';

function nonNegativeInteger(value: string | undefined): number {
  if (!value?.trim()) return 0;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

async function run(): Promise<void> {
  const topology = temporalTopologyFrom(loadRuntimeConfig());
  assertMk0TemporalTopology(topology);

  let attachmentCommitFailuresRemaining = nonNegativeInteger(
    process.env.B7_FAIL_ATTACHMENT_COMMIT_ATTEMPTS,
  );
  const targetIngressRef = process.env.B7_FAIL_ATTACHMENT_INGRESS_REF?.trim();

  const certificationAttachmentActivities: AttachmentStoreActivities = {
    ...attachmentStoreActivities,
    async commitAttachment(input) {
      if (
        attachmentCommitFailuresRemaining > 0 &&
        (!targetIngressRef || input.ingressRef === targetIngressRef)
      ) {
        const injectedAttempt =
          nonNegativeInteger(process.env.B7_FAIL_ATTACHMENT_COMMIT_ATTEMPTS) -
          attachmentCommitFailuresRemaining +
          1;
        attachmentCommitFailuresRemaining -= 1;
        console.warn(
          `B7_ATTACHMENT_COMMIT_INJECTED_FAILURE ${JSON.stringify({
            ingressRef: input.ingressRef,
            injectedAttempt,
            remaining: attachmentCommitFailuresRemaining,
          })}`,
        );
        throw new Error('ATTACHMENT_STORE_UNAVAILABLE:forced-b7-certification-transient');
      }
      return attachmentStoreActivities.commitAttachment(input);
    },
  };

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
        ...certificationAttachmentActivities,
      },
    });

    console.log(
      `B7_CERT_WORKER_STARTED ${JSON.stringify({
        temporalAddress: topology.address,
        namespace: topology.namespace,
        taskQueue: topology.taskQueue,
        targetIngressRef: targetIngressRef ?? null,
        attachmentCommitFailuresRemaining,
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
    `B7_CERT_WORKER_FAILED ${JSON.stringify({
      error: error instanceof Error ? error.message : String(error),
    })}`,
  );
  process.exitCode = 1;
});
