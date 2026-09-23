import {
  normalizeAppointmentDateInput,
  todayInTimeZone,
  type AppointmentStateProjection,
} from '../../contracts/register-new-appointment/index.js';
import {
  resolveAgentProfile,
  runAgentModelTurn,
  type AgentConversationTurn,
  type AgentDecision,
  type AgentEngineProjection,
  type AgentJsonObject,
  type AgentModelProvider,
  type AgentResolvedProfile,
} from '../../contracts/agent-layer/index.js';
import {
  AgentConversationRuntime,
  type AgentRuntimeRoute,
} from '../../agent/runtime/index.js';
import type {
  CanonicalChannelAction,
  CanonicalChannelEnvelope,
  CanonicalChannelExecutionResponse,
  ChannelKind,
} from './types.js';

const BUSINESS_TIME_ZONE = 'America/Lima';

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

type AgentChannelMessageValue = Readonly<{
  ok: true;
  workflowId: string;
  reply: string;
  interpretation: AgentDecision;
  execution?: CanonicalChannelExecutionResponse;
  state: AppointmentStateProjection;
}>;

export type AgentChannelMessageResponse = AgentChannelMessageValue & Readonly<{
  runtime: Readonly<{
    replayed: boolean;
    route: AgentRuntimeRoute;
    modelInvoked: boolean;
    contextTurnCount: number;
  }>;
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

function normalizedText(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[¿?¡!.,;:]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function exactNamedMatch(
  text: string,
  candidates: readonly Readonly<{ id: string; name: string; code?: string }>[],
): string | undefined {
  const normalized = normalizedText(text);
  const matches = candidates.filter((item) =>
    normalizedText(item.name) === normalized
    || (item.code ? normalizedText(item.code) === normalized : false));
  return matches.length === 1 ? matches[0]!.id : undefined;
}

export function deterministicAppointmentDecision(
  state: AppointmentStateProjection,
  rawText: string,
): AgentDecision | undefined {
  const text = rawText.trim();

  if (state.phase === 'WAITING_FOR_MANAGED_ENTITY' && state.managedEntity.status === 'NEEDS_SELECTION') {
    const managedEntityId = exactNamedMatch(
      text,
      state.managedEntity.candidates.map((item) => ({
        id: item.managedEntityId,
        name: item.displayName,
      })),
    );
    if (managedEntityId) {
      return {
        schemaVersion: 1,
        kind: 'PROPOSE_ACTION',
        reply: 'Perfecto, seguimos con esa opción.',
        proposedAction: {
          action: 'SELECT_MANAGED_ENTITY',
          arguments: { managedEntityId },
        },
      };
    }
  }

  if (state.phase === 'WAITING_FOR_SERVICE') {
    const serviceId = exactNamedMatch(
      text,
      state.services.map((item) => ({ id: item.serviceId, name: item.name, code: item.code })),
    );
    if (serviceId) {
      return {
        schemaVersion: 1,
        kind: 'PROPOSE_ACTION',
        reply: 'Perfecto, seguimos con ese servicio.',
        proposedAction: {
          action: 'SELECT_SERVICE',
          arguments: { serviceId },
        },
      };
    }
  }

  if (state.phase === 'WAITING_FOR_PRODUCT') {
    const offeringId = exactNamedMatch(
      text,
      state.products.map((item) => ({ id: item.productId, name: item.name, code: item.code })),
    );
    if (offeringId) {
      return {
        schemaVersion: 1,
        kind: 'PROPOSE_ACTION',
        reply: 'Perfecto, seguimos con esa opción.',
        proposedAction: {
          action: 'SELECT_OFFERING',
          arguments: { offeringId },
        },
      };
    }
  }

  if (state.phase === 'WAITING_FOR_DATE') {
    const parsed = normalizeAppointmentDateInput(text, todayInTimeZone(BUSINESS_TIME_ZONE));
    if (parsed.ok) {
      return {
        schemaVersion: 1,
        kind: 'PROPOSE_ACTION',
        reply: 'Perfecto, revisemos esa fecha.',
        proposedAction: {
          action: 'SET_DATE',
          arguments: { naturalDate: text },
        },
      };
    }
  }

  if (state.phase === 'WAITING_FOR_SLOT') {
    const match = normalizedText(text).match(/^(?:a las? )?(\d{1,2}):([0-5]\d)$/);
    if (match) {
      const slotStart = match[1]!.padStart(2, '0') + ':' + match[2]!;
      if (state.availableSlots.some((slot) => slot.start === slotStart)) {
        return {
          schemaVersion: 1,
          kind: 'PROPOSE_ACTION',
          reply: 'Perfecto, seleccionemos ese horario.',
          proposedAction: {
            action: 'SELECT_SLOT',
            arguments: { slotStart },
          },
        };
      }
    }
  }

  if (state.phase === 'READY_TO_FINALIZE') {
    const normalized = normalizedText(text);
    const confirmations = new Set([
      'si',
      'si confirma',
      'confirma',
      'confirmar',
      'confirmo',
      'ok',
      'okay',
    ]);
    if (confirmations.has(normalized)) {
      return {
        schemaVersion: 1,
        kind: 'PROPOSE_ACTION',
        reply: 'Perfecto, confirmemos esa cita.',
        proposedAction: {
          action: 'FINALIZE_APPOINTMENT',
          arguments: {},
        },
      };
    }
  }

  return undefined;
}

function safeModelFallback(projection: AgentEngineProjection): AgentDecision {
  if (projection.allowedActions.length > 0) {
    return {
      schemaVersion: 1,
      kind: 'CLARIFY',
      reply: 'No pude interpretar ese mensaje ahora. Intenta escribir tu elección de forma más directa.',
    };
  }
  return {
    schemaVersion: 1,
    kind: 'RESPOND',
    reply: 'No pude generar una respuesta ahora. Intenta nuevamente en un momento.',
  };
}

export function deterministicAppointmentNarration(state: AppointmentStateProjection): string {
  if (state.phase === 'WAITING_FOR_MANAGED_ENTITY' && state.managedEntity.status === 'NEEDS_SELECTION') {
    const names = state.managedEntity.candidates.slice(0, 4).map((item) => item.displayName);
    return names.length > 0
      ? '¿Con cuál continuamos: ' + names.join(', ') + '?'
      : '¿Con cuál opción deseas continuar?';
  }
  if (state.phase === 'WAITING_FOR_SERVICE') {
    const names = state.services.slice(0, 4).map((item) => item.name);
    return names.length > 0
      ? '¿Qué servicio prefieres: ' + names.join(', ') + '?'
      : '¿Qué servicio prefieres?';
  }
  if (state.phase === 'WAITING_FOR_PRODUCT') {
    const names = state.products.slice(0, 4).map((item) => item.name);
    return names.length > 0
      ? '¿Qué opción prefieres: ' + names.join(', ') + '?'
      : '¿Qué opción prefieres?';
  }
  if (state.phase === 'WAITING_FOR_DATE') {
    return 'Perfecto. ¿Qué fecha prefieres?';
  }
  if (state.phase === 'WAITING_FOR_SLOT') {
    const date = state.appointmentDate ? ' para ' + state.appointmentDate : '';
    return 'Tengo horarios disponibles' + date + '. ¿Cuál prefieres?';
  }
  if (state.phase === 'READY_TO_FINALIZE') {
    const slot = state.selectedSlot?.start;
    return slot
      ? 'Perfecto, quedó seleccionado ' + slot + '. ¿Confirmamos la cita?'
      : 'Perfecto. ¿Confirmamos la cita?';
  }
  if (state.phase === 'CREATED' && state.workflowStatus === 'COMPLETED') {
    const date = state.result?.appointmentDate;
    const start = state.result?.slot.start;
    if (date && start) return 'Listo, la cita quedó confirmada para ' + date + ' a las ' + start + '.';
    return 'Listo, la cita quedó confirmada.';
  }
  if (state.phase === 'FAILED' || state.workflowStatus === 'FAILED') {
    return 'No pude completar ese paso. Revisa la información e inténtalo nuevamente.';
  }
  return 'Continuemos con el siguiente paso.';
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

export class AgentAppointmentChannelCore {
  readonly #profile: AgentResolvedProfile;

  constructor(
    private readonly stateReader: AgentAppointmentStateReader,
    private readonly actionExecutor: AgentAppointmentActionExecutor,
    private readonly modelProvider: AgentModelProvider,
    private readonly runtime: AgentConversationRuntime,
    profile: AgentResolvedProfile = resolveAgentProfile(),
  ) {
    this.#profile = profile;
  }

  async handle(input: AgentChannelMessageInput): Promise<AgentChannelMessageResponse> {
    validateInput(input);

    const execution = await this.runtime.execute<AgentChannelMessageValue>(
      input,
      async ({ recentTurns }) => this.handleFresh(input, recentTurns),
    );

    return {
      ...execution.value,
      runtime: {
        replayed: execution.replayed,
        route: execution.audit.route,
        modelInvoked: execution.audit.modelInvoked,
        contextTurnCount: execution.audit.contextTurnCount,
      },
    };
  }

  private async handleFresh(
    input: AgentChannelMessageInput,
    recentTurns: readonly AgentConversationTurn[],
  ) {
    const before = await this.stateReader.read({
      businessSlug: input.businessSlug,
      channel: input.channel,
      externalConversationId: input.externalConversationId,
    });
    const projection = projectAppointmentStateForAgent(before.state);

    let route: AgentRuntimeRoute = 'MODEL';
    let modelInvoked = false;
    let interpretation = deterministicAppointmentDecision(before.state, input.text);

    if (interpretation) {
      route = 'DETERMINISTIC_BYPASS';
    } else {
      modelInvoked = true;
      try {
        interpretation = await runAgentModelTurn(this.modelProvider, {
          schemaVersion: 1,
          profile: this.#profile,
          conversation: {
            businessSlug: input.businessSlug,
            conversationId: input.externalConversationId,
            locale: this.#profile.voice.locale,
            recentTurns,
            currentMessage: input.text,
            engine: projection,
          },
        });
      } catch {
        route = 'SAFE_FALLBACK';
        interpretation = safeModelFallback(projection);
      }
    }

    if (interpretation.kind !== 'PROPOSE_ACTION') {
      const value: AgentChannelMessageValue = {
        ok: true,
        workflowId: before.workflowId,
        reply: interpretation.reply,
        interpretation,
        state: before.state,
      };
      return {
        value,
        reply: value.reply,
        audit: {
          route,
          modelInvoked,
          interpretation,
          enginePhaseBefore: before.state.phase,
          enginePhaseAfter: before.state.phase,
        },
      };
    }

    const envelope = agentDecisionToChannelEnvelope(interpretation, input);
    const engineExecution = await this.actionExecutor.execute(envelope);
    if (!engineExecution.ok) {
      throw new Error('AGENT_ENGINE_EXECUTION_FAILED:' + (engineExecution.code ?? 'UNKNOWN'));
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

    const reply = deterministicAppointmentNarration(after.state);
    const value: AgentChannelMessageValue = {
      ok: true,
      workflowId: after.workflowId,
      reply,
      interpretation,
      execution: engineExecution,
      state: after.state,
    };

    return {
      value,
      reply,
      audit: {
        route,
        modelInvoked,
        interpretation,
        enginePhaseBefore: before.state.phase,
        enginePhaseAfter: after.state.phase,
      },
    };
  }
}
