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

const REGISTRATION_PATCH_BY_INTENT = {
  ASK_CUSTOMER_NAME: (text: string) => ({ name: text }),
  ASK_CUSTOMER_EMAIL: (text: string) => ({ contact: { email: text } }),
  ASK_CUSTOMER_PHONE: (text: string) => ({ contact: { phones: [{ number: text }] } }),
} as const;

const APPOINTMENT_PATCH_BY_INTENT = {
  ASK_CUSTOMER_NAME: (text: string) => ({ customerPatch: { name: text } }),
  ASK_CUSTOMER_EMAIL: (text: string) => ({ customerPatch: { contact: { email: text } } }),
  ASK_CUSTOMER_PHONE: (text: string) => ({ customerPatch: { contact: { phones: [{ number: text }] } } }),
} as const;

function contextRequired(): never {
  throw new Error('TELEGRAM_CONTEXT_REQUIRED');
}

function callbackValue(data: string, prefix: string): string {
  if (!data.startsWith(prefix)) contextRequired();
  const value = data.slice(prefix.length).trim();
  if (!value) throw new Error('TELEGRAM_EVENT_INVALID:callback_query.data');
  return value;
}

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
      if (data === 'register_appointment') {
        return { ...base, action: 'START_APPOINTMENT', payload: {} };
      }
      if (data === 'appointment_resolve_customer') {
        if (route.appointmentRenderIntent !== 'RESOLVE_CUSTOMER') contextRequired();
        return { ...base, action: 'RESOLVE_CUSTOMER', payload: {} };
      }
      if (data.startsWith('appointment_customer:')) {
        if (route.appointmentRenderIntent !== 'RESOLVE_CUSTOMER') contextRequired();
        return {
          ...base,
          action: 'PROVIDE_CUSTOMER',
          payload: { customerId: callbackValue(data, 'appointment_customer:') },
        };
      }
      if (data.startsWith('appointment_service:')) {
        if (route.appointmentRenderIntent !== 'SELECT_SERVICE') contextRequired();
        return { ...base, action: 'SELECT_SERVICE', payload: { serviceId: callbackValue(data, 'appointment_service:') } };
      }
      if (data.startsWith('appointment_offering:')) {
        if (route.appointmentRenderIntent !== 'SELECT_OFFERING') contextRequired();
        return { ...base, action: 'SELECT_OFFERING', payload: { productId: callbackValue(data, 'appointment_offering:') } };
      }
      if (data.startsWith('appointment_slot:')) {
        if (route.appointmentRenderIntent !== 'SELECT_SLOT') contextRequired();
        return { ...base, action: 'SELECT_SLOT', payload: { slotStart: callbackValue(data, 'appointment_slot:') } };
      }
      if (data === 'appointment_finalize') {
        if (route.appointmentRenderIntent !== 'FINALIZE_APPOINTMENT') contextRequired();
        return { ...base, action: 'FINALIZE_APPOINTMENT', payload: {} };
      }
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
      const phonePatch = { contact: { phones: [{ number: id(contact.phone_number, 'contact.phone_number') }] } };
      if (route.appointmentRenderIntent === 'ASK_CUSTOMER_PHONE') {
        return { ...base, action: 'PROVIDE_CUSTOMER', payload: { customerPatch: phonePatch } };
      }
      return {
        ...base,
        action: 'PROVIDE_CUSTOMER_DATA',
        payload: { customerPatch: phonePatch },
      };
    }

    const text = typeof message?.text === 'string' ? message.text.trim() : '';
    if (/^\/(?:appointment|cita)(?:@\w+)?(?:\s|$)/i.test(text)) {
      return { ...base, action: 'START_APPOINTMENT', payload: {} };
    }

    const appointmentIntent = route.appointmentRenderIntent;
    if (appointmentIntent) {
      if (appointmentIntent === 'ASK_DATE') {
        if (!text) contextRequired();
        return { ...base, action: 'SET_DATE', payload: { dateInput: text } };
      }
      if (appointmentIntent in APPOINTMENT_PATCH_BY_INTENT) {
        if (!text) contextRequired();
        const payload = APPOINTMENT_PATCH_BY_INTENT[
          appointmentIntent as keyof typeof APPOINTMENT_PATCH_BY_INTENT
        ](text);
        return { ...base, action: 'PROVIDE_CUSTOMER', payload };
      }
      contextRequired();
    }

    const intent = route.registrationRenderIntent;
    const patch = intent && intent in REGISTRATION_PATCH_BY_INTENT
      ? REGISTRATION_PATCH_BY_INTENT[intent as keyof typeof REGISTRATION_PATCH_BY_INTENT](text)
      : undefined;
    if (!text || !patch) throw new Error('TELEGRAM_CONTEXT_REQUIRED');
    return { ...base, action: 'PROVIDE_CUSTOMER_DATA', payload: { customerPatch: patch } };
  }
}
