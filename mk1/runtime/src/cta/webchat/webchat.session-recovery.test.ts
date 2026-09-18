import assert from 'node:assert/strict';
import test from 'node:test';
import {
  WEBCHAT_CONVERSATION_STORAGE_KEY,
  clearStaleConversationSession,
  isRecoverableStaleConversationError,
  projectRecoveredTranscript,
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


test('WEBCHAT-M3 reconstructs completed durable conversation steps after browser or adapter replacement', () => {
  const transcript = projectRecoveredTranscript({
    workflowId: 'register-appointment:golden-business:m3',
    state: { workflowId: 'register-appointment:golden-business:m3' },
    view: {
      steps: [
        { id: 'WORKFLOW_START', status: 'COMPLETE', value: 'register-appointment:golden-business:m3' },
        { id: 'CUSTOMER_NAME', status: 'COMPLETE', value: 'Platform M3 Customer' },
        { id: 'CUSTOMER_EMAIL', status: 'COMPLETE', value: 'm3@example.test' },
        { id: 'CUSTOMER_PHONE', status: 'COMPLETE', value: '+51 900 000 001' },
        { id: 'CUSTOMER_RESOLUTION', status: 'COMPLETE', value: 'cus_m3' },
        { id: 'SERVICE_SELECTION', status: 'COMPLETE', value: 'Car Wash' },
        { id: 'OFFERING_SELECTION', status: 'COMPLETE', value: 'Executive Clean' },
        { id: 'DATE_SELECTION', status: 'COMPLETE', value: '2026-09-20' },
        { id: 'SLOTS_LOADING', status: 'COMPLETE', value: '3 slot(s)' },
        { id: 'SLOT_SELECTION', status: 'COMPLETE', value: '06:30–07:00' },
        { id: 'FINALIZE_APPOINTMENT', status: 'ACTIVE' },
        { id: 'APPOINTMENT_CREATED', status: 'PENDING' },
      ],
    },
  });

  const rendered = transcript.map((item) => `${item.kind}:${item.text}`).join('\n');
  assert.match(rendered, /Recovered durable WebChat conversation/);
  assert.match(rendered, /Platform M3 Customer/);
  assert.match(rendered, /m3@example\.test/);
  assert.match(rendered, /Car Wash/);
  assert.match(rendered, /Executive Clean/);
  assert.match(rendered, /2026-09-20/);
  assert.match(rendered, /06:30–07:00/);
  assert.doesNotMatch(rendered, /user:Finalize Appointment/);
});
