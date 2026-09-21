import { verifyHmacSha256, type VerifiedWhatsAppInbound } from './whatsapp.transport.js';

export type MetaCloudApiWebhookOptions = Readonly<{
  appSecret: string;
  expectedPhoneNumberId?: string;
}>;

export type MetaCloudApiClientOptions = Readonly<{
  accessToken: string;
  phoneNumberId: string;
  graphApiVersion: string;
  fetchFn?: typeof fetch;
  baseUrl?: string;
}>;

type JsonRecord = Record<string, unknown>;

function record(value: unknown): JsonRecord | undefined {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as JsonRecord : undefined;
}

function records(value: unknown): JsonRecord[] {
  return Array.isArray(value) ? value.map(record).filter((item): item is JsonRecord => Boolean(item)) : [];
}

function requiredString(value: unknown, code: string): string {
  if (typeof value !== 'string' || !value.trim()) throw new Error(code);
  return value.trim();
}

function normalizePhone(value: string): string {
  const digits = value.replace(/\D/g, '');
  if (!digits) throw new Error('WHATSAPP_META_EVENT_INVALID:senderPhone');
  return `+${digits}`;
}

function interactiveId(message: JsonRecord): string | undefined {
  const interactive = record(message.interactive);
  const buttonReply = record(interactive?.button_reply);
  if (typeof buttonReply?.id === 'string' && buttonReply.id.trim()) return buttonReply.id.trim();
  const listReply = record(interactive?.list_reply);
  if (typeof listReply?.id === 'string' && listReply.id.trim()) return listReply.id.trim();
  const button = record(message.button);
  if (typeof button?.payload === 'string' && button.payload.trim()) return button.payload.trim();
  return undefined;
}

function normalizeMessage(message: JsonRecord, phoneNumberId: string): VerifiedWhatsAppInbound | undefined {
  const messageId = requiredString(message.id, 'WHATSAPP_META_EVENT_INVALID:messageId');
  const senderId = requiredString(message.from, 'WHATSAPP_META_EVENT_INVALID:senderId');
  const type = typeof message.type === 'string' ? message.type : '';

  if (type === 'text') {
    const text = requiredString(record(message.text)?.body, 'WHATSAPP_META_EVENT_INVALID:text');
    return {
      verified: true,
      provider: 'META_CLOUD_API',
      conversationId: `${phoneNumberId}:${senderId}`,
      messageId,
      senderId,
      senderPhone: normalizePhone(senderId),
      kind: 'TEXT',
      text,
    };
  }

  if (type === 'interactive' || type === 'button') {
    const id = interactiveId(message);
    if (!id) throw new Error('WHATSAPP_META_EVENT_INVALID:interactiveId');
    return {
      verified: true,
      provider: 'META_CLOUD_API',
      conversationId: `${phoneNumberId}:${senderId}`,
      messageId,
      senderId,
      senderPhone: normalizePhone(senderId),
      kind: 'INTERACTIVE',
      interactiveId: id,
    };
  }

  // Status notifications, media, reactions and other unsupported message types are
  // acknowledged by the physical runner but do not cross the Customer CTA boundary.
  return undefined;
}

export function verifyMetaWebhookChallenge(
  url: URL,
  expectedVerifyToken: string,
): string | undefined {
  const mode = url.searchParams.get('hub.mode');
  const token = url.searchParams.get('hub.verify_token');
  const challenge = url.searchParams.get('hub.challenge');
  if (mode !== 'subscribe' || !challenge || token !== expectedVerifyToken) return undefined;
  return challenge;
}

