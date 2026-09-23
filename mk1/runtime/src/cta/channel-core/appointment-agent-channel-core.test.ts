import assert from 'node:assert/strict';
import test from 'node:test';

import type { AppointmentStateProjection } from '../../contracts/register-new-appointment/index.js';
import {
  resolveAgentProfile,
  type AgentModelProvider,
} from '../../contracts/agent-layer/index.js';
import {
  AgentConversationRuntime,
  type AgentRuntimeClaim,
  type AgentRuntimeStore,
} from '../../agent/runtime/index.js';
import {
  agentDecisionToChannelEnvelope,
  AgentAppointmentChannelCore,
  deterministicAppointmentDecision,
  projectAppointmentStateForAgent,
  type AgentConversationState,
} from './appointment-agent-channel-core.js';

function state(phase: AppointmentStateProjection['phase']): AppointmentStateProjection {
  return {
    workflowId: 'wf_a3',
    workflowStatus: phase === 'CREATED' ? 'COMPLETED' : 'RUNNING',
    phase,
    customer: {
      status: 'EXISTING',
      customerId: 'cus_001',
    },
    managedEntity: {
      status: 'SELECTED',
      policy: {
        requirement: 'REQUIRED',
        lifecycle: 'DURABLE_REUSABLE',
        selectionMode: 'ALWAYS_EXPLICIT',
        type: 'vehicle',
        label: 'Vehículo',
      },
      candidates: [],
      selected: {
        managedEntityId: 'men_logan',
        type: 'vehicle',
        displayName: 'Renault Logan',
      },
    },
    services: [],
    products: [],
    availableSlots: [],
    nextAction: phase === 'WAITING_FOR_DATE'
      ? 'PROVIDE_DATE'
      : phase === 'WAITING_FOR_SLOT'
        ? 'SELECT_SLOT'
        : phase === 'READY_TO_FINALIZE'
          ? 'FINALIZE_APPOINTMENT'
          : 'NONE',
    issues: [],
    ...(phase === 'WAITING_FOR_DATE'
      ? {
          selectedService: { serviceId: 'svc_wash', code: 'wash', name: 'Car Wash' },
          selectedProduct: {
            productId: 'off_exec',
            serviceId: 'svc_wash',
            code: 'exec',
            name: 'Executive Clean',
            durationMinutes: 30,
          },
        }
      : {}),
  };
}

class RuntimeMemoryStore implements AgentRuntimeStore {
  rows = new Map<string, {
    response: unknown;
    reply: string;
    route: 'MODEL' | 'DETERMINISTIC_BYPASS' | 'SAFE_FALLBACK';
    modelInvoked: boolean;
    contextTurnCount: number;
    userText: string;
  }>();

  async claim(input: Parameters<AgentRuntimeStore['claim']>[0]): Promise<AgentRuntimeClaim> {
    const row = this.rows.get(input.externalMessageId);
    return row
      ? {
          kind: 'REPLAY_APPLIED',
          response: row.response,
          reply: row.reply,
          route: row.route,
          modelInvoked: row.modelInvoked,
          contextTurnCount: row.contextTurnCount,
        }
      : { kind: 'NEW' };
  }

  async recentTurns(): Promise<readonly { role: 'USER' | 'AGENT'; text: string }[]> {
    const turns: { role: 'USER' | 'AGENT'; text: string }[] = [];
    for (const row of this.rows.values()) {
      turns.push({ role: 'USER', text: row.userText });
      turns.push({ role: 'AGENT', text: row.reply });
    }
    return turns.slice(-8);
  }

  async complete(input: Parameters<AgentRuntimeStore['complete']>[0]): Promise<void> {
    this.rows.set(input.message.externalMessageId, {
      response: input.response,
      reply: input.reply,
      route: input.route,
      modelInvoked: input.modelInvoked,
      contextTurnCount: input.contextTurnCount,
      userText: input.message.text,
    });
  }

  async fail(): Promise<void> {}
}

function message(id: string, text: string) {
  return {
    businessSlug: 'golden-business',
    channel: 'WEBCHAT' as const,
    externalConversationId: 'conv-a3',
    externalMessageId: id,
    externalSenderId: 'browser-a3',
    text,
  };
}

test('A3 projection exposes only the canonical action appropriate for durable phase', () => {
  const projection = projectAppointmentStateForAgent(state('WAITING_FOR_DATE'));
  assert.deepEqual(projection.allowedActions, ['SET_DATE']);
  assert.match(projection.hints?.[0] ?? '', /naturalDate/);
});

test('A3 translator still converts validated Agent arguments into canonical Channel envelope', () => {
  const envelope = agentDecisionToChannelEnvelope({
    schemaVersion: 1,
    kind: 'PROPOSE_ACTION',
    reply: 'Perfecto.',
    proposedAction: {
      action: 'SET_DATE',
      arguments: { naturalDate: 'viernes' },
    },
  }, message('msg-envelope', 'viernes'));

  assert.equal(envelope.action, 'SET_DATE');
  assert.deepEqual(envelope.payload, { dateInput: 'viernes' });
});

