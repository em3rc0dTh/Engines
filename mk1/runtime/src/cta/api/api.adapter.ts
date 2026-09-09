import type { ChannelAdapter, TrustedChannelRoute } from '../channel-core/adapter-registry.js';
import type { CanonicalChannelEnvelope } from '../channel-core/types.js';

type ApiCTA = Readonly<{
  eventId: string;
  conversationId: string;
  userId: string;
  action: 'register_appointment';
  payload?: Readonly<Record<string, unknown>>;
}>;

export class ApiCTAAdapter implements ChannelAdapter<ApiCTA> {
  readonly channel = 'API' as const;
  normalizeInbound(raw: ApiCTA, route: TrustedChannelRoute): CanonicalChannelEnvelope {
    if (raw.action !== 'register_appointment') throw new Error('CHANNEL_OPERATION_NOT_SUPPORTED');
    if (!raw.eventId?.trim() || !raw.conversationId?.trim() || !raw.userId?.trim()) {
      throw new Error('API_EVENT_INVALID');
    }
    return {
      version: 'v1', channel: this.channel, businessSlug: route.businessSlug,
      externalConversationId: raw.conversationId.trim(), externalMessageId: raw.eventId.trim(),
      externalSenderId: raw.userId.trim(), action: 'START_APPOINTMENT', payload: raw.payload ?? {},
    };
  }
}
