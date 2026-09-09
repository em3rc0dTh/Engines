import assert from 'node:assert/strict';
import test from 'node:test';
import {
  WEBCHAT_CONVERSATION_STORAGE_KEY,
  clearStaleConversationSession,
  isRecoverableStaleConversationError,
} from './public/session-recovery.js';

test('WEBCHAT-ST01 only treats missing durable conversation binding as recoverable stale session', () => {
  assert.equal(isRecoverableStaleConversationError({ status: 404, code: 'CHANNEL_CONVERSATION_NOT_BOUND' }), true);
  assert.equal(isRecoverableStaleConversationError({ status: 500, code: 'CHANNEL_INTERNAL_ERROR' }), false);
  assert.equal(isRecoverableStaleConversationError({ status: 404, code: 'WEBCHAT_ROUTE_NOT_FOUND' }), false);
});

test('WEBCHAT-ST01 clears stale browser identity and removes conversation query state', () => {
  const state = {
    conversationId: 'webchat-conversation-stale',
    workflowId: 'register-appointment:golden-business:stale',
    snapshot: { state: { phase: 'WAITING_FOR_CUSTOMER' } },
    view: { steps: [] },
    inputMode: 'customer-name',
    lastPromptKey: 'customer-name',
    lastPhaseSignature: 'RUNNING|WAITING_FOR_CUSTOMER|PROVIDE_CUSTOMER',
  };
  const removed: string[] = [];
  const storage = { removeItem: (key: string) => removed.push(key) };

  const result = clearStaleConversationSession(
    state,
    storage,
    'http://127.0.0.1:8790/webchat/?conversationId=webchat-conversation-stale&workflowId=wf-stale&keep=1',
  );

  assert.equal(result.staleConversationId, 'webchat-conversation-stale');
  assert.deepEqual(removed, [WEBCHAT_CONVERSATION_STORAGE_KEY]);
  assert.equal(state.conversationId, '');
  assert.equal(state.workflowId, '');
  assert.equal(state.snapshot, null);
  assert.equal(state.view, null);
  assert.equal(state.inputMode, null);
  assert.equal(state.lastPromptKey, '');
  assert.equal(state.lastPhaseSignature, '');

  const url = new URL(result.url);
  assert.equal(url.searchParams.has('conversationId'), false);
  assert.equal(url.searchParams.has('workflowId'), false);
  assert.equal(url.searchParams.get('keep'), '1');
});