test('A3 bypasses the model for an exact available slot', () => {
  const current = {
    ...state('WAITING_FOR_SLOT'),
    appointmentDate: '2026-09-25',
    availableSlots: [{ start: '06:30', end: '07:00', durationMinutes: 30 }],
  };
  const decision = deterministicAppointmentDecision(current, 'A las 06:30');
  assert.equal(decision?.kind, 'PROPOSE_ACTION');
  if (decision?.kind === 'PROPOSE_ACTION') {
    assert.equal(decision.proposedAction.action, 'SELECT_SLOT');
    assert.deepEqual(decision.proposedAction.arguments, { slotStart: '06:30' });
  }
});

test('A3 deterministic bypass executes with zero model calls and replays without re-execution', async () => {
  let current: AppointmentStateProjection = {
    ...state('WAITING_FOR_SLOT'),
    appointmentDate: '2026-09-25',
    availableSlots: [{ start: '06:30', end: '07:00', durationMinutes: 30 }],
  };
  let modelCalls = 0;
  let engineCalls = 0;

  const provider: AgentModelProvider = {
    providerId: 'must-not-run',
    async generateTurn() {
      modelCalls += 1;
      throw new Error('model should have been bypassed');
    },
  };
  const reader = {
    async read(): Promise<AgentConversationState> {
      return { workflowId: 'wf_a3', state: current };
    },
  };
  const executor = {
    async execute() {
      engineCalls += 1;
      current = {
        ...current,
        phase: 'READY_TO_FINALIZE',
        nextAction: 'FINALIZE_APPOINTMENT',
        selectedSlot: { start: '06:30', end: '07:00', durationMinutes: 30 },
      };
      return { ok: true as const, replayed: false, workflowId: 'wf_a3' };
    },
  };

  const store = new RuntimeMemoryStore();
  const runtime = new AgentConversationRuntime(store);
  const core = new AgentAppointmentChannelCore(reader, executor, provider, runtime, resolveAgentProfile());

  const first = await core.handle(message('msg-slot', '06:30'));
  const replay = await core.handle(message('msg-slot', '06:30'));

  assert.equal(first.runtime.route, 'DETERMINISTIC_BYPASS');
  assert.equal(first.runtime.modelInvoked, false);
  assert.equal(first.runtime.replayed, false);
  assert.equal(replay.runtime.replayed, true);
  assert.equal(modelCalls, 0);
  assert.equal(engineCalls, 1);
  assert.match(first.reply, /confirmamos/i);
});

test('A3 model-unavailable fallback performs no Engine action and is durable', async () => {
  let engineCalls = 0;
  const provider: AgentModelProvider = {
    providerId: 'offline',
    async generateTurn() {
      throw new Error('Local Agent provider failed: offline');
    },
  };
  const reader = {
    async read(): Promise<AgentConversationState> {
      return { workflowId: 'wf_a3', state: state('WAITING_FOR_DATE') };
    },
  };
  const executor = {
    async execute() {
      engineCalls += 1;
      return { ok: true as const, replayed: false, workflowId: 'wf_a3' };
    },
  };

  const store = new RuntimeMemoryStore();
  const runtime = new AgentConversationRuntime(store);
  const core = new AgentAppointmentChannelCore(reader, executor, provider, runtime, resolveAgentProfile());

  const result = await core.handle(message('msg-offline', 'cuando salga del trabajo'));
  const replay = await core.handle(message('msg-offline', 'cuando salga del trabajo'));

  assert.equal(result.runtime.route, 'SAFE_FALLBACK');
  assert.equal(result.runtime.modelInvoked, true);
  assert.equal(result.interpretation.kind, 'CLARIFY');
  assert.equal(engineCalls, 0);
  assert.equal(replay.runtime.replayed, true);
});

test('A3 reconstructed history reaches the model on the next non-deterministic turn', async () => {
  let current = state('WAITING_FOR_DATE');
  const observedHistory: unknown[] = [];
  let call = 0;

  const provider: AgentModelProvider = {
    providerId: 'history-proof',
    async generateTurn(input) {
      observedHistory.push(input.conversation.recentTurns);
      call += 1;
      if (call === 1) {
        return {
          schemaVersion: 1,
          kind: 'CLARIFY',
          reply: '¿Prefieres viernes o sábado?',
        };
      }
      return {
        schemaVersion: 1,
        kind: 'CLARIFY',
        reply: 'Entendido. ¿Qué fecha exacta prefieres?',
      };
    },
  };
  const reader = {
    async read(): Promise<AgentConversationState> {
      return { workflowId: 'wf_a3', state: current };
    },
  };
  const executor = {
    async execute() {
      return { ok: true as const, replayed: false, workflowId: 'wf_a3' };
    },
  };

  const store = new RuntimeMemoryStore();
  const runtime = new AgentConversationRuntime(store);
  const core = new AgentAppointmentChannelCore(reader, executor, provider, runtime, resolveAgentProfile());

  await core.handle(message('msg-history-1', 'quiero uno de esos días'));
  const second = await core.handle(message('msg-history-2', 'el que hablamos antes'));

  assert.equal(second.runtime.contextTurnCount, 2);
  assert.deepEqual(observedHistory[1], [
    { role: 'USER', text: 'quiero uno de esos días' },
    { role: 'AGENT', text: '¿Prefieres viernes o sábado?' },
  ]);
});
