import { verifyHmacSha256, type VerifiedWhatsAppInbound, type WhatsAppTransportPort } from './whatsapp.transport.js';

type JsonRecord = Record<string, unknown>;

export type KapsoWebhookOptions = Readonly<{
  webhookSecret: string;
  expectedPhoneNumberId?: string;
}>;

export type KapsoApiClientOptions = Readonly<{
  apiKey: string;
  phoneNumberId: string;
  graphApiVersion: string;
  fetchFn?: typeof fetch;
  baseUrl?: string;
}>;

export type KapsoOfficialTransportOptions = KapsoWebhookOptions & KapsoApiClientOptions;

function record(value: unknown): JsonRecord | undefined {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as JsonRecord : undefined;
}

function records(value: unknown): JsonRecord[] {
  return Array.isArray(value) ? value.map(record).filter((item): item is JsonRecord => Boolean(item)) : [];
}

function optionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function requiredString(value: unknown, code: string): string {
  const resolved = optionalString(value);
  if (!resolved) throw new Error(code);
  return resolved;
}

function phoneCandidate(value: unknown): string | undefined {
  const raw = optionalString(value);
  if (!raw) return undefined;
  const digits = raw.replace(/\D/g, '');
  return digits ? `+${digits}` : undefined;
}

function interactiveReplyId(message: JsonRecord): string | undefined {
  const interactive = record(message.interactive);
  const buttonReply = record(interactive?.button_reply);
  const listReply = record(interactive?.list_reply);
  const legacyButton = record(message.button);
  return optionalString(buttonReply?.id)
    ?? optionalString(listReply?.id)
    ?? optionalString(legacyButton?.payload);
}

function normalizeKapsoEvent(item: JsonRecord, expectedPhoneNumberId?: string): VerifiedWhatsAppInbound | undefined {
  const message = record(item.message);
  if (!message) return undefined;
  const conversation = record(item.conversation);
  const kapso = record(message.kapso);

  const phoneNumberId = requiredString(
    item.phone_number_id ?? conversation?.phone_number_id ?? kapso?.phone_number_id,
    'WHATSAPP_KAPSO_EVENT_INVALID:phoneNumberId',
  );
  if (expectedPhoneNumberId && phoneNumberId !== expectedPhoneNumberId) {
    throw new Error('WHATSAPP_KAPSO_PHONE_NUMBER_ID_MISMATCH');
  }

  const messageId = requiredString(message.id, 'WHATSAPP_KAPSO_EVENT_INVALID:messageId');
  const senderPhone = phoneCandidate(conversation?.phone_number ?? kapso?.phone_number ?? message.from);
  const senderBsuid = optionalString(message.from_user_id)
    ?? optionalString(message.business_scoped_user_id)
    ?? optionalString(conversation?.business_scoped_user_id);
  const senderId = senderBsuid ?? senderPhone;
  if (!senderId) throw new Error('WHATSAPP_KAPSO_EVENT_INVALID:senderIdentity');

  const conversationId = optionalString(conversation?.id) ?? `${phoneNumberId}:${senderId}`;
  const type = optionalString(message.type) ?? '';

  const base = {
    verified: true as const,
    provider: 'KAPSO' as const,
    conversationId,
    messageId,
    senderId,
    ...(senderPhone ? { senderPhone } : {}),
  };

  if (type === 'text') {
    const text = requiredString(record(message.text)?.body, 'WHATSAPP_KAPSO_EVENT_INVALID:text');
    return { ...base, kind: 'TEXT' as const, text };
  }

  if (type === 'interactive' || type === 'button') {
    const interactiveId = interactiveReplyId(message);
    if (!interactiveId) throw new Error('WHATSAPP_KAPSO_EVENT_INVALID:interactiveId');
    return { ...base, kind: 'INTERACTIVE' as const, interactiveId };
  }

  // Media, reactions, statuses and system material do not enter this bounded
  // RegisterNewCustomer text/interactive CTA slice.
  return undefined;
}

export function decodeKapsoWebhook(
  body: string,
  headers: Readonly<Record<string, string | undefined>>,
  options: KapsoWebhookOptions,
): readonly VerifiedWhatsAppInbound[] {
  verifyHmacSha256(body, headers['x-webhook-signature'], options.webhookSecret);

  const event = headers['x-webhook-event'];
  if (event !== 'whatsapp.message.received') return [];

  const version = headers['x-webhook-payload-version'];
  if (version && version !== 'v2') throw new Error('WHATSAPP_KAPSO_PAYLOAD_VERSION_UNSUPPORTED');

  const payload = record(JSON.parse(body));
  if (!payload) throw new Error('WHATSAPP_KAPSO_EVENT_INVALID:body');
  const isBatch = headers['x-webhook-batch'] === 'true' || payload.batch === true;
  const items = isBatch ? records(payload.data) : [payload];
  const output: VerifiedWhatsAppInbound[] = [];
  for (const item of items) {
    const normalized = normalizeKapsoEvent(item, options.expectedPhoneNumberId);
    if (normalized) output.push(normalized);
  }
  return output;
}

