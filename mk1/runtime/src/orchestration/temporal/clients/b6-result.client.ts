import { Client, Connection } from '@temporalio/client';
import { loadRuntimeConfig } from '../../../config/runtime-config.js';
import type { RegistrationResult } from '../../../contracts/register-new-customer/index.js';
import { assertMk0TemporalTopology, temporalTopologyFrom } from '../topology.js';

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

async function run(): Promise<void> {
  const topology = temporalTopologyFrom(loadRuntimeConfig());
  assertMk0TemporalTopology(topology);
  const workflowId = requiredEnv('B4_WORKFLOW_ID');
  const runId = requiredEnv('B4_RUN_ID');
  const connection = await Connection.connect({ address: topology.address });
  const client = new Client({ connection, namespace: topology.namespace });

  try {
    const handle = client.workflow.getHandle(workflowId, runId);
    const result = (await handle.result()) as RegistrationResult;
    const description = await handle.describe();
    console.log(
      `B6_REGISTRATION_RESULT ${JSON.stringify({
        ok: true,
        workflowId,
        runId,
        status: description.status.name,
        result,
      })}`,
    );
  } finally {
    await connection.close();
  }
}

run().catch((error: unknown) => {
  console.error(
    `B6_REGISTRATION_RESULT_FAILED ${JSON.stringify({
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    })}`,
  );
  process.exitCode = 1;
});
