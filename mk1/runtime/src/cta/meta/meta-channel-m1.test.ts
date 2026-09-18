import assert from 'node:assert/strict';
import test from 'node:test';
import { createHmac } from 'node:crypto';
import { fromExistingAdapter } from '../canonical/compatibility.js';
import { MetaChannelM1Adapter } from './meta-channel-m1.adapter.js';
import { decodeMetaChannelM1Events } from './meta-channel-m1.webhook.js';

const route = { businessSlug: 'golden-business' } as const;
const now = '2026-09-18T19:48:53.710Z';

function signed(body: string, secret: string): Record<string, string> {
  return {
    'x-hub-signature-256': `sha256=${createHmac('sha256', secret).update(body).digest('hex')}`,
  };
}

test('M1 Messenger text CTA becomes provider-neutral Register Appointment', () => {
  const event = fromExistingAdapter(new MetaChannelM1Adapter(), {
    verified: true,
    pageId: 'page-1',
    senderId: 'psid-1',
    messageId: 'mid-1',
    text: 'CITA',
  }, route, now);

  assert.equal(event?.provider, 'messenger');
  assert.equal(event?.channel, 'messenger');
  assert.equal(event?.action, 'register_appointment');
  assert.equal(event?.eventType, 'message');
  assert.deepEqual(event?.payload, { triggerSource: 'message' });
});

test('M1 Messenger postback remains supported', () => {
  const event = fromExistingAdapter(new MetaChannelM1Adapter(), {
    verified: true,
    pageId: 'page-1',
    senderId: 'psid-1',
    messageId: 'mid-2',
    postback: 'register_appointment',
  }, route, now);

  assert.equal(event?.eventType, 'postback');
  assert.deepEqual(event?.payload, { triggerSource: 'postback' });
});

test('M1 unrelated Messenger text is not promoted to a CTA', () => {
  const event = fromExistingAdapter(new MetaChannelM1Adapter(), {
    verified: true,
    pageId: 'page-1',
    senderId: 'psid-1',
    messageId: 'mid-3',
    text: 'hola',
  }, route, now);

  assert.equal(event, undefined);
});

test('M1 signed provider message decodes before canonicalization', () => {
  const secret = 'test-secret';
  const body = JSON.stringify({
    object: 'page',
    entry: [{
      id: 'page-1',
      messaging: [{
        sender: { id: 'psid-1' },
        recipient: { id: 'page-1' },
        timestamp: 1789760932686,
        message: { mid: 'mid-physical-shape', text: 'CITA' },
      }],
    }],
  });

  const [decoded] = decodeMetaChannelM1Events(body, signed(body, secret), secret);
  assert.equal(decoded?.verified, true);
  assert.equal(decoded?.text, 'CITA');

  const canonical = decoded
    ? fromExistingAdapter(new MetaChannelM1Adapter(), decoded, route, now)
    : undefined;

  assert.equal(canonical?.action, 'register_appointment');
  assert.throws(
    () => decodeMetaChannelM1Events(body, { 'x-hub-signature-256': 'sha256=00' }, secret),
    /UNAUTHENTICATED/,
  );
});