function outboundDestination(destination: string): JsonRecord {
  const value = destination.trim();
  if (!value) throw new Error('WHATSAPP_KAPSO_SEND_INVALID:destination');
  const digits = value.replace(/\D/g, '');
  if (/^\+?\d+$/.test(value) && digits) return { to: digits };
  return { recipient: value };
}

function outboundPayload(destination: string, message: Readonly<Record<string, unknown>>): JsonRecord {
  const addressing = outboundDestination(destination);

  if (message.type === 'text') {
    const body = requiredString(message.text, 'WHATSAPP_KAPSO_SEND_INVALID:text');
    return {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      ...addressing,
      type: 'text',
      text: { body },
    };
  }

  if (message.type === 'interactive') {
    const body = requiredString(message.body, 'WHATSAPP_KAPSO_SEND_INVALID:body');
    const buttons = records(message.buttons).map((button) => ({
      type: 'reply',
      reply: {
        id: requiredString(button.id, 'WHATSAPP_KAPSO_SEND_INVALID:buttonId'),
        title: requiredString(button.title, 'WHATSAPP_KAPSO_SEND_INVALID:buttonTitle'),
      },
    }));
    if (!buttons.length || buttons.length > 3) throw new Error('WHATSAPP_KAPSO_SEND_INVALID:buttons');
    return {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      ...addressing,
      type: 'interactive',
      interactive: {
        type: 'button',
        body: { text: body },
        action: { buttons },
      },
    };
  }

  throw new Error('WHATSAPP_KAPSO_SEND_INVALID:type');
}

export class KapsoWhatsAppApiClient {
  private readonly fetchFn: typeof fetch;
  private readonly baseUrl: string;

  constructor(private readonly options: KapsoApiClientOptions) {
    if (!options.apiKey.trim()) throw new Error('KAPSO_API_KEY_REQUIRED');
    if (!options.phoneNumberId.trim()) throw new Error('KAPSO_PHONE_NUMBER_ID_REQUIRED');
    if (!/^v\d+\.\d+$/.test(options.graphApiVersion.trim())) throw new Error('KAPSO_GRAPH_API_VERSION_INVALID');
    this.fetchFn = options.fetchFn ?? fetch;
    this.baseUrl = (options.baseUrl ?? 'https://api.kapso.ai/meta/whatsapp').replace(/\/$/, '');
  }

  async send(destination: string, message: Readonly<Record<string, unknown>>): Promise<string> {
    const response = await this.fetchFn(
      `${this.baseUrl}/${this.options.graphApiVersion}/${this.options.phoneNumberId}/messages`,
      {
        method: 'POST',
        headers: {
          'x-api-key': this.options.apiKey,
          'content-type': 'application/json',
        },
        body: JSON.stringify(outboundPayload(destination, message)),
      },
    );
    if (!response.ok) throw new Error(`WHATSAPP_KAPSO_HTTP:sendMessage:${response.status}`);
    const decoded = record(await response.json());
    const messageId = optionalString(record(records(decoded?.messages)[0])?.id);
    if (!messageId) throw new Error('WHATSAPP_KAPSO_INVALID:sendMessage');
    return messageId;
  }
}

export class OfficialKapsoTransport implements WhatsAppTransportPort {
  private readonly client: KapsoWhatsAppApiClient;

  constructor(private readonly options: KapsoOfficialTransportOptions) {
    this.client = new KapsoWhatsAppApiClient(options);
  }

  verifyAndNormalize(
    body: string,
    headers: Readonly<Record<string, string | undefined>>,
  ): VerifiedWhatsAppInbound {
    const events = this.verifyAndNormalizeMany(body, headers);
    if (events.length !== 1) throw new Error('WHATSAPP_KAPSO_EXPECTED_SINGLE_EVENT');
    return events[0]!;
  }

  verifyAndNormalizeMany(
    body: string,
    headers: Readonly<Record<string, string | undefined>>,
  ): readonly VerifiedWhatsAppInbound[] {
    return decodeKapsoWebhook(body, headers, {
      webhookSecret: this.options.webhookSecret,
      expectedPhoneNumberId: this.options.expectedPhoneNumberId ?? this.options.phoneNumberId,
    });
  }

  async send(to: string, message: Readonly<Record<string, unknown>>): Promise<void> {
    await this.client.send(to, message);
  }
}
