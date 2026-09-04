import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import test from 'node:test';
import { WhatsAppAdapter } from './whatsapp.adapter.js';
import { renderWhatsAppRegistration } from './whatsapp.renderer.js';
import { MetaCloudApiTransport } from './whatsapp.transport.js';

const body = JSON.stringify({
  conversationId: 'conv-1', messageId: 'wamid-1', senderId: '51999111222', senderPhone: '+51999111222',
  kind: 'INTERACTIVE', interactiveId: 'register_customer_yes',
});
const secret = 'test-secret';
const signature = `sha256=${createHmac('sha256', secret).update(body).digest('hex')}`;
const transport = new MetaCloudApiTransport(secret, async () => {});
const adapter = new WhatsAppAdapter();

test('WA-RNC-005 rejects an unauthenticated webhook before the adapter', () => {
  assert.throws(() => transport.verifyAndNormalize(body, { 'x-hub-signature-256': 'sha256=00' }), /UNAUTHENTICATED/);
});

test('WA-RNC-001 verified inbound crosses the transport port', () => {
  assert.equal(transport.verifyAndNormalize(body, { 'x-hub-signature-256': signature }).verified, true);
});

test('WA-RNC-002 consent start prefills verified sender phone', () => {
  const event = transport.verifyAndNormalize(body, { 'x-hub-signature-256': signature });
  const envelope = adapter.normalizeInbound(event, { businessSlug: 'golden-business' });
  assert.equal(envelope?.action, 'START_CUSTOMER_REGISTRATION');
  assert.deepEqual(envelope?.payload, { consentAccepted: true, draft: { customer: { contact: {
    phones: [{ number: '+51999111222', isWhatsapp: true, primary: true }],
  } } } });
});

test('WA-RNC-003 text needs a core-derived intent and maps to one patch', () => {
  const event = { ...transport.verifyAndNormalize(body, { 'x-hub-signature-256': signature }), kind: 'TEXT' as const, text: 'eduardo@example.com' };
  assert.deepEqual(adapter.normalizeInbound(event, {
    businessSlug: 'golden-business', registrationRenderIntent: 'ASK_CUSTOMER_EMAIL',
  })?.payload, { customerPatch: { contact: { email: 'eduardo@example.com' } } });
});

test('WA-RNC-004 negative interactive consent produces no Workflow operation', () => {
  const event = { ...transport.verifyAndNormalize(body, { 'x-hub-signature-256': signature }), interactiveId: 'register_customer_no' };
  assert.equal(adapter.normalizeInbound(event, { businessSlug: 'golden-business' }), undefined);
});

test('B2 WhatsApp duplicate interactive reply maps only with duplicate render context', () => {
  const base = transport.verifyAndNormalize(body, { 'x-hub-signature-256': signature });
  const event = { ...base, interactiveId: 'resolve_customer_duplicate_existing' };
  const envelope = adapter.normalizeInbound(event, {
    businessSlug: 'golden-business', registrationRenderIntent: 'RESOLVE_CUSTOMER_DUPLICATE',
  });
  assert.equal(envelope?.action, 'RESOLVE_CUSTOMER_DUPLICATE');
  assert.deepEqual(envelope?.payload, { decision: 'USE_EXISTING' });
  assert.throws(() => adapter.normalizeInbound(event, { businessSlug: 'golden-business' }), /WHATSAPP_CONTEXT_REQUIRED/);
});

test('WhatsApp renderer exposes duplicate-decision interactives', () => {
  const rendered = renderWhatsAppRegistration('RESOLVE_CUSTOMER_DUPLICATE');
  assert.equal(rendered.type, 'interactive');
  assert.ok(Array.isArray(rendered.buttons));
});
