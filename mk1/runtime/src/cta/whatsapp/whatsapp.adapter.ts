import type { ChannelAdapter, TrustedChannelRoute } from '../channel-core/adapter-registry.js';
import type { CanonicalChannelEnvelope } from '../channel-core/types.js';
import type { VerifiedWhatsAppInbound } from './whatsapp.transport.js';

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
  throw new Error('WHATSAPP_CONTEXT_REQUIRED');
}

function interactiveValue(data: string, prefix: string): string {
  if (!data.startsWith(prefix)) contextRequired();
  const value = data.slice(prefix.length).trim();
  if (!value) throw new Error('WHATSAPP_EVENT_INVALID:interactiveId');
  return value;
}

function appointmentCommand(text: string): boolean {
  return /^\/?(?:appointment|cita)$/i.test(text.trim());
}

export class WhatsAppAdapter implements ChannelAdapter<VerifiedWhatsAppInbound> {
  readonly channel = 'WHATSAPP' as const;

  normalizeInbound(event: VerifiedWhatsAppInbound, route: TrustedChannelRoute): CanonicalChannelEnvelope | undefined {
    if (event.verified !== true) throw new Error('WHATSAPP_WEBHOOK_UNAUTHENTICATED');
    const base = {
      version: 'v1' as const,
      channel: this.channel,
      businessSlug: route.businessSlug,
      externalConversationId: `whatsapp:${event.conversationId}`,
      externalMessageId: `whatsapp:message:${event.messageId}`,
      externalSenderId: `whatsapp:user:${event.senderId}`,
    };

    if (event.kind === 'INTERACTIVE') {
      const interactiveId = event.interactiveId?.trim() ?? '';
      if (interactiveId === 'register_appointment') {
        const draft = event.senderPhone
          ? { customer: { customer: { contact: { phones: [{ number: event.senderPhone, isWhatsapp: true, primary: true }] } } } }
          : undefined;
        return { ...base, action: 'START_APPOINTMENT', payload: { ...(draft ? { draft } : {}) } };
      }
      if (interactiveId === 'appointment_resolve_customer') {
        if (route.appointmentRenderIntent !== 'RESOLVE_CUSTOMER') contextRequired();
        return { ...base, action: 'RESOLVE_CUSTOMER', payload: {} };
      }
      if (interactiveId.startsWith('appointment_customer:')) {
        if (route.appointmentRenderIntent !== 'RESOLVE_CUSTOMER') contextRequired();
        return {
          ...base,
          action: 'PROVIDE_CUSTOMER',
          payload: { customerId: interactiveValue(interactiveId, 'appointment_customer:') },
        };
      }
      if (interactiveId.startsWith('appointment_service:')) {
        if (route.appointmentRenderIntent !== 'SELECT_SERVICE') contextRequired();
        return {
          ...base,
          action: 'SELECT_SERVICE',
          payload: { serviceId: interactiveValue(interactiveId, 'appointment_service:') },
        };
      }
      if (interactiveId.startsWith('appointment_offering:')) {
        if (route.appointmentRenderIntent !== 'SELECT_OFFERING') contextRequired();
        return {
          ...base,
          action: 'SELECT_OFFERING',
          payload: { productId: interactiveValue(interactiveId, 'appointment_offering:') },
        };
      }
      if (interactiveId.startsWith('appointment_slot:')) {
        if (route.appointmentRenderIntent !== 'SELECT_SLOT') contextRequired();
        return {
          ...base,
          action: 'SELECT_SLOT',
          payload: { slotStart: interactiveValue(interactiveId, 'appointment_slot:') },
        };
      }
      if (interactiveId === 'appointment_finalize') {
        if (route.appointmentRenderIntent !== 'FINALIZE_APPOINTMENT') contextRequired();
        return { ...base, action: 'FINALIZE_APPOINTMENT', payload: {} };
      }
      if (interactiveId === 'register_customer_no') return undefined;
      if (interactiveId === 'register_customer_yes') {
        const draft = event.senderPhone
          ? { customer: { contact: { phones: [{ number: event.senderPhone, isWhatsapp: true, primary: true }] } } }
          : undefined;
        return {
          ...base,
          action: 'START_CUSTOMER_REGISTRATION',
          payload: {
            consentAccepted: true,
            ...(draft ? { draft } : {}),
          },
        };
      }
      if (interactiveId === 'resolve_customer_duplicate_existing' || interactiveId === 'resolve_customer_duplicate_new') {
        if (route.registrationRenderIntent !== 'RESOLVE_CUSTOMER_DUPLICATE') contextRequired();
        return {
          ...base,
          action: 'RESOLVE_CUSTOMER_DUPLICATE',
          payload: {
            decision: interactiveId === 'resolve_customer_duplicate_existing' ? 'USE_EXISTING' : 'CREATE_NEW',
          },
        };
      }
      throw new Error('CHANNEL_OPERATION_NOT_SUPPORTED');
    }

    const text = event.text?.trim() ?? '';
    if (appointmentCommand(text)) {
      const draft = event.senderPhone
        ? { customer: { customer: { contact: { phones: [{ number: event.senderPhone, isWhatsapp: true, primary: true }] } } } }
        : undefined;
      return { ...base, action: 'START_APPOINTMENT', payload: { ...(draft ? { draft } : {}) } };
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
    if (!text || !patch) contextRequired();
    return { ...base, action: 'PROVIDE_CUSTOMER_DATA', payload: { customerPatch: patch } };
  }
}
