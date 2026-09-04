import assert from 'node:assert/strict';
import test from 'node:test';
import { TelegramAdapter } from './telegram.adapter.js';
import { renderTelegramRegistration } from './telegram.renderer.js';

const adapter = new TelegramAdapter();
const callback = (data: string, update_id = 41) => ({
  update_id,
  callback_query: { data, from: { id: 7 }, message: { chat: { id: 9 } } },
});

test('TG-RNC-002 affirmative callback starts consented registration with canonical identities', () => {
  assert.deepEqual(adapter.normalizeInbound(callback('register_customer_yes'), { businessSlug: 'golden-business' }), {
    version: 'v1', channel: 'TELEGRAM', businessSlug: 'golden-business',
    externalConversationId: 'telegram:9', externalMessageId: 'telegram:update:41', externalSenderId: 'telegram:user:7',
    action: 'START_CUSTOMER_REGISTRATION', payload: { consentAccepted: true },
  });
});

test('CH-RNC-002 negative consent creates no canonical Workflow operation', () => {
  assert.equal(adapter.normalizeInbound(callback('register_customer_no'), { businessSlug: 'golden-business' }), undefined);
});

test('TG-RNC-001 text maps only through the core-provided render intent', () => {
  const raw = { update_id: 42, message: { text: 'Eduardo', chat: { id: 9 }, from: { id: 7 } } };
  assert.deepEqual(adapter.normalizeInbound(raw, {
    businessSlug: 'golden-business', registrationRenderIntent: 'ASK_CUSTOMER_NAME',
  })?.payload, { customerPatch: { name: 'Eduardo' } });
  assert.throws(() => adapter.normalizeInbound(raw, { businessSlug: 'golden-business' }), /TELEGRAM_CONTEXT_REQUIRED/);
});

test('TG-RNC-003 shared contact supplies a phone patch without owning completeness', () => {
  const raw = { update_id: 43, message: { contact: { phone_number: '+51999111222' }, chat: { id: 9 }, from: { id: 7 } } };
  assert.deepEqual(adapter.normalizeInbound(raw, { businessSlug: 'golden-business' })?.payload,
    { customerPatch: { contact: { phones: [{ number: '+51999111222' }] } } });
});

test('B2 Telegram duplicate callback maps only with duplicate render context', () => {
  const envelope = adapter.normalizeInbound(callback('resolve_customer_duplicate_existing', 44), {
    businessSlug: 'golden-business', registrationRenderIntent: 'RESOLVE_CUSTOMER_DUPLICATE',
  });
  assert.equal(envelope?.action, 'RESOLVE_CUSTOMER_DUPLICATE');
  assert.deepEqual(envelope?.payload, { decision: 'USE_EXISTING' });
  assert.throws(() => adapter.normalizeInbound(callback('resolve_customer_duplicate_new', 45), {
    businessSlug: 'golden-business',
  }), /TELEGRAM_CONTEXT_REQUIRED/);
});

test('Telegram renderer exposes consent, shared-contact and duplicate-decision affordances', () => {
  assert.ok(renderTelegramRegistration('CONSENT').replyMarkup);
  assert.ok(renderTelegramRegistration('ASK_CUSTOMER_PHONE').replyMarkup);
  assert.ok(renderTelegramRegistration('RESOLVE_CUSTOMER_DUPLICATE').replyMarkup);
});
