import assert from 'node:assert/strict';
import test from 'node:test';
import { TelegramBotApiClient } from './telegram.bot-api.js';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

test('C2P Bot API client authenticates with getMe without exposing token in payload', async () => {
  const calls: Array<{ url: string; body: unknown }> = [];
  const fakeFetch = (async (input: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(input), body: init?.body ? JSON.parse(String(init.body)) : undefined });
    return jsonResponse({ ok: true, result: { id: 42, is_bot: true, first_name: 'Engines', username: 'engines_test_bot' } });
  }) as typeof fetch;

  const api = new TelegramBotApiClient('secret-token', fakeFetch);
  const me = await api.getMe();

  assert.equal(me.id, 42);
  assert.equal(me.username, 'engines_test_bot');
  assert.match(calls[0]?.url ?? '', /\/botsecret-token\/getMe$/);
  assert.deepEqual(calls[0]?.body, {});
});

test('C2P getUpdates uses offset, long polling and only required update classes', async () => {
  let requestBody: Record<string, unknown> | undefined;
  const fakeFetch = (async (_input: string | URL | Request, init?: RequestInit) => {
    requestBody = JSON.parse(String(init?.body)) as Record<string, unknown>;
    return jsonResponse({ ok: true, result: [{ update_id: 101, message: { chat: { id: 9 }, text: 'hola' } }] });
  }) as typeof fetch;

  const api = new TelegramBotApiClient('token', fakeFetch);
  const updates = await api.getUpdates({ offset: 101, timeoutSeconds: 7 });

  assert.equal(updates.length, 1);
  assert.equal(updates[0]?.update_id, 101);
  assert.equal(requestBody?.offset, 101);
  assert.equal(requestBody?.timeout, 7);
  assert.deepEqual(requestBody?.allowed_updates, ['message', 'callback_query']);
});

test('C2P sendMessage preserves Telegram renderer reply markup', async () => {
  let requestBody: Record<string, unknown> | undefined;
  const fakeFetch = (async (_input: string | URL | Request, init?: RequestInit) => {
    requestBody = JSON.parse(String(init?.body)) as Record<string, unknown>;
    return jsonResponse({ ok: true, result: { message_id: 1 } });
  }) as typeof fetch;

  const api = new TelegramBotApiClient('token', fakeFetch);
  await api.sendMessage('123', {
    text: 'Necesito tu teléfono.',
    replyMarkup: { keyboard: [[{ text: 'Compartir teléfono', request_contact: true }]] },
  });

  assert.equal(requestBody?.chat_id, '123');
  assert.equal(requestBody?.text, 'Necesito tu teléfono.');
  assert.deepEqual(requestBody?.reply_markup, {
    keyboard: [[{ text: 'Compartir teléfono', request_contact: true }]],
  });
});

test('C2P callback acknowledgements use official answerCallbackQuery method', async () => {
  let url = '';
  let requestBody: Record<string, unknown> | undefined;
  const fakeFetch = (async (input: string | URL | Request, init?: RequestInit) => {
    url = String(input);
    requestBody = JSON.parse(String(init?.body)) as Record<string, unknown>;
    return jsonResponse({ ok: true, result: true });
  }) as typeof fetch;

  const api = new TelegramBotApiClient('token', fakeFetch);
  await api.answerCallbackQuery('callback-7');

  assert.match(url, /\/answerCallbackQuery$/);
  assert.equal(requestBody?.callback_query_id, 'callback-7');
});

test('C2P active webhook information remains observable so long polling can fail closed', async () => {
  const fakeFetch = (async () => jsonResponse({ ok: true, result: { url: 'https://example.test/hook', pending_update_count: 2 } })) as typeof fetch;
  const api = new TelegramBotApiClient('token', fakeFetch);
  const webhook = await api.getWebhookInfo();
  assert.equal(webhook.url, 'https://example.test/hook');
  assert.equal(webhook.pending_update_count, 2);
});

test('C2P Bot API failures are surfaced without embedding the bot token in the error', async () => {
  const fakeFetch = (async () => jsonResponse({ ok: false, error_code: 401, description: 'Unauthorized' })) as typeof fetch;
  const api = new TelegramBotApiClient('super-secret-token', fakeFetch);
  await assert.rejects(
    api.getMe(),
    (error: unknown) => error instanceof Error
      && error.message.includes('TELEGRAM_BOT_API_ERROR:getMe:401:Unauthorized')
      && !error.message.includes('super-secret-token'),
  );
});
