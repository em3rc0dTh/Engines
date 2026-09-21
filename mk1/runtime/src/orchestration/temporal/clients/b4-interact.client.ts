import { Client, Connection } from '@temporalio/client';
import { loadRuntimeConfig } from '../../../config/runtime-config.js';
import type { ProvideCustomerDataInput } from '../../../contracts/register-new-customer/index.js';
import { assertMk0TemporalTopology, temporalTopologyFrom } from '../topology.js';
import {
  getRegistrationStateQuery,
  provideCustomerDataUpdate,
} from '../workflows/register-new-customer.workflow.js';

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function parseUpdateInput(): ProvideCustomerDataInput {
  const raw = process.argv[3]?.trim();
  if (!raw) throw new Error('update mode requires JSON input as argv[3]');
  return JSON.parse(raw) as ProvideCustomerDataInput;
}

async function run(): Promise<void> {
  const mode = process.argv[2];
  const workflowId = required('B4_WORKFLOW_ID');
  const runId = required('B4_RUN_ID');
  const topology = temporalTopologyFrom(loadRuntimeConfig());
  assertMk0TemporalTopology(topology);

  const connection = await Connection.connect({ address: topology.address });
  const client = new Client({ connection, namespace: topology.namespace });

  try {
    const handle = client.workflow.getHandle(workflowId, runId);

    if (mode === 'query') {
      const state = await handle.query(getRegistrationStateQuery);
      console.log(`B4_STATE ${JSON.stringify({ ok: true, runId, state })}`);
      return;
    }

    if (mode === 'update') {
      const input = parseUpdateInput();
      const result = await handle.executeUpdate(provideCustomerDataUpdate, { args: [input] });
      console.log(`B4_UPDATE ${JSON.stringify({ ok: true, runId, inputId: input.inputId, result })}`);
      return;
    }

    if (mode === 'terminate') {
      await handle.terminate('B4 certification evidence captured before B5 persistence stage');
      console.log(`B4_TERMINATED ${JSON.stringify({ ok: true, workflowId, runId })}`);
      return;
    }

    throw new Error(`Unknown B4 interaction mode: ${mode ?? '<missing>'}`);
  } finally {
    await connection.close();
  }
}

run().catch((error: unknown) => {
  console.error(
    `B4_INTERACTION_FAILED ${JSON.stringify({
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    })}`,
  );
  process.exitCode = 1;
});
