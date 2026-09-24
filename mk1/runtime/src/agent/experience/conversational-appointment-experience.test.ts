import assert from 'node:assert/strict';
import test from 'node:test';

import type { AppointmentStateProjection } from '../../contracts/register-new-appointment/index.js';
import type {
  AgentRuntimeClaim,
  AgentRuntimeStore,
} from '../runtime/index.js';
import { AgentConversationRuntime } from '../runtime/index.js';
import { resolveAgentProfile } from '../../contracts/agent-layer/index.js';
import type { CanonicalChannelEnvelope } from '../../cta/channel-core/types.js';
import {
  A5ConversationalAppointmentExperience,
} from './conversational-appointment-experience.js';
import type { A5ExperienceModelProvider } from './types.js';

function waitingCustomer(): AppointmentStateProjection {
  return {
    workflowId: 'wf_a5',
    workflowStatus: 'RUNNING',
    phase: 'WAITING_FOR_CUSTOMER',
    customer: { status: 'EMPTY' },
    managedEntity: {
      status: 'PENDING',
      policy: {
        requirement: 'REQUIRED',
        lifecycle: 'DURABLE_REUSABLE',
        selectionMode: 'ALWAYS_EXPLICIT',
        type: 'vehicle',
        label: 'Vehículo',
      },
      candidates: [],
    },
    services: [],
    products: [],
    availableSlots: [],
    nextAction: 'PROVIDE_CUSTOMER',
    issues: [],
  };
}

function waitingVehicle(): AppointmentStateProjection {
  return {
    ...waitingCustomer(),
    customer: {
      status: 'EXISTING',
      customerId: 'cus_a5',
      customer: { name: 'Eduardo' },
    },
    phase: 'WAITING_FOR_MANAGED_ENTITY',
    managedEntity: {
      ...waitingCustomer().managedEntity,
      status: 'NEEDS_SELECTION',
      candidates: [{
        managedEntityId: 'men_logan',
        type: 'vehicle',
        displayName: 'Renault Logan 2018',
      }],
    },
    nextAction: 'SELECT_MANAGED_ENTITY',
  };
}

