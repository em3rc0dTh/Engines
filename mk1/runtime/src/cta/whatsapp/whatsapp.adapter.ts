import type { ChannelAdapter, TrustedChannelRoute } from '../channel-core/adapter-registry.js';
import type { CanonicalChannelEnvelope } from '../channel-core/types.js';
import type { VerifiedWhatsAppInbound } from './whatsapp.transport.js';

const PATCH_BY_INTENT = {
  ASK_CUSTOMER_NAME: (text: string) => ({ name: text }),
  ASK_CUSTOMER_EMAIL: (text: string) => ({ contact: { email: text } }),
  ASK_CUSTOMER_PHONE: (text: string) => ({ contact: { phones: [{ number: text }] } }),
} as const;

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
      if (event.interactiveId === 'register_customer_no') return undefined;
      if (event.interactiveId !== 'register_customer_yes') throw new Error('CHANNEL_OPERATION_NOT_SUPPORTED');
      return {
        ...base,
        action: 'START_CUSTOMER_REGISTRATION',
        payload: {
          consentAccepted: true,
          draft: { customer: { contact: { phones: [{ number: event.senderPhone, isWhatsapp: true, primary: true }] } } },
        },
      };
    }
    const text = event.text?.trim() ?? '';
    const intent = route.registrationRenderIntent;
    const patch = intent && intent in PATCH_BY_INTENT
      ? PATCH_BY_INTENT[intent as keyof typeof PATCH_BY_INTENT](text)
      : undefined;
    if (!text || !patch) throw new Error('WHATSAPP_CONTEXT_REQUIRED');
    return { ...base, action: 'PROVIDE_CUSTOMER_DATA', payload: { customerPatch: patch } };
  }
}
