import { createHmac, timingSafeEqual } from 'node:crypto';
import type {
  IntegrationCommand,
  JsonObject,
} from '../../contracts/integration-engine/index.js';
import {
  IntegrationInboundError,
  type IntegrationWebhookRequest,
  type IntegrationWebhookVerifier,
  type VerifiedProviderWebhook,
} from '../inbound.js';
import type { IntegrationProviderAdapter, IntegrationProviderDeliveryResult } from '../provider.js';
import { IntegrationProviderError } from '../provider.js';
import type { IntegrationConnection } from '../registry.js';
import {
  secretReferenceForPurpose,
  type IntegrationSecretValueResolver,
} from '../secret-resolution.js';

export const KAPSO_WHATSAPP_PROVIDER_KIND = 'kapso-whatsapp';
export const INTEGRATION_MESSAGING_SEND_CAPABILITY = 'messaging.send';
export const INTEGRATION_MESSAGING_RECEIVE_CAPABILITY = 'messaging.receive';
export const INTEGRATION_SEND_TEXT_ACTION = 'send_text';
export const KAPSO_API_KEY_PURPOSE = 'api-key';
export const KAPSO_WEBHOOK_SECRET_PURPOSE = 'webhook-secret';

const DEFAULT_KAPSO_BASE_URL = 'https://api.kapso.ai/meta/whatsapp';
const DEFAULT_GRAPH_API_VERSION = 'v24.0';

type JsonRecord = Record<string, unknown>;

function record(value: unknown): JsonRecord | undefined {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as JsonRecord
    : undefined;
}

function optionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

function requiredString(value: unknown, code: string): string {
  const resolved = optionalString(value);
  if (!resolved) throw new IntegrationProviderError('INVALID_COMMAND', code);
  return resolved;
}

function normalizedPhone(value: string): string {
  const digits = value.replace(/\D/g, '');
  if (!digits) throw new IntegrationProviderError('INVALID_COMMAND', 'KAPSO_RECIPIENT_INVALID');
  return digits;
}

function connectionPhoneNumberId(connection: IntegrationConnection): string {
  const phoneNumberId = connection.externalAccountRef?.trim();
  if (!phoneNumberId) {
    throw new IntegrationProviderError('PERMANENT_PROVIDER_FAILURE', 'KAPSO_PHONE_NUMBER_ID_NOT_CONFIGURED');
  }
  return phoneNumberId;
}

function assertKapsoConnection(connection: IntegrationConnection): void {
  if (connection.providerKind !== KAPSO_WHATSAPP_PROVIDER_KIND) {
    throw new IntegrationProviderError(
      'PERMANENT_PROVIDER_FAILURE',
      `KAPSO_PROVIDER_KIND_MISMATCH:${connection.providerKind}`,
    );
  }
}

function canonicalSendText(command: IntegrationCommand): Readonly<{ to: string; text: string }> {
  if (command.capability !== INTEGRATION_MESSAGING_SEND_CAPABILITY) {
    throw new IntegrationProviderError('CAPABILITY_NOT_SUPPORTED');
  }
  if (command.action !== INTEGRATION_SEND_TEXT_ACTION) {
    throw new IntegrationProviderError('INVALID_COMMAND', `KAPSO_ACTION_UNSUPPORTED:${command.action}`);
  }
  if (!command.targetRef || command.targetRef.kind !== 'phone') {
    throw new IntegrationProviderError('INVALID_COMMAND', 'KAPSO_PHONE_TARGET_REQUIRED');
  }
  const text = requiredString(command.payload.text, 'KAPSO_TEXT_REQUIRED');
  return { to: normalizedPhone(command.targetRef.ref), text };
}

function providerMessageId(value: unknown): string | undefined {
  const decoded = record(value);
  const messages = Array.isArray(decoded?.messages) ? decoded.messages : [];
  return optionalString(record(messages[0])?.id);
}

export class KapsoWhatsAppIntegrationAdapter implements IntegrationProviderAdapter {
  readonly providerKind = KAPSO_WHATSAPP_PROVIDER_KIND;
  private readonly fetchFn: typeof fetch;
  private readonly baseUrl: string;
  private readonly graphApiVersion: string;

  constructor(
    private readonly secrets: IntegrationSecretValueResolver,
    options: Readonly<{
      fetchFn?: typeof fetch;
      baseUrl?: string;
      graphApiVersion?: string;
    }> = {},
  ) {
    this.fetchFn = options.fetchFn ?? fetch;
    this.baseUrl = (options.baseUrl ?? DEFAULT_KAPSO_BASE_URL).replace(/\/$/, '');
    this.graphApiVersion = options.graphApiVersion ?? DEFAULT_GRAPH_API_VERSION;
    if (!/^v\d+\.\d+$/.test(this.graphApiVersion)) {
      throw new IntegrationProviderError('PERMANENT_PROVIDER_FAILURE', 'KAPSO_GRAPH_API_VERSION_INVALID');
    }
  }

