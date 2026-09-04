import type { WorkflowHandle } from '@temporalio/client';
import { validateProvideCustomerDataIngress } from '../../contracts/register-new-customer/index.js';
import { adaptRegisterNewCustomerCtaInput } from '../register-new-customer.adapter.js';
import type { TemporalRegisterNewCustomerPort } from '../../orchestration/temporal/ports/register-new-customer.temporal-port.js';
import {
  finalizeRegistrationUpdate,
  getRegistrationStateQuery,
  provideCustomerDataUpdate,
  resolveCustomerDuplicateUpdate,
} from '../../orchestration/temporal/workflows/register-new-customer.workflow.js';
import {
  ChannelBindingConflictError,
  ChannelEventIdentityConflictError,
  PostgresChannelRepository,
} from '../../persistence/postgres/channel.repository.js';
import { channelOperationInputId } from './idempotency.js';
import { projectCustomerRegistration } from './customer-registration-view.js';
import type { CanonicalChannelEnvelope, CanonicalChannelExecutionResponse } from './types.js';

type JsonRecord = Record<string, unknown>;
function record(value: unknown): JsonRecord | undefined {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as JsonRecord : undefined;
}

function issueMessage(updateResult: unknown): string | undefined {
  const result = record(updateResult);
  if (result?.ok !== false || !Array.isArray(result.issues)) return undefined;
  const first = record(result.issues[0]);
  return typeof first?.message === 'string' ? first.message : 'Workflow Update rejected';
}

export class CustomerRegistrationChannelExecutionCore {
  constructor(
    private readonly repository: PostgresChannelRepository,
    private readonly customerPort: TemporalRegisterNewCustomerPort,
  ) {}

  async execute(envelope: CanonicalChannelEnvelope): Promise<CanonicalChannelExecutionResponse> {
    const claim = await this.repository.claimInboundEvent(envelope);
    if (claim.kind === 'REPLAY_APPLIED' || claim.kind === 'REPLAY_REJECTED') {
      const saved = record(claim.response) as CanonicalChannelExecutionResponse | undefined;
      return { ...(saved ?? { ok: claim.kind === 'REPLAY_APPLIED', replayed: false }), replayed: true };
    }
    try {
      const response = envelope.action === 'START_CUSTOMER_REGISTRATION'
        ? await this.start(envelope)
        : await this.update(envelope);
      await this.repository.completeInboundEvent(envelope, response);
      return response;
    } catch (error) {
      if (error instanceof ChannelEventIdentityConflictError) throw error;
      const code = error instanceof ChannelBindingConflictError
        ? error.code
        : error instanceof Error ? (error.message.split(':')[0] || 'CHANNEL_EVENT_PROCESSING_FAILED') : 'CHANNEL_EVENT_PROCESSING_FAILED';
      const response = { ok: false, replayed: false, code } as const;
      await this.repository.rejectInboundEvent(envelope, response, code);
      return response;
    }
  }

  private async start(envelope: CanonicalChannelEnvelope): Promise<CanonicalChannelExecutionResponse> {
    if (envelope.payload.consentAccepted !== true) throw new Error('CUSTOMER_REGISTRATION_CONSENT_REQUIRED');
    const draft = record(envelope.payload.draft);
    const adapted = adaptRegisterNewCustomerCtaInput({
      businessSlug: envelope.businessSlug,
      idempotencyKey: channelOperationInputId(envelope),
      correlationId: envelope.externalConversationId,
      registrationPolicyVersion: '2',
      ...(draft ? { draft } : {}),
    }, { channel: envelope.channel.toLowerCase() });
    if (!adapted.ok) throw new Error(`CHANNEL_EVENT_INVALID:${adapted.issues[0]?.message ?? 'draft'}`);
    const receipt = await this.customerPort.startRegisterNewCustomer(adapted.value);
    const binding = await this.repository.bindConversation({
      businessSlug: envelope.businessSlug,
      channel: envelope.channel,
      externalConversationId: envelope.externalConversationId,
      workflowId: receipt.workflowId,
      operation: 'RegisterNewCustomer',
    });
    return {
      ok: true,
      replayed: false,
      workflowId: receipt.workflowId,
      ...(receipt.runId ? { runId: receipt.runId } : {}),
      binding,
      operationResult: {
        status: 'WORKFLOW_ACCEPTED',
        consent: {
          accepted: true,
          channel: envelope.channel,
          externalConversationId: envelope.externalConversationId,
          eventId: envelope.externalMessageId,
        },
      },
    };
  }

