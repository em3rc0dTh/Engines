import type { WorkflowHandle } from '@temporalio/client';
import {
  normalizeAppointmentDateInput,
  todayInTimeZone,
  type CreateAppointmentManagedEntityInput,
  type FinalizeAppointmentInput,
  type ProvideAppointmentCustomerInput,
  type ResolveAppointmentCustomerInput,
  type SelectAppointmentManagedEntityInput,
  type SelectAppointmentProductInput,
  type SelectAppointmentServiceInput,
  type SelectAppointmentSlotInput,
  type SetAppointmentDateInput,
} from '../../contracts/register-new-appointment/index.js';
import {
  validateProvideCustomerDataIngress,
} from '../../contracts/register-new-customer/index.js';
import { adaptRegisterNewAppointmentCtaInput } from '../register-new-appointment.adapter.js';
import type { TemporalRegisterNewAppointmentPort } from '../../orchestration/temporal/ports/register-new-appointment.temporal-port.js';
import {
  createAppointmentManagedEntityUpdate,
  finalizeAppointmentUpdate,
  getAppointmentStateQuery,
  provideAppointmentCustomerUpdate,
  resolveAppointmentCustomerUpdate,
  selectAppointmentManagedEntityUpdate,
  selectAppointmentProductUpdate,
  selectAppointmentServiceUpdate,
  selectAppointmentSlotUpdate,
  setAppointmentDateUpdate,
} from '../../orchestration/temporal/workflows/register-new-appointment.workflow.js';
import {
  ChannelBindingConflictError,
  ChannelEventIdentityConflictError,
  PostgresChannelRepository,
} from '../../persistence/postgres/channel.repository.js';
import { channelOperationInputId } from './idempotency.js';
import type {
  CanonicalChannelAction,
  CanonicalChannelEnvelope,
  CanonicalChannelExecutionResponse,
} from './types.js';

const BUSINESS_TIME_ZONE = 'America/Lima';

type JsonRecord = Record<string, unknown>;

type ActionHandler = (
  handle: WorkflowHandle,
  envelope: CanonicalChannelEnvelope,
) => Promise<unknown>;

export interface CatalogOfferingResolver {
  getOffering(businessSlug: string, offeringIdOrCode: string): Promise<Readonly<{
    serviceId: string;
    offeringId: string;
  }> | undefined>;
}

function record(value: unknown): JsonRecord | undefined {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as JsonRecord
    : undefined;
}

function stringField(payload: JsonRecord, key: string): string {
  const value = payload[key];
  if (typeof value !== 'string' || !value.trim()) throw new ChannelExecutionError('CHANNEL_EVENT_INVALID', key);
  return value.trim();
}

export class ChannelExecutionError extends Error {
  constructor(readonly code: string, detail?: string) {
    super(detail ? `${code}:${detail}` : code);
    this.name = 'ChannelExecutionError';
  }
}

function executionCode(error: unknown): string {
  if (error instanceof ChannelExecutionError) return error.code;
  if (error instanceof ChannelEventIdentityConflictError) return error.code;
  if (error instanceof ChannelBindingConflictError) return error.code;
  return 'CHANNEL_EVENT_PROCESSING_FAILED';
}

