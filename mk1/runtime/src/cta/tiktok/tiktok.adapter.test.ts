import assert from 'node:assert/strict';
import test from 'node:test';
import { createHmac } from 'node:crypto';
import { fromExistingAdapter } from '../canonical/compatibility.js';
import { TikTokAdapter } from './tiktok.adapter.js';
import { verifyTikTokWebhook } from './tiktok.webhook.js';

test('G11 TikTok comment becomes the same canonical action with private continuation', () => {
  const event = fromExistingAdapter(new TikTokAdapter(), {
    verified: true, eventId: 'event-1', conversationId: 'video-1', userId: 'user-1', kind: 'COMMENT', text: 'agendar',
  }, { businessSlug: 'golden-business' }, '2026-09-08T12:00:00.000Z');
  assert.equal(event?.provider, 'tiktok');
  assert.equal(event?.action, 'register_appointment');
  assert.equal(event?.payload.privateContinuationRequired, true);
});

test('G11 TikTok transport verifies signed payload and rejects replay-aged delivery', () => {
  const body = JSON.stringify({ event: 'fixture.only' });
  const secret = 'tiktok-test-secret';
  const timestamp = 1_700_000_000;
  const signature = createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex');
  assert.equal(verifyTikTokWebhook(body, `t=${timestamp},s=${signature}`, secret, timestamp), true);
  assert.throws(() => verifyTikTokWebhook(body, `t=${timestamp},s=${signature}`, secret, timestamp + 301), /STALE/);
});
