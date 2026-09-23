import type { AppointmentStateProjection } from '../../contracts/register-new-appointment/index.js';
import {
  resolveAgentProfile,
  runAgentModelTurn,
  type AgentDecision,
  type AgentEngineProjection,
  type AgentJsonObject,
  type AgentModelProvider,
  type AgentResolvedProfile,
} from '../../contracts/agent-layer/index.js';
import type {
  CanonicalChannelAction,
  CanonicalChannelEnvelope,
  CanonicalChannelExecutionResponse,
  ChannelKind,
} from './types.js';

export type AgentChannelMessageInput = Readonly<{
  businessSlug: string;
  channel: ChannelKind;
  externalConversationId: string;
  externalMessageId: string;
  externalSenderId: string;
  text: string;
}>;

export type AgentConversationState = Readonly<{
  workflowId: string;
  state: AppointmentStateProjection;
}>;

export interface AgentAppointmentStateReader {
  read(input: Readonly<{
    businessSlug: string;
    channel: ChannelKind;
    externalConversationId: string;
  }>): Promise<AgentConversationState>;
}

export interface AgentAppointmentActionExecutor {
  execute(envelope: CanonicalChannelEnvelope): Promise<CanonicalChannelExecutionResponse>;
}

export type AgentChannelMessageResponse = Readonly<{
  ok: true;
  workflowId: string;
  reply: string;
  interpretation: AgentDecision;
  execution?: CanonicalChannelExecutionResponse;
  state: AppointmentStateProjection;
}>;

function stringArgument(args: AgentJsonObject, key: string): string {
  const value = args[key];
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error('AGENT_ACTION_ARGUMENT_INVALID:' + key);
  }
  return value.trim();
}

