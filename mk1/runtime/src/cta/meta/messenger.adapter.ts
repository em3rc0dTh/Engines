import type { ChannelAdapter, TrustedChannelRoute } from '../channel-core/adapter-registry.js';
import type { CanonicalChannelEnvelope } from '../channel-core/types.js';

export type VerifiedMessengerInbound = Readonly<{
  verified: true;
  pageId: string;
  senderPsid: string;
  messageId: string;
  postbackPayload?: string;
}>;

export class MessengerAdapter implements ChannelAdapter<VerifiedMessengerInbound> {
  readonly channel = 'MESSENGER' as const;
  normalizeInbound(event: VerifiedMessengerInbound, route: TrustedChannelRoute): CanonicalChannelEnvelope {
    if (event.verified !== true) throw new Error('MESSENGER_WEBHOOK_UNAUTHENTICATED');
    if (event.postbackPayload !== 'register_appointment') throw new Error('CHANNEL_OPERATION_NOT_SUPPORTED');
    return {
      version: 'v1', channel: this.channel, businessSlug: route.businessSlug,
      externalConversationId: `messenger:${event.pageId}:${event.senderPsid}`,
      externalMessageId: `messenger:message:${event.messageId}`,
      externalSenderId: `messenger:psid:${event.senderPsid}`,
      action: 'START_APPOINTMENT', payload: {},
    };
  }
}