  private async update(envelope: CanonicalChannelEnvelope): Promise<CanonicalChannelExecutionResponse> {
    const binding = await this.repository.getConversationBinding({
      businessSlug: envelope.businessSlug,
      channel: envelope.channel,
      externalConversationId: envelope.externalConversationId,
    });
    if (!binding || binding.operation !== 'RegisterNewCustomer') throw new Error('CHANNEL_CONVERSATION_NOT_BOUND');
    const handle = this.customerPort.getClient().workflow.getHandle(binding.workflowId) as WorkflowHandle;
    let updateResult: unknown;
    if (envelope.action === 'PROVIDE_CUSTOMER_DATA') {
      const customerPatch = record(envelope.payload.customerPatch);
      const validated = validateProvideCustomerDataIngress({ inputId: channelOperationInputId(envelope), customerPatch });
      if (!validated.ok) throw new Error(`CHANNEL_EVENT_INVALID:${validated.issues[0]?.message ?? 'customerPatch'}`);
      updateResult = await handle.executeUpdate(provideCustomerDataUpdate, { args: [validated.value] });
    } else if (envelope.action === 'FINALIZE_CUSTOMER_REGISTRATION') {
      updateResult = await handle.executeUpdate(finalizeRegistrationUpdate, {
        args: [{ inputId: channelOperationInputId(envelope) }],
      });
    } else if (envelope.action === 'RESOLVE_CUSTOMER_DUPLICATE') {
      const state = await handle.query(getRegistrationStateQuery);
      if (state.nextAction !== 'RESOLVE_DUPLICATE' || state.possibleDuplicate?.classification !== 'SOFT_MATCH') {
        throw new Error('CUSTOMER_DUPLICATE_RESOLUTION_NOT_AVAILABLE');
      }
      const decision = envelope.payload.decision;
      if (decision !== 'USE_EXISTING' && decision !== 'CREATE_NEW') {
        throw new Error('CHANNEL_EVENT_INVALID:duplicate decision');
      }
      if (decision === 'USE_EXISTING' && state.possibleDuplicate.candidateCustomerIds.length !== 1) {
        throw new Error('CUSTOMER_DUPLICATE_SELECTION_REQUIRED');
      }
      updateResult = await handle.executeUpdate(resolveCustomerDuplicateUpdate, {
        args: [{
          inputId: channelOperationInputId(envelope),
          decision,
          ...(decision === 'USE_EXISTING'
            ? { customerId: state.possibleDuplicate.candidateCustomerIds[0] }
            : {}),
        }],
      });
    } else {
      throw new Error('CHANNEL_OPERATION_NOT_SUPPORTED');
    }

    const rejectedMessage = issueMessage(updateResult);
    if (rejectedMessage) throw new Error(`CHANNEL_EVENT_INVALID:${rejectedMessage}`);

    const state = await handle.query(getRegistrationStateQuery);
    const description = await handle.describe();
    const bindingStatus = state.workflowStatus === 'COMPLETED' ? 'COMPLETED'
      : state.workflowStatus === 'FAILED' ? 'FAILED' : 'ACTIVE';
    const currentBinding = bindingStatus === binding.bindingStatus ? binding
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
      binding: currentBinding,
      operationResult: { updateResult, state, view: projectCustomerRegistration(state) },
    };
  }
}
