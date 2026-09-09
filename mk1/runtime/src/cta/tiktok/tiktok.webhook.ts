import { createHmac, timingSafeEqual } from 'node:crypto';

export function verifyTikTokWebhook(
  rawBody: string,
  signatureHeader: string | undefined,
  clientSecret: string,
  nowEpochSeconds = Math.floor(Date.now() / 1000),
  toleranceSeconds = 300,
): true {
  const parts = new Map((signatureHeader ?? '').split(',').map((part) => {
    const [key, ...rest] = part.trim().split('=');
    return [key, rest.join('=')] as const;
  }));
  const timestamp = parts.get('t');
  const supplied = parts.get('s');
  if (!timestamp || !/^\d+$/.test(timestamp) || !supplied || !clientSecret) throw new Error('TIKTOK_WEBHOOK_UNAUTHENTICATED');
  const age = Math.abs(nowEpochSeconds - Number(timestamp));
  if (age > toleranceSeconds) throw new Error('TIKTOK_WEBHOOK_STALE');
  const expected = createHmac('sha256', clientSecret).update(`${timestamp}.${rawBody}`, 'utf8').digest('hex');
  const left = Buffer.from(supplied); const right = Buffer.from(expected);
  if (left.length !== right.length || !timingSafeEqual(left, right)) throw new Error('TIKTOK_WEBHOOK_UNAUTHENTICATED');
  return true;
}
