import assert from 'node:assert/strict';
import test from 'node:test';
import { WebChatAdapter } from './webchat.adapter.js';

test('C1B WebChat adapter normalizes into trusted canonical envelope', () => {
  const adapter = new WebChatAdapter();
  const result = adapter.normalizeInbound({
    conversationId: 'conversation-1',
    messageId: 'message-1',
    senderId: 'browser-1',
    operation: 'SET_DATE',
    data: { dateInput: 'viernes' },
    businessSlug: 'untrusted-client-value',
  }, { businessSlug: 'golden-business' });

  assert.deepEqual(result, {
    version: 'v1',
    channel: 'WEBCHAT',
    businessSlug: 'golden-business',
    externalConversationId: 'conversation-1',
    externalMessageId: 'message-1',
    externalSenderId: 'browser-1',
    action: 'SET_DATE',
    payload: { dateInput: 'viernes' },
  });
});

test('C1B WebChat adapter fails closed for unsupported action', () => {
  const adapter = new WebChatAdapter();
  assert.throws(() => adapter.normalizeInbound({
    conversationId: 'conversation-1',
    messageId: 'message-1',
    senderId: 'browser-1',
    operation: 'DO_ANYTHING_AI',
  }, { businessSlug: 'golden-business' }), /CHANNEL_OPERATION_NOT_SUPPORTED/);
});
