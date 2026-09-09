import assert from 'node:assert/strict';
import test from 'node:test';
import {
  TelegramWorkflowMissingError,
  channelBindingStatusForWorkflow,
  isTemporalWorkflowNotFound,
  isTerminalWorkflowStatus,
} from './telegram.lifecycle.js';

test('TG-LC01 detects Temporal workflow-not-found failures without masking unrelated errors', () => {
  assert.equal(isTemporalWorkflowNotFound({ name: 'WorkflowNotFoundError', message: 'missing' }), true);
  assert.equal(isTemporalWorkflowNotFound(new Error('workflow execution not found')), true);
  assert.equal(isTemporalWorkflowNotFound(new Error('socket timeout')), false);
});

test('TG-LC01 wraps missing workflow identity explicitly', () => {
  const error = new TelegramWorkflowMissingError('register-appointment:golden-business:abc');
  assert.equal(error.name, 'TelegramWorkflowMissingError');
  assert.match(error.message, /register-appointment:golden-business:abc/);
});

test('TG-LC02 maps durable workflow terminal state to channel binding lifecycle', () => {
  assert.equal(channelBindingStatusForWorkflow('RUNNING'), 'ACTIVE');
  assert.equal(channelBindingStatusForWorkflow('COMPLETED'), 'COMPLETED');
  assert.equal(channelBindingStatusForWorkflow('FAILED'), 'FAILED');
  assert.equal(isTerminalWorkflowStatus('RUNNING'), false);
  assert.equal(isTerminalWorkflowStatus('COMPLETED'), true);
  assert.equal(isTerminalWorkflowStatus('FAILED'), true);
});
