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

test('ME1 WebChat adapter keeps managed entity creation provider-neutral', () => {
  const adapter = new WebChatAdapter();
  const result = adapter.normalizeInbound({
    conversationId: 'conversation-1',
    messageId: 'message-me-1',
    senderId: 'browser-1',
    operation: 'CREATE_MANAGED_ENTITY',
    data: {
      displayName: 'Renault Logan 2018',
      externalRef: 'ABC-123',
      data: { plate: 'ABC-123' },
    },
  }, { businessSlug: 'golden-business' });

  assert.equal(result.action, 'CREATE_MANAGED_ENTITY');
  assert.deepEqual(result.payload, {
    displayName: 'Renault Logan 2018',
    externalRef: 'ABC-123',
    data: { plate: 'ABC-123' },
  });
});

test('ME1 WebChat adapter accepts explicit managed entity selection', () => {
  const adapter = new WebChatAdapter();
  const result = adapter.normalizeInbound({
    conversationId: 'conversation-1',
    messageId: 'message-me-2',
    senderId: 'browser-1',
    operation: 'SELECT_MANAGED_ENTITY',
    data: { managedEntityId: 'men_logan' },
  }, { businessSlug: 'golden-business' });

  assert.equal(result.action, 'SELECT_MANAGED_ENTITY');
  assert.deepEqual(result.payload, { managedEntityId: 'men_logan' });
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