  async deliver(
    command: IntegrationCommand,
    connection: IntegrationConnection,
  ): Promise<IntegrationProviderDeliveryResult> {
    assertKapsoConnection(connection);
    const material = canonicalSendText(command);
    const apiKeyReference = secretReferenceForPurpose(connection.secretRefs, KAPSO_API_KEY_PURPOSE);
    const apiKey = await this.secrets.resolve(apiKeyReference);
    const phoneNumberId = connectionPhoneNumberId(connection);

    let response: Response;
    try {
      response = await this.fetchFn(
        `${this.baseUrl}/${this.graphApiVersion}/${encodeURIComponent(phoneNumberId)}/messages`,
        {
          method: 'POST',
          headers: {
            'x-api-key': apiKey,
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            messaging_product: 'whatsapp',
            recipient_type: 'individual',
            to: material.to,
            type: 'text',
            text: { body: material.text },
          }),
        },
      );
    } catch {
      return { kind: 'RETRYABLE', errorCode: 'TRANSIENT_PROVIDER_FAILURE' };
    }

    if (response.status === 401 || response.status === 403) {
      return { kind: 'FAILED_PERMANENT', errorCode: 'AUTHENTICATION_FAILED' };
    }
    if (response.status === 429) {
      return { kind: 'RETRYABLE', errorCode: 'RATE_LIMITED' };
    }
    if (response.status === 408 || response.status === 425 || response.status >= 500) {
      return { kind: 'RETRYABLE', errorCode: response.status === 408 ? 'TIMEOUT' : 'TRANSIENT_PROVIDER_FAILURE' };
    }
    if (!response.ok) {
      return { kind: 'FAILED_PERMANENT', errorCode: 'PROVIDER_REJECTED' };
    }

    let decoded: unknown;
    try {
      decoded = await response.json();
    } catch {
      return { kind: 'FAILED_PERMANENT', errorCode: 'PERMANENT_PROVIDER_FAILURE' };
    }
    const messageId = providerMessageId(decoded);
    if (!messageId) return { kind: 'FAILED_PERMANENT', errorCode: 'PERMANENT_PROVIDER_FAILURE' };
    return { kind: 'SUCCEEDED', providerReceiptRef: messageId };
  }
}

export interface KapsoConnectionLookup {
  getConnection(businessSlug: string, connectionRef: string): Promise<IntegrationConnection | undefined>;
}

function verifySignature(rawBody: string, supplied: string | undefined, secret: string): void {
  if (!supplied) throw new IntegrationInboundError('AUTHENTICATION_FAILED', 'KAPSO_SIGNATURE_MISSING');
  const expected = createHmac('sha256', secret).update(rawBody).digest('hex');
  const expectedBytes = Buffer.from(expected, 'hex');
  const suppliedBytes = Buffer.from(supplied, 'hex');
  if (
    expectedBytes.length === 0
    || expectedBytes.length !== suppliedBytes.length
    || !timingSafeEqual(expectedBytes, suppliedBytes)
  ) {
    throw new IntegrationInboundError('AUTHENTICATION_FAILED', 'KAPSO_SIGNATURE_INVALID');
  }
}

function bodyItem(rawBody: string, headers: Readonly<Record<string, string | undefined>>): JsonRecord {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawBody);
  } catch {
    throw new IntegrationInboundError('INVALID_PROVIDER_EVENT', 'KAPSO_BODY_INVALID_JSON');
  }
  const root = record(parsed);
  if (!root) throw new IntegrationInboundError('INVALID_PROVIDER_EVENT', 'KAPSO_BODY_INVALID');
  if (headers['x-webhook-batch'] === 'true' || root.batch === true) {
    throw new IntegrationInboundError('INVALID_PROVIDER_EVENT', 'KAPSO_BATCH_NOT_SUPPORTED_IN_I4');
  }
  return root;
}

function phoneCandidate(value: unknown): string | undefined {
  const raw = optionalString(value);
  if (!raw) return undefined;
  const digits = raw.replace(/\D/g, '');
  return digits ? `+${digits}` : undefined;
}

