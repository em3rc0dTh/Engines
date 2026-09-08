import { createHmac, timingSafeEqual } from 'node:crypto';
import type { VerifiedFacebookCommentInbound } from './facebook-comment.adapter.js';
import type { VerifiedMessengerInbound } from './messenger.adapter.js';

type Headers = Readonly<Record<string, string | string[] | undefined>>;
type Json = Record<string, unknown>;
function record(value: unknown): Json | undefined { return value && typeof value === 'object' && !Array.isArray(value) ? value as Json : undefined; }
function list(value: unknown): unknown[] { return Array.isArray(value) ? value : []; }
function text(value: unknown): string | undefined { return typeof value === 'string' && value.trim() ? value.trim() : undefined; }

function header(headers: Headers, key: string): string | undefined {
  const value = headers[key] ?? headers[key.toLowerCase()];
  return Array.isArray(value) ? value[0] : value;
}

export function verifyMetaWebhook(rawBody: string, headers: Headers, appSecret: string): true {
  const supplied = header(headers, 'x-hub-signature-256');
  if (!supplied?.startsWith('sha256=') || !appSecret) throw new Error('META_WEBHOOK_UNAUTHENTICATED');
  const expected = `sha256=${createHmac('sha256', appSecret).update(rawBody, 'utf8').digest('hex')}`;
  const left = Buffer.from(supplied);
  const right = Buffer.from(expected);
  if (left.length !== right.length || !timingSafeEqual(left, right)) throw new Error('META_WEBHOOK_UNAUTHENTICATED');
  return true;
}

export function decodeMessengerPostbacks(rawBody: string, headers: Headers, appSecret: string): VerifiedMessengerInbound[] {
  verifyMetaWebhook(rawBody, headers, appSecret);
  const body = record(JSON.parse(rawBody));
  const output: VerifiedMessengerInbound[] = [];
  for (const rawEntry of list(body?.entry)) {
    const entry = record(rawEntry);
    const pageId = text(entry?.id);
    for (const rawEvent of list(entry?.messaging)) {
      const event = record(rawEvent); const sender = record(event?.sender); const postback = record(event?.postback);
      const senderPsid = text(sender?.id); const payload = text(postback?.payload);
      const messageId = text(postback?.mid) ?? (event?.timestamp !== undefined ? String(event.timestamp) : undefined);
      if (pageId && senderPsid && payload && messageId) {
        output.push({ verified: true, pageId, senderPsid, messageId, postbackPayload: payload });
      }
    }
  }
  return output;
}

export function decodeFacebookComments(rawBody: string, headers: Headers, appSecret: string): VerifiedFacebookCommentInbound[] {
  verifyMetaWebhook(rawBody, headers, appSecret);
  const body = record(JSON.parse(rawBody));
  const output: VerifiedFacebookCommentInbound[] = [];
  for (const rawEntry of list(body?.entry)) {
    const entry = record(rawEntry); const pageId = text(entry?.id);
    for (const rawChange of list(entry?.changes)) {
      const change = record(rawChange); const value = record(change?.value);
      const postId = text(value?.post_id); const commentId = text(value?.comment_id);
      const senderId = text(value?.sender_id) ?? text(record(value?.from)?.id); const message = text(value?.message);
      if (change?.field === 'feed' && value?.item === 'comment' && value?.verb === 'add'
        && pageId && postId && commentId && senderId && message) {
        output.push({ verified: true, pageId, postId, commentId, senderId, text: message });
      }
    }
  }
  return output;
}
