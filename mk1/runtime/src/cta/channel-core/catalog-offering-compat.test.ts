import assert from 'node:assert/strict';
import test from 'node:test';
import { AppointmentChannelExecutionCore } from './appointment-channel-execution.js';
import type { CanonicalChannelEnvelope, ChannelInboundEvent } from './types.js';
import type { PostgresChannelRepository } from '../../persistence/postgres/channel.repository.js';
import type { TemporalRegisterNewAppointmentPort } from '../../orchestration/temporal/ports/register-new-appointment.temporal-port.js';

test('canonical SELECT_OFFERING derives legacy Service parent internally', async () => {
  const envelope: CanonicalChannelEnvelope = {
    version: 'v1', channel: 'API', businessSlug: 'golden-business',
    externalConversationId: 'conversation-1', externalMessageId: 'message-2', externalSenderId: 'user-1',
    action: 'SELECT_OFFERING', payload: { catalogOfferingId: 'offering-1' },
  };
  const storedEvent: ChannelInboundEvent = {
    businessSlug: envelope.businessSlug, channel: envelope.channel,
    externalMessageId: envelope.externalMessageId, externalConversationId: envelope.externalConversationId,
    materialHash: 'hash', status: 'PROCESSING', createdAt: '2026-09-08T00:00:00Z', updatedAt: '2026-09-08T00:00:00Z',
  };
  const repository = {
    claimInboundEvent: async () => ({ kind: 'CLAIMED', event: storedEvent }),
    getConversationBinding: async () => ({
      businessSlug: envelope.businessSlug, channel: envelope.channel, externalConversationId: envelope.externalConversationId,
      workflowId: 'workflow-1', operation: 'RegisterNewAppointment', bindingStatus: 'ACTIVE',
      createdAt: '2026-09-08T00:00:00Z', updatedAt: '2026-09-08T00:00:00Z',
    }),
    completeInboundEvent: async () => storedEvent,
  } as unknown as PostgresChannelRepository;

  const updates: unknown[] = [];
  const handle = {
    executeUpdate: async (_definition: unknown, options: { args: unknown[] }) => {
      updates.push(options.args[0]);
      return { ok: true };
    },
    query: async () => ({
      workflowId: 'workflow-1', workflowStatus: 'RUNNING',
      phase: updates.length === 0 ? 'WAITING_FOR_SERVICE' : 'WAITING_FOR_PRODUCT',
      customer: { status: 'EXISTING' }, services: [], products: [], availableSlots: [], nextAction: 'SELECT_PRODUCT', issues: [],
    }),
    describe: async () => ({ runId: 'run-1' }),
  };
  const port = { client: { workflow: { getHandle: () => handle } } } as unknown as TemporalRegisterNewAppointmentPort;
  const core = new AppointmentChannelExecutionCore(repository, port, {
    getOffering: async () => ({ serviceId: 'service-parent', offeringId: 'offering-1' }),
  });

  const result = await core.execute(envelope);
  assert.equal(result.ok, true);
  assert.deepEqual(updates, [
    { inputId: 'channel:api:message-2:offering-parent', serviceId: 'service-parent' },
    { inputId: 'channel:api:message-2', productId: 'offering-1' },
  ]);
});
