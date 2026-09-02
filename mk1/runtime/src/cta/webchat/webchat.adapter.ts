import type { CanonicalChannelAction, CanonicalChannelEnvelope } from '../channel-core/types.js';
import type { ChannelAdapter, TrustedChannelRoute } from '../channel-core/adapter-registry.js';

export type WebChatInboundEvent = Readonly<{
  conversationId: string;
  messageId: string;
  senderId: string;
  operation: CanonicalChannelAction;
  data?: Readonly<Record<string, unknown>>;
}>;

function record(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined;
}

function requiredString(source: Record<string, unknown>, key: string): string {
  const value = source[key];
  if (typeof value !== 'string' || !value.trim()) throw new Error(`CHANNEL_EVENT_INVALID:${key}`);
  return value.trim();
}

const ACTIONS = new Set<CanonicalChannelAction>([
  'START_APPOINTMENT',
  'PROVIDE_CUSTOMER',
  'RESOLVE_CUSTOMER',
  'SELECT_SERVICE',
  'SELECT_OFFERING',
  'SET_DATE',
  'SELECT_SLOT',
  'FINALIZE_APPOINTMENT',
]);

export class WebChatAdapter implements ChannelAdapter<unknown> {
  readonly channel = 'WEBCHAT' as const;

  normalizeInbound(raw: unknown, route: TrustedChannelRoute): CanonicalChannelEnvelope {
    const body = record(raw);
    if (!body) throw new Error('CHANNEL_EVENT_INVALID:body');
    const operation = requiredString(body, 'operation');
    if (!ACTIONS.has(operation as CanonicalChannelAction)) throw new Error('CHANNEL_OPERATION_NOT_SUPPORTED');
    const payload = body.data === undefined ? {} : record(body.data);
    if (!payload) throw new Error('CHANNEL_EVENT_INVALID:data');

    return {
      version: 'v1',
      channel: this.channel,
      businessSlug: route.businessSlug,
      externalConversationId: requiredString(body, 'conversationId'),
      externalMessageId: requiredString(body, 'messageId'),
      externalSenderId: requiredString(body, 'senderId'),
      action: operation as CanonicalChannelAction,
      payload,
    };
  }
}
