import type {
  AppointmentStateProjection,
} from '../../contracts/register-new-appointment/index.js';
import {
  type AgentConversationTurn,
  type AgentDecision,
  type AgentEngineProjection,
  type AgentJsonObject,
  type AgentResolvedProfile,
} from '../../contracts/agent-layer/index.js';
import {
  AgentConversationRuntime,
  type AgentRuntimeRoute,
} from '../runtime/index.js';
import {
  agentDecisionToChannelEnvelope,
  deterministicAppointmentDecision,
  deterministicAppointmentNarration,
  projectAppointmentStateForAgent,
  type AgentChannelMessageInput,
  type AgentConversationState,
} from '../../cta/channel-core/appointment-agent-channel-core.js';
import type {
  CanonicalChannelEnvelope,
  CanonicalChannelExecutionResponse,
} from '../../cta/channel-core/types.js';
import {
  validateA5ExperienceOutput,
} from './progressive-distillation.js';
import type {
  A5ExperienceModelProvider,
  A5ProgressiveDistillation,
} from './types.js';

export interface A5AppointmentStateReader {
  tryRead(input: Readonly<{
    businessSlug: string;
    channel: AgentChannelMessageInput['channel'];
    externalConversationId: string;
  }>): Promise<AgentConversationState | undefined>;
}

export interface A5AppointmentActionExecutor {
  execute(envelope: CanonicalChannelEnvelope): Promise<CanonicalChannelExecutionResponse>;
}

export type A5ConfirmedContext = Readonly<{
  customerId?: string;
  customerName?: string;
  managedEntityId?: string;
  managedEntityName?: string;
  serviceId?: string;
  serviceName?: string;
  offeringId?: string;
  offeringName?: string;
  appointmentDate?: string;
  slotStart?: string;
  appointmentId?: string;
  schedulerReservationId?: string;
}>;

type A5ExperienceValue = Readonly<{
  ok: true;
  workflowId: string;
  reply: string;
  interpretation: AgentDecision;
  distillation: A5ProgressiveDistillation;
  confirmed: A5ConfirmedContext;
  execution?: CanonicalChannelExecutionResponse;
  state: AppointmentStateProjection;
}>;

export type A5ExperienceResponse = A5ExperienceValue & Readonly<{
  runtime: Readonly<{
    replayed: boolean;
    route: AgentRuntimeRoute;
    modelInvoked: boolean;
    contextTurnCount: number;
  }>;
}>;

const SETTLING_PHASES = new Set<AppointmentStateProjection['phase']>([
  'STARTED',
  'RESOLVING_CUSTOMER',
  'LOADING_MANAGED_ENTITIES',
  'CREATING_MANAGED_ENTITY',
  'LOADING_SERVICES',
  'LOADING_PRODUCTS',
  'LOADING_SLOTS',
  'RESERVING_APPOINTMENT',
]);

function settling(state: AppointmentStateProjection): boolean {
  return SETTLING_PHASES.has(state.phase)
    || (state.phase === 'CREATED' && state.workflowStatus === 'RUNNING');
}

function customerName(state: AppointmentStateProjection): string | undefined {
  const customer = state.customer.customer;
  return customer && typeof customer.name === 'string' && customer.name.trim()
    ? customer.name.trim()
    : undefined;
}

function confirmedContext(state: AppointmentStateProjection): A5ConfirmedContext {
  const resolvedCustomerName = customerName(state);
  return {
    ...(state.customer.customerId ? { customerId: state.customer.customerId } : {}),
    ...(resolvedCustomerName ? { customerName: resolvedCustomerName } : {}),
    ...(state.managedEntity.selected?.managedEntityId
      ? { managedEntityId: state.managedEntity.selected.managedEntityId }
      : {}),
    ...(state.managedEntity.selected?.displayName
      ? { managedEntityName: state.managedEntity.selected.displayName }
      : {}),
    ...(state.selectedService?.serviceId ? { serviceId: state.selectedService.serviceId } : {}),
    ...(state.selectedService?.name ? { serviceName: state.selectedService.name } : {}),
    ...(state.selectedProduct?.productId ? { offeringId: state.selectedProduct.productId } : {}),
    ...(state.selectedProduct?.name ? { offeringName: state.selectedProduct.name } : {}),
    ...(state.appointmentDate ? { appointmentDate: state.appointmentDate } : {}),
    ...(state.selectedSlot?.start ? { slotStart: state.selectedSlot.start } : {}),
    ...(state.result?.appointmentId ? { appointmentId: state.result.appointmentId } : {}),
    ...(state.result?.schedulerReservationId
      ? { schedulerReservationId: state.result.schedulerReservationId }
      : {}),
  };
}

