import type { VerifiedMetaChannelM1Inbound } from './meta-channel-m1.adapter.js';
import { verifyMetaWebhook } from './meta.webhook.js';

type Headers = Readonly<Record<string, string | string[] | undefined>>;
type Json = Record<string, unknown>;

function record(value: unknown): Json | undefined {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Json : undefined;
}
function list(value: unknown): unknown[] { return Array.isArray(value) ? value : []; }
function text(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

export function decodeMetaChannelM1Events(
  rawBody: string,
  headers: Headers,
  appSecret: string,
): VerifiedMetaChannelM1Inbound[] {
  verifyMetaWebhook(rawBody, headers, appSecret);

  const body = record(JSON.parse(rawBody));
  if (body?.object !== 'page') return [];

  const output: VerifiedMetaChannelM1Inbound[] = [];

  for (const rawEntry of list(body.entry)) {
    const entry = record(rawEntry);
    const pageId = text(entry?.id);
    if (!pageId) continue;

    for (const rawEvent of list(entry?.messaging)) {
      const event = record(rawEvent);
      const senderId = text(record(event?.sender)?.id);
      if (!senderId) continue;

      const message = record(event?.message);
      const postback = record(event?.postback);
      const messageId = text(message?.mid)
        ?? text(postback?.mid)
        ?? (event?.timestamp !== undefined ? String(event.timestamp) : undefined);

      if (!messageId) continue;

      const messageText = text(message?.text);
      const postbackPayload = text(postback?.payload);
      if (!messageText && !postbackPayload) continue;

      output.push({
        verified: true,
        pageId,
        senderId,
        messageId,
        ...(messageText ? { text: messageText } : {}),
        ...(postbackPayload ? { postback: postbackPayload } : {}),
      });
    }
  }

  return output;
}
