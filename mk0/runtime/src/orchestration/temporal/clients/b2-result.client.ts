import { Client, Connection } from '@temporalio/client';
import { loadRuntimeConfig } from '../../../config/runtime-config.js';
import { temporalTopologyFrom, assertMk0TemporalTopology } from '../topology.js';
import type { B2ContinuityResult } from '../workflows/b2-continuity.workflow.js';

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

async function run(): Promise<void> {
  const config = loadRuntimeConfig();
  const topology = temporalTopologyFrom(config);
  assertMk0TemporalTopology(topology);

  const workflowId = requiredEnv('B2_WORKFLOW_ID');
  const runId = requiredEnv('B2_RUN_ID');

  const connection = await Connection.connect({ address: topology.address });
  const client = new Client({ connection, namespace: topology.namespace });

  try {
    const handle = client.workflow.getHandle(workflowId, runId);
    const result = (await handle.result()) as B2ContinuityResult;
    const description = await handle.describe();

    if (result.workflowId !== workflowId) {
      throw new Error(`Workflow ID changed: expected ${workflowId}, got ${result.workflowId}`);
    }
    if (result.runId !== runId) {
      throw new Error(`Run ID changed: expected ${runId}, got ${result.runId}`);
    }
    if (result.taskQueue !== topology.taskQueue) {
      throw new Error(`Task Queue changed: expected ${topology.taskQueue}, got ${result.taskQueue}`);
    }

    console.log(
      `B2_CONTINUITY_RESULT ${JSON.stringify({
        ok: true,
        workflowId,
        runId,
        probeId: result.probeId,
        phase: result.phase,
        taskQueue: result.taskQueue,
        status: description.status.name,
      })}`,
    );
  } finally {
    await connection.close();
  }
}

run().catch((error: unknown) => {
  console.error(
    `B2_CONTINUITY_RESULT_FAILED ${JSON.stringify({
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    })}`,
  );
  process.exitCode = 1;
});