function projectionForA5(state: AppointmentStateProjection): AgentEngineProjection {
  const base = projectAppointmentStateForAgent(state);
  if (state.phase !== 'WAITING_FOR_CUSTOMER') return base;

  const facts: AgentJsonObject = {
    ...base.facts,
    customer: {
      status: state.customer.status,
      ...(customerName(state) ? { name: customerName(state)! } : {}),
    },
  };

  return {
    phase: state.phase,
    facts,
    allowedActions: ['PROVIDE_CUSTOMER'],
    hints: [
      'PROVIDE_CUSTOMER accepts {"customerName":"<explicit name>"} and/or {"customerEmail":"<explicit email>"}.',
      'Only include customer identity fields explicitly supplied by the user.',
    ],
  };
}

function deterministicDistillation(
  state: AppointmentStateProjection,
  text: string,
): A5ProgressiveDistillation {
  const value = text.trim();
  if (!value) return { observed: [], inferred: [] };

  if (state.phase === 'WAITING_FOR_MANAGED_ENTITY') {
    return { observed: [{ field: 'vehicle_reference', value }], inferred: [] };
  }
  if (state.phase === 'WAITING_FOR_SERVICE') {
    return { observed: [{ field: 'service_intent', value }], inferred: [] };
  }
  if (state.phase === 'WAITING_FOR_PRODUCT') {
    return { observed: [{ field: 'offering_preference', value }], inferred: [] };
  }
  if (state.phase === 'WAITING_FOR_DATE') {
    return { observed: [{ field: 'date_preference', value }], inferred: [] };
  }
  if (state.phase === 'WAITING_FOR_SLOT') {
    return { observed: [{ field: 'slot_preference', value }], inferred: [] };
  }
  if (state.phase === 'READY_TO_FINALIZE') {
    return { observed: [{ field: 'confirmation', value }], inferred: [] };
  }
  return { observed: [], inferred: [] };
}

function customerDecisionEnvelope(
  decision: Extract<AgentDecision, Readonly<{ kind: 'PROPOSE_ACTION' }>>,
  input: AgentChannelMessageInput,
): CanonicalChannelEnvelope {
  if (decision.proposedAction.action !== 'PROVIDE_CUSTOMER') {
    return agentDecisionToChannelEnvelope(decision, input);
  }
  const rawName = decision.proposedAction.arguments.customerName;
  const rawEmail = decision.proposedAction.arguments.customerEmail;
  const name = typeof rawName === 'string' && rawName.trim() ? rawName.trim() : undefined;
  const email = typeof rawEmail === 'string' && rawEmail.trim() ? rawEmail.trim() : undefined;
  if (!name && !email) {
    throw new Error('A5_CUSTOMER_IDENTITY_INVALID');
  }

  return {
    version: 'v1',
    channel: input.channel,
    businessSlug: input.businessSlug,
    externalConversationId: input.externalConversationId,
    externalMessageId: input.externalMessageId,
    externalSenderId: input.externalSenderId,
    action: 'PROVIDE_CUSTOMER',
    payload: {
      customerPatch: {
        ...(name ? { name } : {}),
        ...(email ? { contact: { email } } : {}),
      },
    },
  };
}

function safeFallback(): Readonly<{
  decision: AgentDecision;
  distillation: A5ProgressiveDistillation;
}> {
  return {
    decision: {
      schemaVersion: 1,
      kind: 'RESPOND',
      reply: 'Quiero ayudarte, pero no pude interpretar bien ese mensaje. ¿Puedes contármelo de otra forma?',
    },
    distillation: { observed: [], inferred: [] },
  };
}

export class A5ConversationalAppointmentExperience {
  constructor(
    private readonly stateReader: A5AppointmentStateReader,
    private readonly actionExecutor: A5AppointmentActionExecutor,
    private readonly modelProvider: A5ExperienceModelProvider,
    private readonly runtime: AgentConversationRuntime,
    private readonly profile: AgentResolvedProfile,
    private readonly businessDisplayName: string,
  ) {
    if (!businessDisplayName.trim()) throw new Error('A5_BUSINESS_DISPLAY_NAME_REQUIRED');
  }

