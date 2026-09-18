import type { ChannelAdapter, TrustedChannelRoute } from '../channel-core/adapter-registry.js';
import type { CanonicalChannelEnvelope } from '../channel-core/types.js';

export type VerifiedMetaChannelM1Inbound = Readonly<{
  verified: true;
  pageId: string;
  senderId: string;
  messageId: string;
  text?: string;
  postback?: string;
}>;

const START_TRIGGERS = new Set(['cita', 'appointment', 'agendar', 'agendar cita']);

function normalized(value: string | undefined): string | undefined {
  const result = value?.trim().toLocaleLowerCase('es');
  return result || undefined;
}

export class MetaChannelM1Adapter implements ChannelAdapter<VerifiedMetaChannelM1Inbound> {
  readonly channel = 'MESSENGER' as const;

  normalizeInbound(
    event: VerifiedMetaChannelM1Inbound,
    route: TrustedChannelRoute,
  ): CanonicalChannelEnvelope | undefined {
    if (!event.verified) throw new Error('META_CHANNEL_UNAUTHENTICATED');

    const text = normalized(event.text);
    const triggerSource = event.postback === 'register_appointment'
      ? 'postback'
      : text && START_TRIGGERS.has(text) ? 'message' : undefined;

    if (!triggerSource) return undefined;

    return {
      version: 'v1',
      channel: this.channel,
      businessSlug: route.businessSlug,
      externalConversationId: `messenger:${event.pageId}:${event.senderId}`,
      externalMessageId: `messenger:message:${event.messageId}`,
      externalSenderId: `messenger:psid:${event.senderId}`,
      action: 'START_APPOINTMENT',
      payload: { triggerSource },
    };
  }
}
