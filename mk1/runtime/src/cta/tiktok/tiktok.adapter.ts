import type { ChannelAdapter, TrustedChannelRoute } from '../channel-core/adapter-registry.js';
import type { CanonicalChannelEnvelope } from '../channel-core/types.js';

export type VerifiedTikTokInbound = Readonly<{
  verified: true;
  eventId: string;
  conversationId: string;
  userId: string;
  kind: 'COMMENT' | 'DIRECT_MESSAGE';
  text: string;
}>;

const TRIGGERS = new Set(['cita', 'appointment', 'agendar']);

export class TikTokAdapter implements ChannelAdapter<VerifiedTikTokInbound> {
  readonly channel = 'TIKTOK' as const;
  normalizeInbound(event: VerifiedTikTokInbound, route: TrustedChannelRoute): CanonicalChannelEnvelope | undefined {
    if (event.verified !== true) throw new Error('TIKTOK_WEBHOOK_UNAUTHENTICATED');
    if (!TRIGGERS.has(event.text.trim().toLocaleLowerCase('es'))) return undefined;
    return {
      version: 'v1', channel: this.channel, businessSlug: route.businessSlug,
      externalConversationId: `tiktok:${event.conversationId}`,
      externalMessageId: `tiktok:event:${event.eventId}`,
      externalSenderId: `tiktok:user:${event.userId}`,
      action: 'START_APPOINTMENT',
      payload: { privateContinuationRequired: event.kind === 'COMMENT', sourceKind: event.kind },
    };
  }
}
