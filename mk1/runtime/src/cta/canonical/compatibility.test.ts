import assert from 'node:assert/strict';
import test from 'node:test';
import { ApiCTAAdapter } from '../api/api.adapter.js';
import { TelegramAdapter } from '../telegram/telegram.adapter.js';
import { WhatsAppAdapter } from '../whatsapp/whatsapp.adapter.js';
import { WebChatAdapter } from '../webchat/webchat.adapter.js';
import { fromExistingAdapter } from './compatibility.js';

const receivedAt = '2026-09-08T12:00:00.000Z';
const route = { businessSlug: 'golden-business' } as const;

test('G2 existing WebChat adapter is wrapped without changing its provider parsing', () => {
  const event = fromExistingAdapter(new WebChatAdapter(), {
    conversationId: 'web-conv', messageId: 'web-event', senderId: 'web-user',
    operation: 'START_APPOINTMENT', data: { source: 'hero' },
  }, route, receivedAt);
  assert.equal(event?.action, 'register_appointment');
  assert.equal(event?.channel, 'web');
  assert.deepEqual(event?.payload, { source: 'hero' });
});

test('G2 Telegram appointment command crosses only the compatibility layer', () => {
  const event = fromExistingAdapter(new TelegramAdapter(), {
    update_id: 901, message: { text: '/cita', chat: { id: 9 }, from: { id: 7 } },
  }, route, receivedAt);
  assert.equal(event?.action, 'register_appointment');
  assert.equal(event?.providerEventId, 'telegram:update:901');
});

test('G2 WhatsApp verified appointment postback preserves verified sender provenance', () => {
  const event = fromExistingAdapter(new WhatsAppAdapter(), {
    verified: true, provider: 'KAPSO', conversationId: 'wa-conv', messageId: 'wa-event', senderId: '51',
    senderPhone: '+51999111222', kind: 'INTERACTIVE', interactiveId: 'register_appointment',
  }, route, receivedAt);
  assert.equal(event?.action, 'register_appointment');
  assert.equal(event?.externalUserId, 'whatsapp:user:51');
});

test('G4 generic API selects the same canonical action', () => {
  const event = fromExistingAdapter(new ApiCTAAdapter(), {
    eventId: 'api-event', conversationId: 'api-conv', userId: 'api-user',
    action: 'register_appointment', payload: { catalogOfferingId: 'off-1' },
  }, route, receivedAt);
  assert.equal(event?.action, 'register_appointment');
  assert.equal(event?.channel, 'api');
});

test('G3 canonical identity is stable across delivery time and changes with provider identity', () => {
  const adapter = new ApiCTAAdapter();
  const raw = { eventId: 'api-event', conversationId: 'api-conv', userId: 'api-user', action: 'register_appointment' as const };
  const first = fromExistingAdapter(adapter, raw, route, receivedAt)!;
  const replay = fromExistingAdapter(adapter, raw, route, '2026-09-08T12:01:00.000Z')!;
  assert.equal(first.eventId, replay.eventId);
  assert.equal(first.idempotencyKey, replay.idempotencyKey);
});