  async handle(input: AgentChannelMessageInput): Promise<A5ExperienceResponse> {
    await this.ensureStarted(input);

    const execution = await this.runtime.execute<A5ExperienceValue>(
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

  private async ensureStarted(input: AgentChannelMessageInput): Promise<void> {
    const existing = await this.stateReader.tryRead(input);
    if (existing) return;

    const started = await this.actionExecutor.execute({
      version: 'v1',
      channel: input.channel,
      businessSlug: input.businessSlug,
      externalConversationId: input.externalConversationId,
      externalMessageId: input.externalMessageId + ':a5-start',
      externalSenderId: input.externalSenderId,
      action: 'START_APPOINTMENT',
      payload: {},
    });
    if (!started.ok) throw new Error('A5_START_APPOINTMENT_FAILED:' + (started.code ?? 'UNKNOWN'));

    for (let attempt = 0; attempt < 50; attempt += 1) {
      if (await this.stateReader.tryRead(input)) return;
      await new Promise((resolve) => setTimeout(resolve, 40));
    }
    throw new Error('A5_START_APPOINTMENT_NOT_VISIBLE');
  }

  private async readSettled(input: AgentChannelMessageInput): Promise<AgentConversationState> {
    for (let attempt = 0; attempt < 50; attempt += 1) {
      const current = await this.stateReader.tryRead(input);
      if (current && !settling(current.state)) return current;
      await new Promise((resolve) => setTimeout(resolve, 40));
    }
    const current = await this.stateReader.tryRead(input);
    if (!current) throw new Error('A5_CONVERSATION_STATE_MISSING');
    return current;
  }

  private async handleFresh(
    input: AgentChannelMessageInput,
    recentTurns: readonly AgentConversationTurn[],
  ) {
    const before = await this.readSettled(input);
    const projection = projectionForA5(before.state);

    let route: AgentRuntimeRoute = 'MODEL';
    let modelInvoked = false;
    let decision = deterministicAppointmentDecision(before.state, input.text);
    let distillation: A5ProgressiveDistillation;

    if (decision) {
      route = 'DETERMINISTIC_BYPASS';
      distillation = deterministicDistillation(before.state, input.text);
    } else {
      modelInvoked = true;
      try {
        const modelInput = {
          schemaVersion: 1 as const,
          profile: this.profile,
          businessDisplayName: this.businessDisplayName,
          conversation: {
            businessSlug: input.businessSlug,
            conversationId: input.externalConversationId,
            locale: this.profile.voice.locale,
            recentTurns,
            currentMessage: input.text,
            engine: projection,
          },
        };
        const raw = await this.modelProvider.generateTurn(modelInput);
        const validated = validateA5ExperienceOutput(raw, modelInput);
        decision = validated.decision;
        distillation = validated.output.distillation;
      } catch {
        route = 'SAFE_FALLBACK';
        const fallback = safeFallback();
        decision = fallback.decision;
        distillation = fallback.distillation;
      }
    }

    if (decision.kind !== 'PROPOSE_ACTION') {
      const value: A5ExperienceValue = {
        ok: true,
        workflowId: before.workflowId,
        reply: decision.reply,
        interpretation: decision,
        distillation,
        confirmed: confirmedContext(before.state),
        state: before.state,
      };
      return {
        value,
        reply: value.reply,
        audit: {
          route,
          modelInvoked,
          interpretation: decision,
          enginePhaseBefore: before.state.phase,
          enginePhaseAfter: before.state.phase,
          detail: {
            a5Experience: true,
            observedCount: distillation.observed.length,
            inferredCount: distillation.inferred.length,
          },
        },
      };
    }

    const envelope = customerDecisionEnvelope(decision, input);
    const engineExecution = await this.actionExecutor.execute(envelope);
    if (!engineExecution.ok) {
      throw new Error('A5_ENGINE_EXECUTION_FAILED:' + (engineExecution.code ?? 'UNKNOWN'));
    }

    const after = await this.readSettled(input);
    const reply = deterministicAppointmentNarration(after.state);
    const value: A5ExperienceValue = {
      ok: true,
      workflowId: after.workflowId,
      reply,
      interpretation: decision,
      distillation,
      confirmed: confirmedContext(after.state),
      execution: engineExecution,
      state: after.state,
    };
    return {
      value,
      reply,
      audit: {
        route,
        modelInvoked,
        interpretation: decision,
        enginePhaseBefore: before.state.phase,
        enginePhaseAfter: after.state.phase,
        detail: {
          a5Experience: true,
          observedCount: distillation.observed.length,
          inferredCount: distillation.inferred.length,
        },
      },
    };
  }
}
