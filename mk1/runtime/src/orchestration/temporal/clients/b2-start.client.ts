import { randomUUID } from 'node:crypto';
import { Client, Connection } from '@temporalio/client';
import { loadRuntimeConfig } from '../../../config/runtime-config.js';
import { temporalTopologyFrom, assertMk0TemporalTopology } from '../topology.js';
import {
  b2ContinuitySmoke,
  b2ContinuityStateQuery,
  type B2ContinuityState,
} from '../workflows/b2-continuity.workflow.js';

const DEFAULT_DELAY_MS = 8_000;
const QUERY_RETRY_MS = 100;
const QUERY_TIMEOUT_MS = 10_000;

function positiveInteger(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`Expected positive integer, received: ${value}`);
  }
  return parsed;
}

async function waitForWaitingState(
  handle: ReturnType<Client['workflow']['getHandle']>,
): Promise<B2ContinuityState> {
  const startedAt = Date.now();
  let lastError: unknown;

  while (Date.now() - startedAt < QUERY_TIMEOUT_MS) {
    try {
      const state = await handle.query(b2ContinuityStateQuery);
      if (state.phase === 'WAITING_ON_TEMPORAL_TIMER') return state;
    } catch (error: unknown) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, QUERY_RETRY_MS));
  }

  throw new Error(
    `B2 Workflow did not reach WAITING_ON_TEMPORAL_TIMER within ${QUERY_TIMEOUT_MS}ms${
      lastError instanceof Error ? `: ${lastError.message}` : ''
    }`,
  );
}

async function run(): Promise<void> {
  const config = loadRuntimeConfig();
  const topology = temporalTopologyFrom(config);
  assertMk0TemporalTopology(topology);

  const delayMs = positiveInteger(process.env.B2_CONTINUITY_DELAY_MS, DEFAULT_DELAY_MS);
  const probeId = process.env.B2_PROBE_ID?.trim() || `b2-${randomUUID()}`;
  const workflowId = process.env.B2_WORKFLOW_ID?.trim() || `mk0-b2-continuity-${probeId}`;

  const connection = await Connection.connect({ address: topology.address });
  const client = new Client({ connection, namespace: topology.namespace });

  try {
    const started = await client.workflow.start(b2ContinuitySmoke, {
      taskQueue: topology.taskQueue,
      workflowId,
      args: [{ probeId, delayMs }],
    });

    const handle = client.workflow.getHandle(workflowId, started.firstExecutionRunId);
    const waitingState = await waitForWaitingState(handle);

    console.log(
      `B2_CONTINUITY_STARTED ${JSON.stringify({
        ok: true,
        workflowId,
        runId: started.firstExecutionRunId,
        probeId,
        delayMs,
        phase: waitingState.phase,
        taskQueue: waitingState.taskQueue,
      })}`,
    );
  } finally {
    await connection.close();
  }
}

run().catch((error: unknown) => {
  console.error(
    `B2_CONTINUITY_START_FAILED ${JSON.stringify({
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    })}`,
  );
  process.exitCode = 1;
});
