import { existsSync, unlinkSync, writeFileSync } from 'node:fs';
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
import {
  appointmentActivities,
  closeAppointmentActivities,
} from '../activities/appointment.activities.js';
import {
  appointmentAuditActivities,
  closeAppointmentAuditActivities,
} from '../activities/appointment-audit.activities.js';
import {
  closeServicesManagementActivities,
  servicesManagementActivities,
} from '../activities/services-management.activities.js';
import {
  closeServicesAuditActivities,
  servicesAuditActivities,
} from '../activities/services-audit.activities.js';
import {
  closeServicesReadActivities,
  servicesReadActivities,
} from '../activities/services-read.activities.js';
import { assertMk0TemporalTopology, temporalTopologyFrom } from '../topology.js';

const READY_FILE = process.env.ENGINES_WORKER_READY_FILE ?? '/tmp/engines-mk0-worker-ready';

async function run(): Promise<void> {
  const topology = temporalTopologyFrom(loadRuntimeConfig());
  assertMk0TemporalTopology(topology);
  const connection = await NativeConnection.connect({ address: topology.address });

  try {
    const workflowsPath = fileURLToPath(new URL('../workflows/appointment.workflows.ts', import.meta.url));
    const worker = await Worker.create({
      connection,
      namespace: topology.namespace,
      taskQueue: topology.taskQueue,
      workflowsPath,
      activities: {
        ...postgresRegistrationActivities,
        ...mongoRegistrationAuditActivities,
        ...attachmentStoreActivities,
        ...appointmentActivities,
        ...appointmentAuditActivities,
        ...servicesReadActivities,
        ...servicesManagementActivities,
        ...servicesAuditActivities,
      },
    });

    writeFileSync(READY_FILE, `${process.pid}\n`, 'utf8');
    console.log(`APPOINTMENT_WORKER_STARTED ${JSON.stringify({
      temporalAddress: topology.address,
      namespace: topology.namespace,
      taskQueue: topology.taskQueue,
      attachmentStoreRoot: loadRuntimeConfig().attachmentStoreRoot,
      servicesRead: true,
      servicesManagement: true,
      readyFile: READY_FILE,
      pid: process.pid,
    })}`);

    await worker.run();
  } finally {
    if (existsSync(READY_FILE)) unlinkSync(READY_FILE);
    await Promise.all([
      closePostgresRegistrationActivities(),
      closeMongoRegistrationAuditActivities(),
      closeAttachmentStoreActivities(),
      closeAppointmentActivities(),
      closeAppointmentAuditActivities(),
      closeServicesReadActivities(),
      closeServicesManagementActivities(),
      closeServicesAuditActivities(),
    ]);
    await connection.close();
  }
}

run().catch((error: unknown) => {
  if (existsSync(READY_FILE)) unlinkSync(READY_FILE);
  console.error(`APPOINTMENT_WORKER_FAILED ${JSON.stringify({
    error: error instanceof Error ? error.message : String(error),
  })}`);
  process.exitCode = 1;
});
