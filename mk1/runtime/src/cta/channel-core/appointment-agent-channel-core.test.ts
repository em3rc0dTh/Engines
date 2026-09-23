import assert from 'node:assert/strict';
import test from 'node:test';

import type { AppointmentStateProjection } from '../../contracts/register-new-appointment/index.js';
import {
  resolveAgentProfile,
  type AgentModelProvider,
} from '../../contracts/agent-layer/index.js';
import {
  agentDecisionToChannelEnvelope,
  AgentAppointmentChannelCore,
  projectAppointmentStateForAgent,
  type AgentConversationState,
} from './appointment-agent-channel-core.js';

function state(phase: AppointmentStateProjection['phase']): AppointmentStateProjection {
  return {
    workflowId: 'wf_a2',
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

test('A2 projection exposes only the canonical action appropriate for the durable phase', () => {
  const projection = projectAppointmentStateForAgent(state('WAITING_FOR_DATE'));
  assert.deepEqual(projection.allowedActions, ['SET_DATE']);
  assert.match(projection.hints?.[0] ?? '', /naturalDate/);
});

test('A2 translator converts Agent arguments into the existing Channel envelope', () => {
  const envelope = agentDecisionToChannelEnvelope({
    schemaVersion: 1,
    kind: 'PROPOSE_ACTION',
    reply: 'Perfecto, revisemos el viernes.',
    proposedAction: {
      action: 'SET_DATE',
      arguments: { naturalDate: 'viernes' },
    },
  }, {
    businessSlug: 'golden-business',
    channel: 'WEBCHAT',
    externalConversationId: 'conv-a2',
    externalMessageId: 'msg-a2',
    externalSenderId: 'browser-a2',
    text: 'Mejor el viernes.',
  });

  assert.equal(envelope.action, 'SET_DATE');
  assert.deepEqual(envelope.payload, { dateInput: 'viernes' });
});

test('A2 integrated core executes only a validated proposal and narrates confirmed post-state', async () => {
  let current = state('WAITING_FOR_DATE');
  const decisions: unknown[] = [
    {
      schemaVersion: 1,
      kind: 'PROPOSE_ACTION',
      reply: 'Perfecto, revisemos el viernes.',
      proposedAction: {
        action: 'SET_DATE',
        arguments: { naturalDate: 'viernes' },
      },
    },
    {
      schemaVersion: 1,
      kind: 'RESPOND',
      reply: 'Perfecto. Ya tengo horarios para el viernes; ¿cuál prefieres?',
    },
  ];

  const provider: AgentModelProvider = {
    providerId: 'a2-fake',
    async generateTurn() {
      const next = decisions.shift();
      if (!next) throw new Error('unexpected model call');
      return next;
    },
  };

  const reader = {
    async read(): Promise<AgentConversationState> {
      return { workflowId: 'wf_a2', state: current };
    },
  };

  const executor = {
    async execute() {
      current = {
        ...state('WAITING_FOR_SLOT'),
        appointmentDate: '2026-09-25',
        availableSlots: [{ start: '06:30', end: '07:00', durationMinutes: 30 }],
      };
      return {
        ok: true,
        replayed: false,
        workflowId: 'wf_a2',
      };
    },
  };

  const core = new AgentAppointmentChannelCore(reader, executor, provider, resolveAgentProfile());
  const result = await core.handle({
    businessSlug: 'golden-business',
    channel: 'WEBCHAT',
    externalConversationId: 'conv-a2',
    externalMessageId: 'msg-a2',
    externalSenderId: 'browser-a2',
    text: 'Mejor el viernes.',
  });

  assert.equal(result.interpretation.kind, 'PROPOSE_ACTION');
  assert.equal(result.state.phase, 'WAITING_FOR_SLOT');
  assert.equal(result.state.appointmentDate, '2026-09-25');
  assert.match(result.reply, /horarios/i);
});