export function decodeMetaCloudApiWebhook(
  body: string,
  headers: Readonly<Record<string, string | undefined>>,
  options: MetaCloudApiWebhookOptions,
): readonly VerifiedWhatsAppInbound[] {
  verifyHmacSha256(body, headers['x-hub-signature-256'], options.appSecret);

  const payload = record(JSON.parse(body));
  if (!payload || payload.object !== 'whatsapp_business_account') {
    throw new Error('WHATSAPP_META_EVENT_INVALID:object');
  }

  const output: VerifiedWhatsAppInbound[] = [];
  for (const entry of records(payload.entry)) {
    for (const change of records(entry.changes)) {
      if (change.field !== 'messages') continue;
      const value = record(change.value);
      if (!value || value.messaging_product !== 'whatsapp') continue;
      const metadata = record(value.metadata);
      const phoneNumberId = requiredString(metadata?.phone_number_id, 'WHATSAPP_META_EVENT_INVALID:phoneNumberId');
      if (options.expectedPhoneNumberId && phoneNumberId !== options.expectedPhoneNumberId) {
        throw new Error('WHATSAPP_META_PHONE_NUMBER_ID_MISMATCH');
      }
      for (const message of records(value.messages)) {
        const normalized = normalizeMessage(message, phoneNumberId);
        if (normalized) output.push(normalized);
      }
    }
  }
  return output;
}

function outboundPayload(to: string, message: Readonly<Record<string, unknown>>): JsonRecord {
  const normalizedTo = to.replace(/\D/g, '');
  if (!normalizedTo) throw new Error('WHATSAPP_CLOUD_API_SEND_INVALID:to');

  if (message.type === 'text') {
    const body = requiredString(message.text, 'WHATSAPP_CLOUD_API_SEND_INVALID:text');
    return {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: normalizedTo,
      type: 'text',
      text: { body },
    };
  }

  if (message.type === 'interactive') {
    const body = requiredString(message.body, 'WHATSAPP_CLOUD_API_SEND_INVALID:body');
    const buttons = records(message.buttons).map((button) => ({
      type: 'reply',
      reply: {
        id: requiredString(button.id, 'WHATSAPP_CLOUD_API_SEND_INVALID:buttonId'),
        title: requiredString(button.title, 'WHATSAPP_CLOUD_API_SEND_INVALID:buttonTitle'),
      },
    }));
    if (!buttons.length || buttons.length > 3) throw new Error('WHATSAPP_CLOUD_API_SEND_INVALID:buttons');
    return {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: normalizedTo,
      type: 'interactive',
      interactive: {
        type: 'button',
        body: { text: body },
        action: { buttons },
      },
    };
  }

  throw new Error('WHATSAPP_CLOUD_API_SEND_INVALID:type');
}

export class MetaCloudApiClient {
  private readonly fetchFn: typeof fetch;
  private readonly baseUrl: string;

  constructor(private readonly options: MetaCloudApiClientOptions) {
    if (!options.accessToken.trim()) throw new Error('WHATSAPP_ACCESS_TOKEN_REQUIRED');
    if (!options.phoneNumberId.trim()) throw new Error('WHATSAPP_PHONE_NUMBER_ID_REQUIRED');
    if (!/^v\d+\.\d+$/.test(options.graphApiVersion.trim())) throw new Error('WHATSAPP_GRAPH_API_VERSION_INVALID');
    this.fetchFn = options.fetchFn ?? fetch;
    this.baseUrl = (options.baseUrl ?? 'https://graph.facebook.com').replace(/\/$/, '');
  }

  async send(to: string, message: Readonly<Record<string, unknown>>): Promise<string> {
    const response = await this.fetchFn(
      `${this.baseUrl}/${this.options.graphApiVersion}/${this.options.phoneNumberId}/messages`,
      {
        method: 'POST',
        headers: {
          authorization: `Bearer ${this.options.accessToken}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify(outboundPayload(to, message)),
      },
    );

    if (!response.ok) throw new Error(`WHATSAPP_CLOUD_API_HTTP:sendMessage:${response.status}`);
    const decoded = record(await response.json());
    const messageId = record(records(decoded?.messages)[0])?.id;
    if (typeof messageId !== 'string' || !messageId.trim()) throw new Error('WHATSAPP_CLOUD_API_INVALID:sendMessage');
    return messageId;
  }
}
