import assert from 'node:assert/strict';
import { Pool } from 'pg';

import { AgentConversationRuntime } from '../src/agent/runtime/index.js';
import {
  AgentRuntimeTurnIdentityConflictError,
  PostgresAgentRuntimeRepository,
} from '../src/persistence/postgres/agent-runtime.repository.js';
import { loadRuntimeConfig } from '../src/config/runtime-config.js';

const config = loadRuntimeConfig();

function message(id: string, text: string, channel = 'WHATSAPP') {
  return {
    businessSlug: 'golden-business',
    channel,
    externalConversationId: 'a3-runtime-cert-conversation',
    externalMessageId: id,
    externalSenderId: 'a3-runtime-cert-sender',
    text,
  };
}

async function makePool(): Promise<Pool> {
  const pool = new Pool({ connectionString: config.postgresUrl, max: 2 });
  await pool.query('SELECT 1');
  return pool;
}

const pool1 = await makePool();
await pool1.query(
  "DELETE FROM agent_runtime_turns WHERE business_slug = 'golden-business' AND external_conversation_id = 'a3-runtime-cert-conversation'",
);

const repo1 = new PostgresAgentRuntimeRepository(pool1);
const runtime1 = new AgentConversationRuntime(repo1);
let firstWorkerCalls = 0;

const first = await runtime1.execute(message('a3-msg-1', 'Quiero una cita esta semana.'), async ({ recentTurns }) => {
  firstWorkerCalls += 1;
  assert.equal(recentTurns.length, 0);
  return {
    value: { ok: true, reply: 'Claro. ¿Qué fecha prefieres?' },
    reply: 'Claro. ¿Qué fecha prefieres?',
    audit: {
      route: 'MODEL',
      modelInvoked: true,
      enginePhaseBefore: 'WAITING_FOR_DATE',
      enginePhaseAfter: 'WAITING_FOR_DATE',
    },
  };
});
assert.equal(first.replayed, false);
assert.equal(firstWorkerCalls, 1);
await pool1.end();

console.log('AGENT_A3_DURABLE_FIRST_TURN_PASS');

const pool2 = await makePool();
const repo2 = new PostgresAgentRuntimeRepository(pool2);
const runtime2 = new AgentConversationRuntime(repo2);
let reconstructedHistory: readonly { role: 'USER' | 'AGENT'; text: string }[] = [];

const second = await runtime2.execute(message('a3-msg-2', 'El viernes me sirve.'), async ({ recentTurns }) => {
  reconstructedHistory = recentTurns;
  return {
    value: { ok: true, reply: 'Perfecto, revisemos el viernes.' },
    reply: 'Perfecto, revisemos el viernes.',
    audit: {
      route: 'MODEL',
      modelInvoked: true,
      enginePhaseBefore: 'WAITING_FOR_DATE',
      enginePhaseAfter: 'WAITING_FOR_SLOT',
    },
  };
});
assert.equal(second.replayed, false);
assert.deepEqual(reconstructedHistory, [
  { role: 'USER', text: 'Quiero una cita esta semana.' },
  { role: 'AGENT', text: 'Claro. ¿Qué fecha prefieres?' },
]);
console.log('AGENT_A3_CONTEXT_RECONSTRUCTION_PASS');

let replayWorkerCalls = 0;
const replay = await runtime2.execute(message('a3-msg-1', 'Quiero una cita esta semana.'), async () => {
  replayWorkerCalls += 1;
  throw new Error('worker must not run on durable replay');
});
assert.equal(replay.replayed, true);
assert.equal(replayWorkerCalls, 0);
assert.deepEqual(replay.value, first.value);
console.log('AGENT_A3_DURABLE_REPLAY_PASS');

await assert.rejects(
  () => runtime2.execute(message('a3-msg-1', 'material diferente'), async () => {
    throw new Error('must never run');
  }),
  (error: unknown) => error instanceof AgentRuntimeTurnIdentityConflictError,
);
console.log('AGENT_A3_IDENTITY_CONFLICT_PASS');

const staleMessage = message('a3-msg-stale', '06:30', 'TELEGRAM');
const staleRepo = new PostgresAgentRuntimeRepository(pool2, 1);
const initialClaim = await staleRepo.claim(staleMessage);
assert.equal(initialClaim.kind, 'NEW');
await pool2.query(
  "UPDATE agent_runtime_turns SET updated_at = NOW() - INTERVAL '10 seconds' WHERE business_slug = $1 AND channel = $2 AND external_message_id = $3",
  [staleMessage.businessSlug, staleMessage.channel, staleMessage.externalMessageId],
);
const reclaimed = await staleRepo.claim(staleMessage);
assert.equal(reclaimed.kind, 'NEW');
await staleRepo.complete({
  message: staleMessage,
  response: { ok: true, reply: 'Recuperado.' },
  reply: 'Recuperado.',
  route: 'DETERMINISTIC_BYPASS',
  modelInvoked: false,
  contextTurnCount: 0,
  enginePhaseBefore: 'WAITING_FOR_SLOT',
  enginePhaseAfter: 'READY_TO_FINALIZE',
});
const attempt = await pool2.query<{ attempt_count: number }>(
  'SELECT attempt_count FROM agent_runtime_turns WHERE business_slug = $1 AND channel = $2 AND external_message_id = $3',
  [staleMessage.businessSlug, staleMessage.channel, staleMessage.externalMessageId],
);
assert.equal(attempt.rows[0]?.attempt_count, 2);
console.log('AGENT_A3_STALE_CLAIM_RECOVERY_PASS');

const audit = await pool2.query<{
  external_message_id: string;
  status: string;
  route: string;
  model_invoked: boolean;
  context_turn_count: number;
  engine_phase_before: string | null;
  engine_phase_after: string | null;
}>(
  "SELECT external_message_id,status,route,model_invoked,context_turn_count,engine_phase_before,engine_phase_after FROM agent_runtime_turns WHERE business_slug = 'golden-business' AND external_conversation_id = 'a3-runtime-cert-conversation' ORDER BY turn_seq",
);
assert.equal(audit.rows.length, 3);
assert.ok(audit.rows.every((row) => row.status === 'APPLIED'));
assert.equal(audit.rows[0]?.route, 'MODEL');
assert.equal(audit.rows[1]?.context_turn_count, 2);
assert.equal(audit.rows[2]?.route, 'DETERMINISTIC_BYPASS');
assert.equal(audit.rows[2]?.model_invoked, false);

console.log(JSON.stringify({ audit: audit.rows }));
console.log('AGENT_A3_AUDIT_LEDGER_PASS');
console.log('AGENT_A3_CHANNEL_INDEPENDENT_RUNTIME_PASS');

await pool2.end();

console.log('AGENT_A3_RUNTIME_DURABILITY_CERTIFICATION_PASS');