function normalizeKapsoInbound(
  item: JsonRecord,
  expectedPhoneNumberId: string,
): VerifiedProviderWebhook {
  const message = record(item.message);
  if (!message) throw new IntegrationInboundError('INVALID_PROVIDER_EVENT', 'KAPSO_MESSAGE_MISSING');
  const conversation = record(item.conversation);
  const kapso = record(message.kapso);

  const phoneNumberId = optionalString(
    item.phone_number_id ?? conversation?.phone_number_id ?? kapso?.phone_number_id,
  );
  if (!phoneNumberId) {
    throw new IntegrationInboundError('INVALID_PROVIDER_EVENT', 'KAPSO_PHONE_NUMBER_ID_MISSING');
  }
  if (phoneNumberId !== expectedPhoneNumberId) {
    throw new IntegrationInboundError('AUTHENTICATION_FAILED', 'KAPSO_PHONE_NUMBER_ID_MISMATCH');
  }

  const messageId = optionalString(message.id);
  if (!messageId) throw new IntegrationInboundError('INVALID_PROVIDER_EVENT', 'KAPSO_MESSAGE_ID_MISSING');

  const senderPhone = phoneCandidate(conversation?.phone_number ?? kapso?.phone_number ?? message.from);
  const senderId = optionalString(message.from_user_id)
    ?? optionalString(message.business_scoped_user_id)
    ?? optionalString(conversation?.business_scoped_user_id)
    ?? senderPhone;
  if (!senderId) throw new IntegrationInboundError('INVALID_PROVIDER_EVENT', 'KAPSO_SENDER_MISSING');

  const conversationRef = optionalString(conversation?.id) ?? `${phoneNumberId}:${senderId}`;
  const type = optionalString(message.type);
  const timestamp = optionalString(message.timestamp);
  const occurredAt = timestamp && /^\d+$/.test(timestamp)
    ? new Date(Number(timestamp) * 1000).toISOString()
    : undefined;

  let canonicalMessage: JsonObject;
  if (type === 'text') {
    const text = optionalString(record(message.text)?.body);
    if (!text) throw new IntegrationInboundError('INVALID_PROVIDER_EVENT', 'KAPSO_TEXT_MISSING');
    canonicalMessage = { kind: 'text', text };
  } else if (type === 'interactive' || type === 'button') {
    const interactive = record(message.interactive);
    const buttonReply = record(interactive?.button_reply);
    const listReply = record(interactive?.list_reply);
    const legacyButton = record(message.button);
    const replyId = optionalString(buttonReply?.id)
      ?? optionalString(listReply?.id)
      ?? optionalString(legacyButton?.payload);
    if (!replyId) throw new IntegrationInboundError('INVALID_PROVIDER_EVENT', 'KAPSO_INTERACTIVE_ID_MISSING');
    canonicalMessage = { kind: 'interactive', replyId };
  } else {
    throw new IntegrationInboundError('INVALID_PROVIDER_EVENT', `KAPSO_MESSAGE_TYPE_UNSUPPORTED:${type ?? 'missing'}`);
  }

  return {
    providerEventIdentity: `kapso-message:${messageId}`,
    capability: INTEGRATION_MESSAGING_RECEIVE_CAPABILITY,
    eventType: 'message.received',
    payload: {
      messageId,
      conversationRef,
      sender: {
        kind: senderPhone ? 'phone' : 'provider-user',
        ref: senderPhone ?? senderId,
      },
      message: canonicalMessage,
    },
    ...(occurredAt === undefined ? {} : { occurredAt }),
  };
}

export class KapsoWhatsAppWebhookVerifier implements IntegrationWebhookVerifier {
  constructor(
    private readonly connections: KapsoConnectionLookup,
    private readonly secrets: IntegrationSecretValueResolver,
  ) {}

  async verify(request: IntegrationWebhookRequest): Promise<VerifiedProviderWebhook> {
    const connection = await this.connections.getConnection(request.businessSlug, request.connectionRef);
    if (!connection) throw new IntegrationInboundError('AUTHENTICATION_FAILED', 'KAPSO_CONNECTION_UNKNOWN');
    assertKapsoConnection(connection);

    const secretReference = secretReferenceForPurpose(connection.secretRefs, KAPSO_WEBHOOK_SECRET_PURPOSE);
    let webhookSecret: string;
    try {
      webhookSecret = await this.secrets.resolve(secretReference);
    } catch (error) {
      throw new IntegrationInboundError(
        'AUTHENTICATION_FAILED',
        error instanceof Error ? `KAPSO_SECRET_RESOLUTION_FAILED:${error.message}` : 'KAPSO_SECRET_RESOLUTION_FAILED',
      );
    }

    verifySignature(request.rawBody, request.headers['x-webhook-signature'], webhookSecret);
    if (request.headers['x-webhook-event'] !== 'whatsapp.message.received') {
      throw new IntegrationInboundError('INVALID_PROVIDER_EVENT', 'KAPSO_EVENT_UNSUPPORTED');
    }
    const payloadVersion = request.headers['x-webhook-payload-version'];
    if (payloadVersion !== undefined && payloadVersion !== 'v2') {
      throw new IntegrationInboundError('INVALID_PROVIDER_EVENT', 'KAPSO_PAYLOAD_VERSION_UNSUPPORTED');
    }

    return normalizeKapsoInbound(
      bodyItem(request.rawBody, request.headers),
      connectionPhoneNumberId(connection),
    );
  }
}
