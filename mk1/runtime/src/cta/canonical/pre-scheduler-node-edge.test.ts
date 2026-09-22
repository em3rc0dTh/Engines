import assert from 'node:assert/strict';
import test from 'node:test';
import { ApiCTAAdapter } from '../api/api.adapter.js';
import { TelegramAdapter } from '../telegram/telegram.adapter.js';
import { WhatsAppAdapter } from '../whatsapp/whatsapp.adapter.js';
import { WebChatAdapter } from '../webchat/webchat.adapter.js';
import { fromExistingAdapter } from './compatibility.js';
import { routeCanonicalCTA } from './router.js';
import type { CanonicalCTAEvent } from './types.js';

const trustedRoute = { businessSlug: 'golden-business' } as const;
const receivedAt = '2026-09-14T18:00:00.000Z';

function required(event: CanonicalCTAEvent | undefined): CanonicalCTAEvent {
  if (!event) throw new Error('EXPECTED_CANONICAL_CTA_EVENT');
  return event;
}

function legacyRegisterAppointmentEvents(at = receivedAt): readonly CanonicalCTAEvent[] {
  return [
    required(fromExistingAdapter(new WebChatAdapter(), {
      conversationId: 'shared-conversation',
      messageId: 'shared-event',
      senderId: 'shared-user',
      operation: 'START_APPOINTMENT',
      data: {},
      businessSlug: 'untrusted-client-business',
    }, trustedRoute, at)),
    required(fromExistingAdapter(new TelegramAdapter(), {
      update_id: 101,
      message: {
        text: '/cita',
        chat: { id: 'shared-conversation' },
        from: { id: 'shared-user' },
      },
    }, trustedRoute, at)),
    required(fromExistingAdapter(new WhatsAppAdapter(), {
      verified: true,
      provider: 'KAPSO',
      conversationId: 'shared-conversation',
      messageId: 'shared-event',
      senderId: 'shared-user',
      kind: 'INTERACTIVE',
      interactiveId: 'register_appointment',
    }, trustedRoute, at)),
    required(fromExistingAdapter(new ApiCTAAdapter(), {
      eventId: 'shared-event',
      conversationId: 'shared-conversation',
      userId: 'shared-user',
      action: 'register_appointment',
      payload: {},
    }, trustedRoute, at)),
  ];
}

test('pre-Scheduler legacy adapters preserve one canonical appointment domain route', () => {
  const events = legacyRegisterAppointmentEvents();

  assert.deepEqual(events.map((event) => [event.provider, event.channel, event.eventType]), [
    ['webchat', 'web', 'button'],
    ['telegram', 'telegram', 'command'],
    ['whatsapp', 'whatsapp', 'postback'],
    ['api', 'api', 'api_action'],
  ]);

  for (const event of events) {
    assert.equal(event.businessSlug, 'golden-business');
    assert.equal(event.action, 'register_appointment');
    assert.deepEqual(event.payload, {});

    const route = routeCanonicalCTA(event);
    assert.equal(route.kind, 'WORKFLOW');
    if (route.kind !== 'WORKFLOW') throw new Error('EXPECTED_WORKFLOW_ROUTE');
    assert.equal(route.workflowType, 'RegisterNewAppointment');
    assert.equal(route.event, event);
  }

  assert.equal(new Set(events.map((event) => event.eventId)).size, events.length);
  assert.equal(new Set(events.map((event) => event.idempotencyKey)).size, events.length);
});

test('pre-Scheduler canonical replay identity is stable for every legacy adapter', () => {
  const first = legacyRegisterAppointmentEvents(receivedAt);
  const replay = legacyRegisterAppointmentEvents('2026-09-14T18:05:00.000Z');

  assert.equal(first.length, replay.length);
  for (let index = 0; index < first.length; index += 1) {
    assert.equal(first[index]!.eventId, replay[index]!.eventId);
    assert.equal(first[index]!.idempotencyKey, replay[index]!.idempotencyKey);
    assert.notEqual(first[index]!.receivedAt, replay[index]!.receivedAt);
  }
});

test('pre-Scheduler API adapter fails closed before compatibility on invalid provider identity', () => {
  assert.throws(() => new ApiCTAAdapter().normalizeInbound({
    eventId: '   ',
    conversationId: 'shared-conversation',
    userId: 'shared-user',
    action: 'register_appointment',
  }, trustedRoute), /API_EVENT_INVALID/);
});
