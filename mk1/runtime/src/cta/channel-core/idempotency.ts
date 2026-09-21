import { createHash } from 'node:crypto';
import { canonicalJson } from '../../contracts/register-new-customer/index.js';
import type { CanonicalChannelEnvelope } from './types.js';

export function channelEventMaterial(envelope: CanonicalChannelEnvelope): Readonly<Record<string, unknown>> {
  return {
    version: envelope.version,
    channel: envelope.channel,
    businessSlug: envelope.businessSlug,
    externalConversationId: envelope.externalConversationId,
    externalSenderId: envelope.externalSenderId,
    action: envelope.action,
    payload: envelope.payload,
  };
}

export function channelEventMaterialHash(envelope: CanonicalChannelEnvelope): string {
  return createHash('sha256')
    .update(canonicalJson(channelEventMaterial(envelope)), 'utf8')
    .digest('hex');
}

export function channelOperationInputId(envelope: CanonicalChannelEnvelope): string {
  return `channel:${envelope.channel.toLowerCase()}:${envelope.externalMessageId}`;
}
