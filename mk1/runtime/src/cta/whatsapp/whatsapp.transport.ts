import { createHmac, timingSafeEqual } from 'node:crypto';

export type VerifiedWhatsAppInbound = Readonly<{
  verified: true;
  provider: 'META_CLOUD_API' | 'KAPSO';
  conversationId: string;
  messageId: string;
  senderId: string;
  senderPhone: string;
  kind: 'TEXT' | 'INTERACTIVE';
  text?: string;
  interactiveId?: string;
}>;

export interface WhatsAppTransportPort {
  verifyAndNormalize(body: string, headers: Readonly<Record<string, string | undefined>>): VerifiedWhatsAppInbound;
  send(to: string, message: Readonly<Record<string, unknown>>): Promise<void>;
}

function safeHexEqual(left: string, right: string): boolean {
  if (!/^[a-f\d]+$/i.test(left) || !/^[a-f\d]+$/i.test(right) || left.length !== right.length) return false;
  return timingSafeEqual(Buffer.from(left, 'hex'), Buffer.from(right, 'hex'));
}

export function verifyHmacSha256(body: string, signature: string | undefined, secret: string): void {
  const supplied = signature?.replace(/^sha256=/, '') ?? '';
  const expected = createHmac('sha256', secret).update(body).digest('hex');
  if (!safeHexEqual(supplied, expected)) throw new Error('WHATSAPP_WEBHOOK_UNAUTHENTICATED');
}

type ProviderPayload = Readonly<{
  conversationId: string; messageId: string; senderId: string; senderPhone: string;
  kind: 'TEXT' | 'INTERACTIVE'; text?: string; interactiveId?: string;
}>;

function parseProviderPayload(body: string): ProviderPayload {
  const value = JSON.parse(body) as Partial<ProviderPayload>;
  for (const key of ['conversationId', 'messageId', 'senderId', 'senderPhone'] as const) {
    if (typeof value[key] !== 'string' || !value[key]?.trim()) throw new Error(`WHATSAPP_EVENT_INVALID:${key}`);
  }
  if (value.kind !== 'TEXT' && value.kind !== 'INTERACTIVE') throw new Error('WHATSAPP_EVENT_INVALID:kind');
  return value as ProviderPayload;
}

abstract class HmacWhatsAppTransport implements WhatsAppTransportPort {
  abstract readonly provider: VerifiedWhatsAppInbound['provider'];
  abstract readonly signatureHeader: string;
  constructor(private readonly secret: string, private readonly sender: WhatsAppTransportPort['send']) {}
  verifyAndNormalize(body: string, headers: Readonly<Record<string, string | undefined>>): VerifiedWhatsAppInbound {
    verifyHmacSha256(body, headers[this.signatureHeader], this.secret);
    return { verified: true, provider: this.provider, ...parseProviderPayload(body) };
  }
  send(to: string, message: Readonly<Record<string, unknown>>): Promise<void> { return this.sender(to, message); }
}

export class MetaCloudApiTransport extends HmacWhatsAppTransport {
  readonly provider = 'META_CLOUD_API' as const;
  readonly signatureHeader = 'x-hub-signature-256';
}

export class KapsoTransport extends HmacWhatsAppTransport {
  readonly provider = 'KAPSO' as const;
  readonly signatureHeader = 'x-kapso-signature';
}