function optionalStringArgument(args: AgentJsonObject, key: string): string | undefined {
  const value = args[key];
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function safeFacts(state: AppointmentStateProjection): AgentJsonObject {
  const facts: Record<string, unknown> = {
    workflowStatus: state.workflowStatus,
    phase: state.phase,
    nextAction: state.nextAction,
    managedEntity: {
      status: state.managedEntity.status,
      label: state.managedEntity.policy.label,
      candidates: state.managedEntity.candidates.map((item) => ({
        managedEntityId: item.managedEntityId,
        displayName: item.displayName,
        type: item.type,
        ...(item.summary ? { summary: item.summary } : {}),
      })),
      ...(state.managedEntity.selected
        ? {
            selected: {
              managedEntityId: state.managedEntity.selected.managedEntityId,
              displayName: state.managedEntity.selected.displayName,
              type: state.managedEntity.selected.type,
            },
          }
        : {}),
    },
    services: state.services.map((item) => ({
      serviceId: item.serviceId,
      name: item.name,
      code: item.code,
    })),
    offerings: state.products.map((item) => ({
      offeringId: item.productId,
      serviceId: item.serviceId,
      name: item.name,
      code: item.code,
      durationMinutes: item.durationMinutes,
    })),
    availableSlots: state.availableSlots.map((item) => ({
      start: item.start,
      end: item.end,
      durationMinutes: item.durationMinutes,
    })),
    issues: state.issues.map((item) => ({
      code: item.code,
      message: item.message,
    })),
  };

  if (state.selectedService) {
    facts.selectedService = {
      serviceId: state.selectedService.serviceId,
      name: state.selectedService.name,
    };
  }
  if (state.selectedProduct) {
    facts.selectedOffering = {
      offeringId: state.selectedProduct.productId,
      name: state.selectedProduct.name,
      durationMinutes: state.selectedProduct.durationMinutes,
    };
  }
  if (state.appointmentDate) facts.appointmentDate = state.appointmentDate;
  if (state.selectedSlot) {
    facts.selectedSlot = {
      start: state.selectedSlot.start,
      end: state.selectedSlot.end,
    };
  }
  if (state.result) {
    facts.result = {
      appointmentCreated: true,
      appointmentDate: state.result.appointmentDate,
      slot: {
        start: state.result.slot.start,
        end: state.result.slot.end,
      },
    };
  }

  return facts as AgentJsonObject;
}

export function projectAppointmentStateForAgent(state: AppointmentStateProjection): AgentEngineProjection {
  const allowedActions: string[] = [];
  const hints: string[] = [];

  if (state.phase === 'WAITING_FOR_MANAGED_ENTITY') {
    if (state.managedEntity.status === 'NEEDS_SELECTION') {
      allowedActions.push('SELECT_MANAGED_ENTITY');
      hints.push('For SELECT_MANAGED_ENTITY use arguments {"managedEntityId":"<exact candidate id>"} copied from facts.');
    }
    if (state.managedEntity.status === 'NEEDS_CREATION') {
      allowedActions.push('CREATE_MANAGED_ENTITY');
      hints.push('For CREATE_MANAGED_ENTITY use arguments {"displayName":"<name>","externalRef":"<stable reference>"}.');
    }
  } else if (state.phase === 'WAITING_FOR_SERVICE') {
    allowedActions.push('SELECT_SERVICE');
    hints.push('For SELECT_SERVICE use arguments {"serviceId":"<exact service id>"} copied from facts.');
  } else if (state.phase === 'WAITING_FOR_PRODUCT') {
    allowedActions.push('SELECT_OFFERING');
    hints.push('For SELECT_OFFERING use arguments {"offeringId":"<exact offering id>"} copied from facts.');
  } else if (state.phase === 'WAITING_FOR_DATE') {
    allowedActions.push('SET_DATE');
    hints.push('For SET_DATE use arguments {"naturalDate":"<date words from user>"}.');
  } else if (state.phase === 'WAITING_FOR_SLOT') {
    allowedActions.push('SELECT_SLOT');
    hints.push('For SELECT_SLOT use arguments {"slotStart":"<exact slot start>"} copied from facts.');
  } else if (state.phase === 'READY_TO_FINALIZE') {
    allowedActions.push('FINALIZE_APPOINTMENT');
    hints.push('For FINALIZE_APPOINTMENT use empty arguments {}.');
  }

  return {
    phase: state.phase,
    facts: safeFacts(state),
    allowedActions,
    ...(hints.length > 0 ? { hints } : {}),
  };
}

export function agentDecisionToChannelEnvelope(
  decision: Extract<AgentDecision, Readonly<{ kind: 'PROPOSE_ACTION' }>>,
  input: AgentChannelMessageInput,
): CanonicalChannelEnvelope {
  const action = decision.proposedAction.action as CanonicalChannelAction;
  const args = decision.proposedAction.arguments;
  let payload: Readonly<Record<string, unknown>>;

  switch (action) {
    case 'SELECT_MANAGED_ENTITY':
      payload = { managedEntityId: stringArgument(args, 'managedEntityId') };
      break;
    case 'CREATE_MANAGED_ENTITY': {
      const summary = optionalStringArgument(args, 'summary');
      const data = args.data && typeof args.data === 'object' && !Array.isArray(args.data)
        ? args.data
        : undefined;
      payload = {
        displayName: stringArgument(args, 'displayName'),
        externalRef: stringArgument(args, 'externalRef'),
        ...(summary ? { summary } : {}),
        ...(data ? { data } : {}),
      };
      break;
    }
    case 'SELECT_SERVICE':
      payload = { serviceId: stringArgument(args, 'serviceId') };
      break;
    case 'SELECT_OFFERING':
      payload = { catalogOfferingId: stringArgument(args, 'offeringId') };
      break;
    case 'SET_DATE':
      payload = { dateInput: stringArgument(args, 'naturalDate') };
      break;
    case 'SELECT_SLOT':
      payload = { slotStart: stringArgument(args, 'slotStart') };
      break;
    case 'FINALIZE_APPOINTMENT':
      payload = {};
      break;
    default:
      throw new Error('AGENT_ACTION_NOT_SUPPORTED:' + action);
  }

  return {
    version: 'v1',
    channel: input.channel,
    businessSlug: input.businessSlug,
    externalConversationId: input.externalConversationId,
    externalMessageId: input.externalMessageId,
    externalSenderId: input.externalSenderId,
    action,
    payload,
  };
}

function validateInput(input: AgentChannelMessageInput): void {
  for (const [key, value] of Object.entries(input)) {
    if (typeof value !== 'string' || !value.trim()) {
      throw new Error('AGENT_CHANNEL_MESSAGE_INVALID:' + key);
    }
  }
  if (input.text.length > 2000) throw new Error('AGENT_CHANNEL_MESSAGE_INVALID:text');
}

const TRANSIENT_AGENT_PHASES = new Set<AppointmentStateProjection['phase']>([
  'RESOLVING_CUSTOMER',
  'LOADING_MANAGED_ENTITIES',
  'CREATING_MANAGED_ENTITY',
  'LOADING_SERVICES',
  'LOADING_PRODUCTS',
  'LOADING_SLOTS',
  'RESERVING_APPOINTMENT',
]);

function narrationInstruction(state: AppointmentStateProjection): string {
  if (state.phase === 'WAITING_FOR_SLOT') {
    return 'The Engine accepted the requested date. Tell the user the date is set and ask them to choose one of the available time slots. Do not ask about vehicle, service, or offering again.';
  }
  if (state.phase === 'READY_TO_FINALIZE') {
    return 'The Engine accepted the selected time slot. Briefly acknowledge the selected date/time and ask the user to confirm the appointment. Do not ask about vehicle, service, or offering again.';
  }
  if (state.phase === 'CREATED' && state.workflowStatus === 'COMPLETED') {
    return 'The Engine has created the appointment successfully. Tell the user the appointment is confirmed using the confirmed date/time. Do not ask for confirmation again.';
  }
  if (state.phase === 'WAITING_FOR_PRODUCT') {
    return 'The Engine accepted the service. Ask the user to choose one of the confirmed offerings.';
  }
  if (state.phase === 'WAITING_FOR_DATE') {
    return 'The Engine accepted the offering. Ask the user which date they prefer.';
  }
  return 'Describe only the confirmed Engine state and ask naturally for the next required user choice, if any.';
}

export class AgentAppointmentChannelCore {
  readonly #profile: AgentResolvedProfile;

  constructor(
    private readonly stateReader: AgentAppointmentStateReader,
    private readonly actionExecutor: AgentAppointmentActionExecutor,
    private readonly modelProvider: AgentModelProvider,
    profile: AgentResolvedProfile = resolveAgentProfile(),
  ) {
    this.#profile = profile;
  }

  async handle(input: AgentChannelMessageInput): Promise<AgentChannelMessageResponse> {
    validateInput(input);

    const before = await this.stateReader.read({
      businessSlug: input.businessSlug,
      channel: input.channel,
      externalConversationId: input.externalConversationId,
    });
    const projection = projectAppointmentStateForAgent(before.state);

    const interpretation = await runAgentModelTurn(this.modelProvider, {
      schemaVersion: 1,
      profile: this.#profile,
      conversation: {
        businessSlug: input.businessSlug,
        conversationId: input.externalConversationId,
        locale: this.#profile.voice.locale,
        recentTurns: [],
        currentMessage: input.text,
        engine: projection,
      },
    });

    if (interpretation.kind !== 'PROPOSE_ACTION') {
      return {
        ok: true,
        workflowId: before.workflowId,
        reply: interpretation.reply,
        interpretation,
        state: before.state,
      };
    }

    const envelope = agentDecisionToChannelEnvelope(interpretation, input);
    const execution = await this.actionExecutor.execute(envelope);
    if (!execution.ok) {
      throw new Error('AGENT_ENGINE_EXECUTION_FAILED:' + (execution.code ?? 'UNKNOWN'));
    }

    let after = await this.stateReader.read({
      businessSlug: input.businessSlug,
      channel: input.channel,
      externalConversationId: input.externalConversationId,
    });
    for (let attempt = 0; attempt < 50 && TRANSIENT_AGENT_PHASES.has(after.state.phase); attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 40));
      after = await this.stateReader.read({
        businessSlug: input.businessSlug,
        channel: input.channel,
        externalConversationId: input.externalConversationId,
      });
    }

    const confirmed = projectAppointmentStateForAgent(after.state);
    const narration = await runAgentModelTurn(this.modelProvider, {
      schemaVersion: 1,
      profile: this.#profile,
      conversation: {
        businessSlug: input.businessSlug,
        conversationId: input.externalConversationId,
        locale: this.#profile.voice.locale,
        recentTurns: [],
        currentMessage: narrationInstruction(after.state),
        engine: {
          phase: confirmed.phase,
          facts: {
            ...confirmed.facts,
            nextAllowedActions: confirmed.allowedActions,
          },
          allowedActions: [],
          hints: [
            'Narration only. Do not propose or execute another action.',
            'State only confirmed facts.',
            narrationInstruction(after.state),
          ],
        },
      },
    });

    return {
      ok: true,
      workflowId: after.workflowId,
      reply: narration.reply,
      interpretation,
      execution,
      state: after.state,
    };
  }
}
