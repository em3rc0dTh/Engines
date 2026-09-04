import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import test from 'node:test';
import {
  decodeMetaCloudApiWebhook,
  MetaCloudApiClient,
  verifyMetaWebhookChallenge,
} from './whatsapp.cloud-api.js';

const APP_SECRET = 'app-secret-for-test';
const PHONE_NUMBER_ID = '1234567890';

function signature(body: string): string {
  return `sha256=${createHmac('sha256', APP_SECRET).update(body).digest('hex')}`;
}

function webhookMessage(message: Record<string, unknown>): string {
  return JSON.stringify({
    object: 'whatsapp_business_account',
    entry: [{
      id: 'waba-1',
      changes: [{
        field: 'messages',
        value: {
          messaging_product: 'whatsapp',
          metadata: { display_phone_number: '15550000000', phone_number_id: PHONE_NUMBER_ID },
          contacts: [{ profile: { name: 'Test User' }, wa_id: '51933075200' }],
          messages: [message],
        },
      }],
    }],
  });
}

test('C4P webhook verification challenge accepts only the configured token', () => {
  const ok = new URL('https://example.test/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=verify-me&hub.challenge=abc123');
  assert.equal(verifyMetaWebhookChallenge(ok, 'verify-me'), 'abc123');
  assert.equal(verifyMetaWebhookChallenge(ok, 'wrong'), undefined);
});

test('C4P authenticated Meta text webhook normalizes to canonical provider material', () => {
  const body = webhookMessage({
    from: '51933075200',
    id: 'wamid.TEXT1',
    timestamp: '1',
    type: 'text',
    text: { body: 'Eduardo' },
  });
  const [event] = decodeMetaCloudApiWebhook(body, { 'x-hub-signature-256': signature(body) }, {
    appSecret: APP_SECRET,
    expectedPhoneNumberId: PHONE_NUMBER_ID,
  });
  assert.deepEqual(event, {
    verified: true,
    provider: 'META_CLOUD_API',
    conversationId: `${PHONE_NUMBER_ID}:51933075200`,
    messageId: 'wamid.TEXT1',
    senderId: '51933075200',
    senderPhone: '+51933075200',
    kind: 'TEXT',
    text: 'Eduardo',
  });
});

test('C4P authenticated Meta interactive webhook preserves reply id', () => {
  const body = webhookMessage({
    from: '51933075200',
    id: 'wamid.BUTTON1',
    timestamp: '2',
    type: 'interactive',
    interactive: { type: 'button_reply', button_reply: { id: 'register_customer_yes', title: 'Sí, registrarme' } },
  });
  const [event] = decodeMetaCloudApiWebhook(body, { 'x-hub-signature-256': signature(body) }, {
    appSecret: APP_SECRET,
    expectedPhoneNumberId: PHONE_NUMBER_ID,
  });
  assert.equal(event?.kind, 'INTERACTIVE');
  assert.equal(event?.interactiveId, 'register_customer_yes');
  assert.equal(event?.messageId, 'wamid.BUTTON1');
});

test('C4P invalid Meta HMAC is rejected before normalization', () => {
  const body = webhookMessage({ from: '51933075200', id: 'wamid.BAD', type: 'text', text: { body: 'x' } });
  assert.throws(() => decodeMetaCloudApiWebhook(body, { 'x-hub-signature-256': 'sha256=00' }, {
    appSecret: APP_SECRET,
    expectedPhoneNumberId: PHONE_NUMBER_ID,
  }), /WHATSAPP_WEBHOOK_UNAUTHENTICATED/);
});

test('C4P status-only webhook is authenticated then ignored at CTA boundary', () => {
  const body = JSON.stringify({
    object: 'whatsapp_business_account',
    entry: [{ changes: [{ field: 'messages', value: {
      messaging_product: 'whatsapp',
      metadata: { phone_number_id: PHONE_NUMBER_ID },
      statuses: [{ id: 'wamid.STATUS', status: 'delivered' }],
    } }] }],
  });
  assert.deepEqual(decodeMetaCloudApiWebhook(body, { 'x-hub-signature-256': signature(body) }, {
    appSecret: APP_SECRET,
    expectedPhoneNumberId: PHONE_NUMBER_ID,
  }), []);
});

test('C4P outbound text uses official Graph messages shape without leaking token', async () => {
  let capturedUrl = '';
  let capturedAuthorization = '';
  let capturedBody: unknown;
  const fetchFn: typeof fetch = async (input, init) => {
    capturedUrl = String(input);
    capturedAuthorization = new Headers(init?.headers).get('authorization') ?? '';
    capturedBody = JSON.parse(String(init?.body));
    return new Response(JSON.stringify({ messaging_product: 'whatsapp', messages: [{ id: 'wamid.OUT1' }] }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  };
  const client = new MetaCloudApiClient({
    accessToken: 'secret-token',
    phoneNumberId: PHONE_NUMBER_ID,
    graphApiVersion: 'v99.0',
    fetchFn,
    baseUrl: 'https://graph.example.test',
  });
  assert.equal(await client.send('+51933075200', { type: 'text', text: 'Hola' }), 'wamid.OUT1');
  assert.equal(capturedUrl, `https://graph.example.test/v99.0/${PHONE_NUMBER_ID}/messages`);
  assert.equal(capturedAuthorization, 'Bearer secret-token');
  assert.deepEqual(capturedBody, {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: '51933075200',
    type: 'text',
    text: { body: 'Hola' },
  });
});

test('C4P outbound consent buttons use official interactive reply-button shape', async () => {
  let capturedBody: any;
  const fetchFn: typeof fetch = async (_input, init) => {
    capturedBody = JSON.parse(String(init?.body));
    return new Response(JSON.stringify({ messages: [{ id: 'wamid.OUT2' }] }), { status: 200 });
  };
  const client = new MetaCloudApiClient({
    accessToken: 'secret-token',
    phoneNumberId: PHONE_NUMBER_ID,
    graphApiVersion: 'v99.0',
    fetchFn,
  });
  await client.send('+51933075200', {
    type: 'interactive',
    body: '¿Deseas registrarte?',
    buttons: [
      { id: 'register_customer_yes', title: 'Sí, registrarme' },
      { id: 'register_customer_no', title: 'Ahora no' },
    ],
  });
  assert.equal(capturedBody.type, 'interactive');
  assert.equal(capturedBody.interactive.type, 'button');
  assert.equal(capturedBody.interactive.action.buttons[0].reply.id, 'register_customer_yes');
  assert.equal(capturedBody.interactive.action.buttons[1].reply.id, 'register_customer_no');
});