class MemoryStore implements AgentRuntimeStore {
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

function input(id: string, text: string) {
  return {
    businessSlug: 'golden-business',
    channel: 'WEBCHAT' as const,
    externalConversationId: 'conv-a5',
    externalMessageId: id,
    externalSenderId: 'browser-a5',
    text,
  };
}

test('A5 first free-form message silently starts the existing Appointment workflow and only distills conversational context', async () => {
  let current: AppointmentStateProjection | undefined;
  const envelopes: CanonicalChannelEnvelope[] = [];

  const provider: A5ExperienceModelProvider = {
    providerId: 'a5-first-turn',
    async generateTurn() {
      return {
        schemaVersion: 1,
        reply: 'Hola, soy Jett, parte del staff de Gallo Autos. Cuéntame un poco más sobre el problema.',
        distillation: {
          observed: [{ field: 'problem_statement', value: 'problema con la suspensión de mi carro' }],
          inferred: [
            { field: 'managed_entity_type', value: 'vehicle' },
            { field: 'service_intent', value: 'suspension' },
          ],
        },
      };
    },
  };

  const experience = new A5ConversationalAppointmentExperience(
    {
      async tryRead() {
        return current ? { workflowId: current.workflowId, state: current } : undefined;
      },
    },
    {
      async execute(envelope) {
        envelopes.push(envelope);
        if (envelope.action === 'START_APPOINTMENT') {
          current = waitingCustomer();
          return { ok: true, replayed: false, workflowId: 'wf_a5' };
        }
        throw new Error('unexpected Engine action ' + envelope.action);
      },
    },
    provider,
    new AgentConversationRuntime(new MemoryStore()),
    resolveAgentProfile({ identity: { name: 'Jett', role: 'Staff Assistant' } }),
    'Gallo Autos',
  );

  const result = await experience.handle(input('msg-1', 'Tengo un problema con la suspensión de mi carro'));

  assert.equal(envelopes.length, 1);
  assert.equal(envelopes[0]?.action, 'START_APPOINTMENT');
  assert.equal(result.runtime.route, 'MODEL');
  assert.equal(result.runtime.modelInvoked, true);
  assert.match(result.reply, /Jett/);
  assert.match(result.reply, /Gallo Autos/);
  assert.deepEqual(result.distillation.observed, [
    { field: 'problem_statement', value: 'problema con la suspensión de mi carro' },
  ]);
  assert.equal(result.confirmed.customerId, undefined);
  assert.equal(result.state.phase, 'WAITING_FOR_CUSTOMER');
});

test('A5 customer name distillation crosses A0 validation before existing PROVIDE_CUSTOMER execution', async () => {
  let current: AppointmentStateProjection | undefined = waitingCustomer();
  const envelopes: CanonicalChannelEnvelope[] = [];

  const provider: A5ExperienceModelProvider = {
    providerId: 'a5-customer-turn',
    async generateTurn() {
      return {
        schemaVersion: 1,
        reply: 'Gracias, Eduardo. Seguimos con tu caso.',
        distillation: {
          observed: [{ field: 'customer_name', value: 'Eduardo' }],
          inferred: [],
        },
        proposedAction: {
          action: 'PROVIDE_CUSTOMER',
          arguments: { customerName: 'Eduardo' },
        },
      };
    },
  };

  const experience = new A5ConversationalAppointmentExperience(
    {
      async tryRead() {
        return current ? { workflowId: current.workflowId, state: current } : undefined;
      },
    },
    {
      async execute(envelope) {
        envelopes.push(envelope);
        assert.equal(envelope.action, 'PROVIDE_CUSTOMER');
        assert.deepEqual(envelope.payload, { customerPatch: { name: 'Eduardo' } });
        current = waitingVehicle();
        return { ok: true, replayed: false, workflowId: 'wf_a5' };
      },
    },
    provider,
    new AgentConversationRuntime(new MemoryStore()),
    resolveAgentProfile(),
    'Golden Business',
  );

  const result = await experience.handle(input('msg-2', 'Soy Eduardo'));

  assert.equal(envelopes.length, 1);
  assert.equal(result.interpretation.kind, 'PROPOSE_ACTION');
  assert.equal(result.confirmed.customerId, 'cus_a5');
  assert.equal(result.state.phase, 'WAITING_FOR_MANAGED_ENTITY');
});

test('A5 rejects model attempts to jump outside the current Engine capability boundary', async () => {
  let current: AppointmentStateProjection | undefined = waitingCustomer();
  let engineCalls = 0;

  const provider: A5ExperienceModelProvider = {
    providerId: 'a5-invalid-action',
    async generateTurn() {
      return {
        schemaVersion: 1,
        reply: 'Seleccionemos un servicio.',
        distillation: {
          observed: [{ field: 'service_intent', value: 'suspensión' }],
          inferred: [],
        },
        proposedAction: {
          action: 'SELECT_SERVICE',
          arguments: { serviceId: 'svc_invented' },
        },
      };
    },
  };

  const experience = new A5ConversationalAppointmentExperience(
    {
      async tryRead() {
        return current ? { workflowId: current.workflowId, state: current } : undefined;
      },
    },
    {
      async execute() {
        engineCalls += 1;
        return { ok: true, replayed: false, workflowId: 'wf_a5' };
      },
    },
    provider,
    new AgentConversationRuntime(new MemoryStore()),
    resolveAgentProfile(),
    'Golden Business',
  );

  const result = await experience.handle(input('msg-3', 'Creo que es la suspensión'));

  assert.equal(result.runtime.route, 'SAFE_FALLBACK');
  assert.equal(result.runtime.modelInvoked, true);
  assert.equal(engineCalls, 0);
  assert.equal(result.state.phase, 'WAITING_FOR_CUSTOMER');
});

test('A5 preserves A4 deterministic bypass once Engine state makes the user intent unambiguous', async () => {
  let current: AppointmentStateProjection | undefined = waitingVehicle();
  let modelCalls = 0;
  let selected = '';

  const provider: A5ExperienceModelProvider = {
    providerId: 'must-not-run',
    async generateTurn() {
      modelCalls += 1;
      throw new Error('model should be bypassed');
    },
  };

  const experience = new A5ConversationalAppointmentExperience(
    {
      async tryRead() {
        return current ? { workflowId: current.workflowId, state: current } : undefined;
      },
    },
    {
      async execute(envelope) {
        selected = String(envelope.payload.managedEntityId ?? '');
        current = {
          ...waitingVehicle(),
          phase: 'WAITING_FOR_SERVICE',
          managedEntity: {
            ...waitingVehicle().managedEntity,
            status: 'SELECTED',
            selected: waitingVehicle().managedEntity.candidates[0]!,
          },
          services: [{ serviceId: 'svc_wash', code: 'wash', name: 'Car Wash' }],
          nextAction: 'SELECT_SERVICE',
        };
        return { ok: true, replayed: false, workflowId: 'wf_a5' };
      },
    },
    provider,
    new AgentConversationRuntime(new MemoryStore()),
    resolveAgentProfile(),
    'Golden Business',
  );

  const result = await experience.handle(input('msg-4', 'Renault Logan 2018'));

  assert.equal(result.runtime.route, 'DETERMINISTIC_BYPASS');
  assert.equal(result.runtime.modelInvoked, false);
  assert.equal(modelCalls, 0);
  assert.equal(selected, 'men_logan');
  assert.deepEqual(result.distillation.observed, [
    { field: 'vehicle_reference', value: 'Renault Logan 2018' },
  ]);
});
