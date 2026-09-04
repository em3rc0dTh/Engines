import type { ChannelAdapter, TrustedChannelRoute } from '../channel-core/adapter-registry.js';
import type { CanonicalChannelEnvelope } from '../channel-core/types.js';

type Json = Record<string, unknown>;
function record(value: unknown): Json | undefined {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Json : undefined;
}
function id(value: unknown, path: string): string {
  if ((typeof value !== 'string' && typeof value !== 'number') || String(value).trim() === '') {
    throw new Error(`TELEGRAM_EVENT_INVALID:${path}`);
  }
  return String(value);
}

const PATCH_BY_INTENT = {
  ASK_CUSTOMER_NAME: (text: string) => ({ name: text }),
  ASK_CUSTOMER_EMAIL: (text: string) => ({ contact: { email: text } }),
  ASK_CUSTOMER_PHONE: (text: string) => ({ contact: { phones: [{ number: text }] } }),
} as const;

export class TelegramAdapter implements ChannelAdapter<unknown> {
  readonly channel = 'TELEGRAM' as const;

  normalizeInbound(raw: unknown, route: TrustedChannelRoute): CanonicalChannelEnvelope | undefined {
    const update = record(raw);
    if (!update) throw new Error('TELEGRAM_EVENT_INVALID:body');
    const updateId = id(update.update_id, 'update_id');
    const callback = record(update.callback_query);
    const message = record(update.message) ?? record(callback?.message);
    const chat = record(message?.chat);
    const sender = record(callback?.from) ?? record(message?.from);
    const senderId = id(sender?.id, 'from.id');
    const base = {
      version: 'v1' as const,
      channel: this.channel,
      businessSlug: route.businessSlug,
      externalConversationId: `telegram:${id(chat?.id, 'chat.id')}`,
      externalMessageId: `telegram:update:${updateId}`,
      externalSenderId: `telegram:user:${senderId}`,
    };

    if (callback) {
      const data = id(callback.data, 'callback_query.data');
      if (data === 'register_customer_no') return undefined;
      if (data === 'register_customer_yes') {
        return { ...base, action: 'START_CUSTOMER_REGISTRATION', payload: { consentAccepted: true } };
      }
      if (data === 'resolve_customer_duplicate_existing' || data === 'resolve_customer_duplicate_new') {
        if (route.registrationRenderIntent !== 'RESOLVE_CUSTOMER_DUPLICATE') {
          throw new Error('TELEGRAM_CONTEXT_REQUIRED');
        }
        return {
          ...base,
          action: 'RESOLVE_CUSTOMER_DUPLICATE',
          payload: { decision: data === 'resolve_customer_duplicate_existing' ? 'USE_EXISTING' : 'CREATE_NEW' },
        };
      }
      throw new Error('CHANNEL_OPERATION_NOT_SUPPORTED');
    }

    const contact = record(message?.contact);
    if (contact) {
      if (contact.user_id !== undefined && id(contact.user_id, 'contact.user_id') !== senderId) {
        throw new Error('TELEGRAM_CONTACT_SENDER_MISMATCH');
      }
      return {
        ...base,
        action: 'PROVIDE_CUSTOMER_DATA',
        payload: { customerPatch: { contact: { phones: [{ number: id(contact.phone_number, 'contact.phone_number') }] } } },
      };
    }

    const text = typeof message?.text === 'string' ? message.text.trim() : '';
    const intent = route.registrationRenderIntent;
    const patch = intent && intent in PATCH_BY_INTENT
      ? PATCH_BY_INTENT[intent as keyof typeof PATCH_BY_INTENT](text)
      : undefined;
    if (!text || !patch) throw new Error('TELEGRAM_CONTEXT_REQUIRED');
    return { ...base, action: 'PROVIDE_CUSTOMER_DATA', payload: { customerPatch: patch } };
  }
}
