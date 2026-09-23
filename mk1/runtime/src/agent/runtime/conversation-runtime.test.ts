import assert from 'node:assert/strict';
import test from 'node:test';

import type { AgentConversationTurn } from '../../contracts/agent-layer/index.js';
import { AgentConversationRuntime } from './conversation-runtime.js';
import type {
  AgentRuntimeClaim,
  AgentRuntimeMessageInput,
  AgentRuntimeStore,
} from './types.js';

class MemoryStore implements AgentRuntimeStore {
  response: unknown;
  applied = false;
  recent: AgentConversationTurn[] = [];

  async claim(): Promise<AgentRuntimeClaim> {
    return this.applied
      ? {
          kind: 'REPLAY_APPLIED',
          response: this.response,
          reply: 'persisted reply',
          route: 'MODEL',
          modelInvoked: true,
          contextTurnCount: this.recent.length,
        }
      : { kind: 'NEW' };
  }

  async recentTurns(): Promise<readonly AgentConversationTurn[]> {
    return this.recent;
  }

  async complete(input: Parameters<AgentRuntimeStore['complete']>[0]): Promise<void> {
    this.response = input.response;
    this.applied = true;
  }

  async fail(): Promise<void> {}
}

const message: AgentRuntimeMessageInput = {
  businessSlug: 'golden-business',
  channel: 'TELEGRAM',
  externalConversationId: 'conv-a3',
  externalMessageId: 'msg-a3',
  externalSenderId: 'sender-a3',
  text: 'El viernes.',
};

test('A3 runtime supplies bounded durable history to a channel-independent worker', async () => {
  const store = new MemoryStore();
  store.recent = [
    { role: 'USER', text: 'Quiero reservar.' },
    { role: 'AGENT', text: '¿Qué fecha prefieres?' },
  ];

  const runtime = new AgentConversationRuntime(store);
  let observed: readonly AgentConversationTurn[] = [];

  const result = await runtime.execute(message, async ({ recentTurns }) => {
    observed = recentTurns;
    return {
      value: { ok: true, reply: 'Perfecto.' },
      reply: 'Perfecto.',
      audit: {
        route: 'MODEL',
        modelInvoked: true,
        enginePhaseBefore: 'WAITING_FOR_DATE',
        enginePhaseAfter: 'WAITING_FOR_SLOT',
      },
    };
  });

  assert.deepEqual(observed, store.recent);
  assert.equal(result.replayed, false);
  assert.equal(result.audit.contextTurnCount, 2);
});

test('A3 runtime replays a durable response without invoking the worker twice', async () => {
  const store = new MemoryStore();
  const runtime = new AgentConversationRuntime(store);
  let calls = 0;

  const worker = async () => {
    calls += 1;
    return {
      value: { ok: true, reply: 'Primera respuesta.' },
      reply: 'Primera respuesta.',
      audit: {
        route: 'MODEL' as const,
        modelInvoked: true,
      },
    };
  };

  const first = await runtime.execute(message, worker);
  const replay = await runtime.execute(message, worker);

  assert.equal(first.replayed, false);
  assert.equal(replay.replayed, true);
  assert.equal(calls, 1);
  assert.deepEqual(replay.value, first.value);
});
