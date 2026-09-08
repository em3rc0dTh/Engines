import type { CanonicalChannelEnvelope, ChannelKind } from '../channel-core/types.js';
import type { AppointmentChannelExecutionCore } from '../channel-core/appointment-channel-execution.js';
import type { CTAOrchestrationPort, CTAWorkflowReceipt } from './dispatcher.js';
import type { CanonicalCTAEvent, CTAChannel } from './types.js';

const CHANNEL_KIND: Readonly<Record<CTAChannel, ChannelKind>> = {
  web: 'WEBCHAT', telegram: 'TELEGRAM', whatsapp: 'WHATSAPP', api: 'API',
  messenger: 'MESSENGER', facebook_comment: 'FACEBOOK_COMMENT', tiktok: 'TIKTOK',
};

/** Reuses the certified Channel Core and Temporal port; it owns no provider logic. */
export class ChannelCoreCTAOrchestrationPort implements CTAOrchestrationPort {
  constructor(private readonly core: AppointmentChannelExecutionCore) {}

  async startRegisterAppointment(event: CanonicalCTAEvent): Promise<CTAWorkflowReceipt> {
    const envelope: CanonicalChannelEnvelope = {
      version: 'v1', channel: CHANNEL_KIND[event.channel], businessSlug: event.businessSlug,
      externalConversationId: event.externalConversationId, externalMessageId: event.providerEventId,
      externalSenderId: event.externalUserId, action: 'START_APPOINTMENT', payload: event.payload,
    };
    const result = await this.core.execute(envelope);
    if (!result.ok || !result.workflowId) throw new Error(result.code ?? 'CTA_WORKFLOW_START_FAILED');
    return { workflowId: result.workflowId };
  }
}
