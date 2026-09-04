import type { CanonicalChannelAction, CanonicalChannelEnvelope, ChannelKind } from './types.js';

type JsonRecord = Record<string, unknown>;

function record(value: unknown): JsonRecord | undefined {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as JsonRecord
    : undefined;
}

function stringField(body: JsonRecord, key: string): string | undefined {
  const value = body[key];
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

const CHANNELS = new Set<ChannelKind>(['WEBCHAT', 'TELEGRAM', 'WHATSAPP']);
const ACTIONS = new Set<CanonicalChannelAction>([
  'START_CUSTOMER_REGISTRATION',
  'PROVIDE_CUSTOMER_DATA',
  'FINALIZE_CUSTOMER_REGISTRATION',
  'START_APPOINTMENT',
  'PROVIDE_CUSTOMER',
  'RESOLVE_CUSTOMER',
  'SELECT_SERVICE',
  'SELECT_OFFERING',
  'SET_DATE',
  'SELECT_SLOT',
  'FINALIZE_APPOINTMENT',
]);

export function parseCanonicalChannelEnvelope(raw: unknown): CanonicalChannelEnvelope {
  const body = record(raw);
  if (!body) throw new Error('CHANNEL_EVENT_INVALID:body');
  if (body.version !== 'v1') throw new Error('CHANNEL_EVENT_INVALID:version');

  const channel = stringField(body, 'channel');
  const action = stringField(body, 'action');
  const businessSlug = stringField(body, 'businessSlug');
  const externalConversationId = stringField(body, 'externalConversationId');
  const externalMessageId = stringField(body, 'externalMessageId');
  const externalSenderId = stringField(body, 'externalSenderId');
  const payload = record(body.payload);

  if (!channel || !CHANNELS.has(channel as ChannelKind)) throw new Error('CHANNEL_EVENT_INVALID:channel');
  if (!action || !ACTIONS.has(action as CanonicalChannelAction)) throw new Error('CHANNEL_EVENT_INVALID:action');
  if (!businessSlug) throw new Error('CHANNEL_EVENT_INVALID:businessSlug');
  if (!externalConversationId) throw new Error('CHANNEL_EVENT_INVALID:externalConversationId');
  if (!externalMessageId) throw new Error('CHANNEL_EVENT_INVALID:externalMessageId');
  if (!externalSenderId) throw new Error('CHANNEL_EVENT_INVALID:externalSenderId');
  if (!payload) throw new Error('CHANNEL_EVENT_INVALID:payload');

  return {
    version: 'v1',
    channel: channel as ChannelKind,
    businessSlug,
    externalConversationId,
    externalMessageId,
    externalSenderId,
    action: action as CanonicalChannelAction,
    payload,
  };
}