function actionHandlers(): ReadonlyMap<CanonicalChannelAction, ActionHandler> {
  return new Map<CanonicalChannelAction, ActionHandler>([
    ['PROVIDE_CUSTOMER', async (handle, envelope) => {
      const customerPatch = record(envelope.payload.customerPatch);
      const customerId = typeof envelope.payload.customerId === 'string'
        ? envelope.payload.customerId.trim()
        : undefined;
      if (!customerPatch && !customerId) {
        throw new ChannelExecutionError('CHANNEL_EVENT_INVALID', 'customerId or customerPatch');
      }
      const inputId = channelOperationInputId(envelope);
      if (customerPatch) {
        const validated = validateProvideCustomerDataIngress({ inputId, customerPatch });
        if (!validated.ok) {
          throw new ChannelExecutionError('CHANNEL_EVENT_INVALID', validated.issues[0]?.message ?? 'customerPatch');
        }
      }
      const input: ProvideAppointmentCustomerInput = {
        inputId,
        ...(customerId ? { customerId } : {}),
        ...(customerPatch ? { customerPatch } : {}),
      };
      const provided = await handle.executeUpdate(provideAppointmentCustomerUpdate, { args: [input] });

      // The channel does not infer identity or decide whether a Customer exists.
      // Every accepted customer datum is handed back to the durable Temporal
      // Workflow for deterministic resolution. The activity chooses name discovery
      // versus strong identity lookup (email/phone/document/customerId).
      const state = await handle.query(getAppointmentStateQuery);
      const shouldAskTemporalToResolve = state.workflowStatus === 'RUNNING'
        && state.phase === 'WAITING_FOR_CUSTOMER';

      if (shouldAskTemporalToResolve) {
        const resolveInput: ResolveAppointmentCustomerInput = { inputId: `${inputId}:auto-resolve` };
        await handle.executeUpdate(resolveAppointmentCustomerUpdate, { args: [resolveInput] });
        for (let attempt = 0; attempt < 50; attempt += 1) {
          const current = await handle.query(getAppointmentStateQuery);
          const needsMoreIdentity = current.issues.some((item) =>
            item.code === 'CUSTOMER_INCOMPLETE' || item.code === 'CUSTOMER_NOT_FOUND');
          if (
            current.phase !== 'WAITING_FOR_CUSTOMER'
            || current.customer.status === 'AMBIGUOUS'
            || needsMoreIdentity
          ) break;
          await new Promise((resolve) => setTimeout(resolve, 20));
        }
      }

      return provided;
    }],
    ['RESOLVE_CUSTOMER', async (handle, envelope) => {
      const input: ResolveAppointmentCustomerInput = { inputId: channelOperationInputId(envelope) };
      return handle.executeUpdate(resolveAppointmentCustomerUpdate, { args: [input] });
    }],
    ['SELECT_MANAGED_ENTITY', async (handle, envelope) => {
      const input: SelectAppointmentManagedEntityInput = {
        inputId: channelOperationInputId(envelope),
        managedEntityId: stringField(envelope.payload as JsonRecord, 'managedEntityId'),
      };
      return handle.executeUpdate(selectAppointmentManagedEntityUpdate, { args: [input] });
    }],
    ['CREATE_MANAGED_ENTITY', async (handle, envelope) => {
      const payload = envelope.payload as JsonRecord;
      const summary = typeof payload.summary === 'string' && payload.summary.trim()
        ? payload.summary.trim()
        : undefined;
      const data = record(payload.data);
      const input: CreateAppointmentManagedEntityInput = {
        inputId: channelOperationInputId(envelope),
        displayName: stringField(payload, 'displayName'),
        externalRef: stringField(payload, 'externalRef'),
        ...(summary ? { summary } : {}),
        ...(data ? { data } : {}),
      };
      return handle.executeUpdate(createAppointmentManagedEntityUpdate, { args: [input] });
    }],
    ['SELECT_SERVICE', async (handle, envelope) => {
      const input: SelectAppointmentServiceInput = {
        inputId: channelOperationInputId(envelope),
        serviceId: stringField(envelope.payload as JsonRecord, 'serviceId'),
      };
      return handle.executeUpdate(selectAppointmentServiceUpdate, { args: [input] });
    }],
    ['SELECT_OFFERING', async (handle, envelope) => {
      const input: SelectAppointmentProductInput = {
        inputId: channelOperationInputId(envelope),
        productId: stringField(envelope.payload as JsonRecord, 'productId'),
      };
      return handle.executeUpdate(selectAppointmentProductUpdate, { args: [input] });
    }],
    ['SET_DATE', async (handle, envelope) => {
      const raw = stringField(envelope.payload as JsonRecord, 'dateInput');
      const parsed = normalizeAppointmentDateInput(raw, todayInTimeZone(BUSINESS_TIME_ZONE));
      if (!parsed.ok) throw new ChannelExecutionError(parsed.code, parsed.message);
      const input: SetAppointmentDateInput = {
        inputId: channelOperationInputId(envelope),
        appointmentDate: parsed.appointmentDate,
      };
      return handle.executeUpdate(setAppointmentDateUpdate, { args: [input] });
    }],
    ['SELECT_SLOT', async (handle, envelope) => {
      const input: SelectAppointmentSlotInput = {
        inputId: channelOperationInputId(envelope),
        slotStart: stringField(envelope.payload as JsonRecord, 'slotStart'),
      };
      return handle.executeUpdate(selectAppointmentSlotUpdate, { args: [input] });
    }],
    ['FINALIZE_APPOINTMENT', async (handle, envelope) => {
      const input: FinalizeAppointmentInput = { inputId: channelOperationInputId(envelope) };
      return handle.executeUpdate(finalizeAppointmentUpdate, { args: [input] });
    }],
  ]);
}

const ACTION_HANDLERS = actionHandlers();

export class AppointmentChannelExecutionCore {
  constructor(
    private readonly repository: PostgresChannelRepository,
    private readonly appointmentPort: TemporalRegisterNewAppointmentPort,
    private readonly catalog?: CatalogOfferingResolver,
  ) {}

  async execute(envelope: CanonicalChannelEnvelope): Promise<CanonicalChannelExecutionResponse> {
    const claim = await this.repository.claimInboundEvent(envelope);
    if (claim.kind === 'REPLAY_APPLIED' || claim.kind === 'REPLAY_REJECTED') {
      const saved = record(claim.response);
      const base: CanonicalChannelExecutionResponse = saved
        ? saved as CanonicalChannelExecutionResponse
        : {
          ok: claim.kind === 'REPLAY_APPLIED',
          replayed: false,
          ...(claim.event.errorCode ? { code: claim.event.errorCode } : {}),
        };
      return { ...base, replayed: true };
    }

    try {
      const response = envelope.action === 'START_APPOINTMENT'
        ? await this.startAppointment(envelope)
        : await this.updateAppointment(envelope);
      await this.repository.completeInboundEvent(envelope, response);
      return response;
    } catch (error) {
      if (error instanceof ChannelEventIdentityConflictError) throw error;
      const code = executionCode(error);
      const response: CanonicalChannelExecutionResponse = { ok: false, replayed: false, code };
      await this.repository.rejectInboundEvent(envelope, response, code);
      return response;
    }
  }

