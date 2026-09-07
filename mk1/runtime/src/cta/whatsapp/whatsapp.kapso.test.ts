import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import test from 'node:test';
import { WhatsAppAdapter } from './whatsapp.adapter.js';
import { decodeKapsoWebhook, KapsoWhatsAppApiClient } from './whatsapp.kapso.js';

const secret = 'kapso-test-secret';
const phoneNumberId = '597907523413541';

function signed(body: string, extra: Readonly<Record<string, string>> = {}): Readonly<Record<string, string>> {
  return {
    'x-webhook-signature': createHmac('sha256', secret).update(body).digest('hex'),
    'x-webhook-event': 'whatsapp.message.received',
    'x-webhook-payload-version': 'v2',
    ...extra,
  };
}

function phoneTextBody(): string {
  return JSON.stringify({
    message: {
      id: 'wamid.phone.1',
      type: 'text',
      from: '51999111222',
      text: { body: 'Hola' },
      kapso: {
        direction: 'inbound',
        origin: 'cloud_api',
        phone_number: '+51999111222',
        phone_number_id: phoneNumberId,
      },
    },
    conversation: {
      id: 'conv-phone-1',
      phone_number: '+51999111222',
      phone_number_id: phoneNumberId,
    },
    phone_number_id: phoneNumberId,
  });
}

test('C4KS invalid Kapso HMAC is rejected before normalization', () => {
  const body = phoneTextBody();
  assert.throws(() => decodeKapsoWebhook(body, {
    ...signed(body),
    'x-webhook-signature': '00',
  }, { webhookSecret: secret, expectedPhoneNumberId: phoneNumberId }), /UNAUTHENTICATED/);
});

test('C4KS Kapso v2 phone inbound normalizes text and verified phone candidate', () => {
  const body = phoneTextBody();
  const [event] = decodeKapsoWebhook(body, signed(body), {
    webhookSecret: secret,
    expectedPhoneNumberId: phoneNumberId,
  });
  assert.equal(event?.provider, 'KAPSO');
  assert.equal(event?.conversationId, 'conv-phone-1');
  assert.equal(event?.messageId, 'wamid.phone.1');
  assert.equal(event?.senderPhone, '+51999111222');
  assert.equal(event?.kind, 'TEXT');
  assert.equal(event?.text, 'Hola');
});

test('C4KS BSUID-only inbound remains valid and does not invent a phone prefill', () => {
  const body = JSON.stringify({
    message: {
      id: 'wamid.bsuid.1',
      type: 'interactive',
      from_user_id: 'US.13491208655302741918',
      interactive: { button_reply: { id: 'register_customer_yes', title: 'Sí, registrarme' } },
      kapso: { direction: 'inbound', origin: 'cloud_api', phone_number_id: phoneNumberId },
    },
    conversation: {
      id: 'conv-bsuid-1',
      phone_number: null,
      business_scoped_user_id: 'US.13491208655302741918',
      phone_number_id: phoneNumberId,
    },
    phone_number_id: phoneNumberId,
  });
  const [event] = decodeKapsoWebhook(body, signed(body), {
    webhookSecret: secret,
    expectedPhoneNumberId: phoneNumberId,
  });
  assert.equal(event?.senderId, 'US.13491208655302741918');
  assert.equal(event?.senderPhone, undefined);
  assert.equal(event?.interactiveId, 'register_customer_yes');

  const envelope = new WhatsAppAdapter().normalizeInbound(event!, { businessSlug: 'golden-business' });
  assert.equal(envelope?.action, 'START_CUSTOMER_REGISTRATION');
  assert.deepEqual(envelope?.payload, { consentAccepted: true });
});

test('C4KS buffered v2 delivery normalizes every message independently', () => {
  const single = JSON.parse(phoneTextBody()) as Record<string, unknown>;
  const second = JSON.parse(phoneTextBody()) as Record<string, unknown>;
  const secondMessage = second.message as Record<string, unknown>;
  secondMessage.id = 'wamid.phone.2';
  secondMessage.text = { body: 'Segundo' };
  const body = JSON.stringify({ type: 'whatsapp.message.received', batch: true, data: [single, second] });
  const events = decodeKapsoWebhook(body, signed(body, { 'x-webhook-batch': 'true' }), {
    webhookSecret: secret,
    expectedPhoneNumberId: phoneNumberId,
  });
  assert.equal(events.length, 2);
  assert.deepEqual(events.map((event) => event.messageId), ['wamid.phone.1', 'wamid.phone.2']);
});

test('C4KS wrong phone number scope fails closed', () => {
  const body = phoneTextBody();
  assert.throws(() => decodeKapsoWebhook(body, signed(body), {
    webhookSecret: secret,
    expectedPhoneNumberId: 'other-phone-number-id',
  }), /PHONE_NUMBER_ID_MISMATCH/);
});

test('C4KS outbound phone text uses Kapso proxy, X-API-Key, and Meta message shape', async () => {
  let url = '';
  let init: RequestInit | undefined;
  const fetchFn: typeof fetch = async (input, requestInit) => {
    url = String(input);
    init = requestInit;
    return new Response(JSON.stringify({ messages: [{ id: 'wamid.out.1' }] }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  };
  const client = new KapsoWhatsAppApiClient({
    apiKey: 'kapso-key',
    phoneNumberId,
    graphApiVersion: 'v24.0',
    fetchFn,
  });
  const messageId = await client.send('+51999111222', { type: 'text', text: 'Hola' });
  assert.equal(messageId, 'wamid.out.1');
  assert.equal(url, `https://api.kapso.ai/meta/whatsapp/v24.0/${phoneNumberId}/messages`);
  assert.equal(new Headers(init?.headers).get('x-api-key'), 'kapso-key');
  const payload = JSON.parse(String(init?.body)) as Record<string, unknown>;
  assert.equal(payload.to, '51999111222');
  assert.equal(payload.type, 'text');
});

test('C4KS outbound BSUID interactive reply uses recipient instead of phone to', async () => {
  let init: RequestInit | undefined;
  const fetchFn: typeof fetch = async (_input, requestInit) => {
    init = requestInit;
    return new Response(JSON.stringify({ messages: [{ id: 'wamid.out.2' }] }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  };
  const client = new KapsoWhatsAppApiClient({
    apiKey: 'kapso-key',
    phoneNumberId,
    graphApiVersion: 'v24.0',
    fetchFn,
  });
  await client.send('US.13491208655302741918', {
    type: 'interactive',
    body: '¿Nos autorizas?',
    buttons: [{ id: 'register_customer_yes', title: 'Sí, registrarme' }],
  });
  const payload = JSON.parse(String(init?.body)) as Record<string, unknown>;
  assert.equal(payload.recipient, 'US.13491208655302741918');
  assert.equal(payload.to, undefined);
  assert.equal(payload.type, 'interactive');
});
