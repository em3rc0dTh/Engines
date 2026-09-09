import { createHash } from 'node:crypto';
import { canonicalJson } from '../../contracts/register-new-customer/index.js';
import type { ChannelAdapter, TrustedChannelRoute } from '../channel-core/adapter-registry.js';
import type { CanonicalChannelEnvelope, ChannelKind } from '../channel-core/types.js';
import { CANONICAL_CTA_VERSION, type CTAChannel, type CTAProvider, type CanonicalCTAEvent, type CanonicalCTAEventType } from './types.js';

const PROVIDERS: Readonly<Record<ChannelKind, CTAProvider>> = {
  WEBCHAT: 'webchat', TELEGRAM: 'telegram', WHATSAPP: 'whatsapp', API: 'api',
  MESSENGER: 'messenger', FACEBOOK_COMMENT: 'facebook', TIKTOK: 'tiktok',
};
const CHANNELS: Readonly<Record<ChannelKind, CTAChannel>> = {
  WEBCHAT: 'web', TELEGRAM: 'telegram', WHATSAPP: 'whatsapp', API: 'api',
  MESSENGER: 'messenger', FACEBOOK_COMMENT: 'facebook_comment', TIKTOK: 'tiktok',
};
const EVENT_TYPES: Readonly<Record<ChannelKind, CanonicalCTAEventType>> = {
  WEBCHAT: 'button', TELEGRAM: 'command', WHATSAPP: 'postback', API: 'api_action',
  MESSENGER: 'postback', FACEBOOK_COMMENT: 'comment', TIKTOK: 'comment',
};

function digest(value: unknown): string {
  return createHash('sha256').update(canonicalJson(value), 'utf8').digest('hex');
}

export function toCanonicalCTAEvent(
  envelope: CanonicalChannelEnvelope,
  receivedAt: string,
): CanonicalCTAEvent | undefined {
  if (envelope.action !== 'START_APPOINTMENT') return undefined;
  const provider = PROVIDERS[envelope.channel];
  const channel = CHANNELS[envelope.channel];
  const identity = [envelope.businessSlug, provider, envelope.externalMessageId];
  return {
    version: CANONICAL_CTA_VERSION,
    eventId: `cta_${digest(identity)}`,
    provider,
    channel,
    businessSlug: envelope.businessSlug,
    providerEventId: envelope.externalMessageId,
    externalUserId: envelope.externalSenderId,
    externalConversationId: envelope.externalConversationId,
    action: 'register_appointment',
    eventType: EVENT_TYPES[envelope.channel],
    idempotencyKey: `cta:${digest(identity)}`,
    correlationId: envelope.externalConversationId,
    receivedAt,
    payload: envelope.payload,
  };
}

/** Non-destructive wrapper: provider adapters retain parsing/auth concerns. */
export function fromExistingAdapter<RawInbound>(
  adapter: ChannelAdapter<RawInbound>,
  raw: RawInbound,
  route: TrustedChannelRoute,
  receivedAt: string,
): CanonicalCTAEvent | undefined {
  const envelope = adapter.normalizeInbound(raw, route);
  return envelope ? toCanonicalCTAEvent(envelope, receivedAt) : undefined;
}
