import { randomUUID } from 'node:crypto';
import { Client, Connection } from '@temporalio/client';
import { loadRuntimeConfig } from '../../../config/runtime-config.js';
import type {
  B0SmokeInput,
  B0SmokeResult,
} from '../workflows/b0-smoke.workflow.js';

async function run(): Promise<void> {
  const config = loadRuntimeConfig();
  const connection = await Connection.connect({
    address: config.temporalAddress,
  });

  try {
    const client = new Client({
      connection,
      namespace: config.temporalNamespace,
    });

    const probeId = randomUUID();
    const workflowId = `mk0-b0-smoke:${probeId}`;

    const result = await client.workflow.execute<
      (input: B0SmokeInput) => Promise<B0SmokeResult>
    >('b0RuntimeSmoke', {
      workflowId,
      taskQueue: config.temporalTaskQueue,
      args: [{ probeId }],
    });

    console.log(
      JSON.stringify({
        event: 'B0_TEMPORAL_SMOKE_OK',
        temporalAddress: config.temporalAddress,
        namespace: config.temporalNamespace,
        ...result,
      }),
    );
  } finally {
    await connection.close();
  }
}

run().catch((error: unknown) => {
  console.error(
    JSON.stringify({
      event: 'B0_TEMPORAL_SMOKE_FAILED',
      error: error instanceof Error ? error.message : String(error),
    }),
  );
  process.exitCode = 1;
});