  private async startAppointment(envelope: CanonicalChannelEnvelope): Promise<CanonicalChannelExecutionResponse> {
    const draft = record(envelope.payload.draft);
    const adapted = adaptRegisterNewAppointmentCtaInput({
      businessSlug: envelope.businessSlug,
      idempotencyKey: channelOperationInputId(envelope),
      correlationId: envelope.externalConversationId,
      ...(draft ? { draft } : {}),
    }, { channel: envelope.channel.toLowerCase() });
    if (!adapted.ok) throw new ChannelExecutionError('CHANNEL_EVENT_INVALID', adapted.issues[0]?.message);

    const receipt = await this.appointmentPort.start(adapted.value);
    const binding = await this.repository.bindConversation({
      businessSlug: envelope.businessSlug,
      channel: envelope.channel,
      externalConversationId: envelope.externalConversationId,
      workflowId: receipt.workflowId,
      operation: 'RegisterNewAppointment',
    });
    return {
      ok: true,
      replayed: false,
      workflowId: receipt.workflowId,
      runId: receipt.runId,
      binding,
      operationResult: { status: 'WORKFLOW_ACCEPTED' },
    };
  }

  private async updateAppointment(envelope: CanonicalChannelEnvelope): Promise<CanonicalChannelExecutionResponse> {
    const binding = await this.repository.getConversationBinding({
      businessSlug: envelope.businessSlug,
      channel: envelope.channel,
      externalConversationId: envelope.externalConversationId,
    });
    if (!binding) throw new ChannelExecutionError('CHANNEL_CONVERSATION_NOT_BOUND');

    const handle = this.appointmentPort.client.workflow.getHandle(binding.workflowId);
    const operationResult = envelope.action === 'SELECT_OFFERING' && this.catalog
      ? await this.selectCatalogOffering(handle, envelope)
      : await this.executeHandler(handle, envelope);
    const state = await handle.query(getAppointmentStateQuery);
    const description = await handle.describe();
    const bindingStatus = state.workflowStatus === 'COMPLETED'
      ? 'COMPLETED'
      : state.workflowStatus === 'FAILED' ? 'FAILED' : 'ACTIVE';
    const updatedBinding = bindingStatus === binding.bindingStatus
      ? binding
      : await this.repository.updateBindingStatus({
        businessSlug: envelope.businessSlug,
        channel: envelope.channel,
        externalConversationId: envelope.externalConversationId,
        status: bindingStatus,
      }) ?? binding;

    return {
      ok: true,
      replayed: false,
      workflowId: binding.workflowId,
      runId: description.runId,
      binding: updatedBinding,
      operationResult,
    };
  }

  private async executeHandler(handle: WorkflowHandle, envelope: CanonicalChannelEnvelope): Promise<unknown> {
    const handler = ACTION_HANDLERS.get(envelope.action);
    if (!handler) throw new ChannelExecutionError('CHANNEL_OPERATION_NOT_SUPPORTED');
    return handler(handle, envelope);
  }

  /**
   * Canonical channels choose one CatalogOffering. The inherited Appointment
   * Workflow still stores a Service projection, so this compatibility seam
   * derives that parent internally without exposing a mandatory Service step.
   */
  private async selectCatalogOffering(handle: WorkflowHandle, envelope: CanonicalChannelEnvelope): Promise<unknown> {
    const raw = envelope.payload.catalogOfferingId ?? envelope.payload.productId;
    if (typeof raw !== 'string' || !raw.trim()) throw new ChannelExecutionError('CHANNEL_EVENT_INVALID', 'catalogOfferingId');
    const offering = await this.catalog!.getOffering(envelope.businessSlug, raw.trim());
    if (!offering) throw new ChannelExecutionError('PRODUCT_NOT_FOUND', raw.trim());
    const state = await handle.query(getAppointmentStateQuery);
    if (state.phase === 'WAITING_FOR_SERVICE') {
      await handle.executeUpdate(selectAppointmentServiceUpdate, {
        args: [{ inputId: `${channelOperationInputId(envelope)}:offering-parent`, serviceId: offering.serviceId }],
      });
      for (let attempt = 0; attempt < 50; attempt += 1) {
        const current = await handle.query(getAppointmentStateQuery);
        if (current.phase === 'WAITING_FOR_PRODUCT') break;
        await new Promise((resolve) => setTimeout(resolve, 20));
      }
    }
    return handle.executeUpdate(selectAppointmentProductUpdate, {
      args: [{ inputId: channelOperationInputId(envelope), productId: offering.offeringId }],
    });
  }
}
