import type { ChannelAdapter, TrustedChannelRoute } from '../channel-core/adapter-registry.js';
import type { CanonicalChannelEnvelope } from '../channel-core/types.js';

export type VerifiedFacebookCommentInbound = Readonly<{
  verified: true;
  pageId: string;
  postId: string;
  commentId: string;
  senderId: string;
  text: string;
}>;

const TRIGGERS = new Set(['cita', 'appointment', 'agendar']);

export class FacebookCommentAdapter implements ChannelAdapter<VerifiedFacebookCommentInbound> {
  readonly channel = 'FACEBOOK_COMMENT' as const;
  normalizeInbound(event: VerifiedFacebookCommentInbound, route: TrustedChannelRoute): CanonicalChannelEnvelope | undefined {
    if (event.verified !== true) throw new Error('FACEBOOK_WEBHOOK_UNAUTHENTICATED');
    if (!TRIGGERS.has(event.text.trim().toLocaleLowerCase('es'))) return undefined;
    return {
      version: 'v1', channel: this.channel, businessSlug: route.businessSlug,
      externalConversationId: `facebook:post:${event.postId}:user:${event.senderId}`,
      externalMessageId: `facebook:comment:${event.commentId}`,
      externalSenderId: `facebook:user:${event.senderId}`,
      action: 'START_APPOINTMENT',
      payload: { publicTriggerOnly: true, privateContinuationRequired: true, pageId: event.pageId, postId: event.postId },
    };
  }
}
