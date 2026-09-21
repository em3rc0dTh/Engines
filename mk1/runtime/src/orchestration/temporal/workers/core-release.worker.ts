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
import type { PostgresRegistrationActivities } from '../activities/postgres-registration.types.js';
import type { MongoRegistrationAuditActivities } from '../activities/mongo-registration-audit.types.js';
import { assertMk0TemporalTopology, temporalTopologyFrom } from '../topology.js';

function integerEnv(name: string): number {
  const raw = process.env[name]?.trim();
  if (!raw) return 0;
  const value = Number.parseInt(raw, 10);
  if (!Number.isFinite(value) || value < 0) throw new Error(`${name} must be a non-negative integer`);
  return value;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function run(): Promise<void> {
  const topology = temporalTopologyFrom(loadRuntimeConfig());
  assertMk0TemporalTopology(topology);
  const connection = await NativeConnection.connect({ address: topology.address });

  let postgresCreateFailuresRemaining = integerEnv('CORE_FAIL_POSTGRES_CREATE_ATTEMPTS');
  const postgresCreateFailureName = process.env.CORE_FAIL_POSTGRES_CREATE_NAME?.trim();
  const customerCreatedAuditDelayMs = integerEnv('CORE_DELAY_CUSTOMER_CREATED_AUDIT_MS');

  const postgresActivities: PostgresRegistrationActivities = {
    ...postgresRegistrationActivities,
    async createCustomer(input) {
      const matches = !postgresCreateFailureName || input.customer.name === postgresCreateFailureName;
      if (matches && postgresCreateFailuresRemaining > 0) {
        const injectedAttempt = integerEnv('CORE_FAIL_POSTGRES_CREATE_ATTEMPTS') - postgresCreateFailuresRemaining + 1;
        postgresCreateFailuresRemaining -= 1;
        console.warn(
          `CORE_POSTGRES_CREATE_INJECTED_FAILURE ${JSON.stringify({
            customerName: input.customer.name ?? null,
            injectedAttempt,
            remaining: postgresCreateFailuresRemaining,
          })}`,
        );
        throw new Error('POSTGRES_CUSTOMER_STORE_UNAVAILABLE:forced-core-certification-transient');
      }
      return postgresRegistrationActivities.createCustomer(input);
    },
  };

  const mongoActivities: MongoRegistrationAuditActivities = {
    ...mongoRegistrationAuditActivities,
    async persistRegistrationAudit(input) {
      if (
        customerCreatedAuditDelayMs > 0 &&
        input.events.some((event) => event.eventType === 'CUSTOMER_CREATED')
      ) {
        console.warn(
          `CORE_CUSTOMER_CREATED_AUDIT_DELAYING ${JSON.stringify({
            delayMs: customerCreatedAuditDelayMs,
            workflowId: input.events[0]?.workflowId ?? null,
          })}`,
        );
        await delay(customerCreatedAuditDelayMs);
      }
      return mongoRegistrationAuditActivities.persistRegistrationAudit(input);
    },
  };

  try {
    const workflowsPath = fileURLToPath(new URL('../workflows/b6.workflows.ts', import.meta.url));
    const worker = await Worker.create({
      connection,
      namespace: topology.namespace,
      taskQueue: topology.taskQueue,
      workflowsPath,
      activities: {
        ...postgresActivities,
        ...mongoActivities,
      },
    });

    console.log(
      `CORE_RELEASE_WORKER_STARTED ${JSON.stringify({
        temporalAddress: topology.address,
        namespace: topology.namespace,
        taskQueue: topology.taskQueue,
        postgresCreateFailuresRemaining,
        postgresCreateFailureName: postgresCreateFailureName ?? null,
        customerCreatedAuditDelayMs,
        pid: process.pid,
      })}`,
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
    `CORE_RELEASE_WORKER_FAILED ${JSON.stringify({
      error: error instanceof Error ? error.message : String(error),
    })}`,
  );
  process.exitCode = 1;
});
