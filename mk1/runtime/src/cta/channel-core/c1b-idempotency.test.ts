import assert from 'node:assert/strict';
import test from 'node:test';
import { channelEventMaterialHash, channelOperationInputId } from './idempotency.js';
import type { CanonicalChannelEnvelope } from './types.js';

function envelope(payload: Readonly<Record<string, unknown>>): CanonicalChannelEnvelope {
  return {
    version: 'v1',
    channel: 'WEBCHAT',
    businessSlug: 'golden-business',
    externalConversationId: 'conversation-1',
    externalMessageId: 'message-1',
    externalSenderId: 'browser-1',
    action: 'SELECT_SERVICE',
    payload,
  };
}

test('C1B canonical fingerprint is independent of object key ordering', () => {
  const left = envelope({ serviceId: 'svc-1', nested: { z: 2, a: 1 } });
  const right = envelope({ nested: { a: 1, z: 2 }, serviceId: 'svc-1' });
  assert.equal(channelEventMaterialHash(left), channelEventMaterialHash(right));
});

test('C1B canonical fingerprint changes when normalized material changes', () => {
  assert.notEqual(
    channelEventMaterialHash(envelope({ serviceId: 'svc-1' })),
    channelEventMaterialHash(envelope({ serviceId: 'svc-2' })),
  );
});

test('C1B Workflow input identity is stable for one transport event', () => {
  const value = envelope({ serviceId: 'svc-1' });
  assert.equal(channelOperationInputId(value), 'channel:webchat:message-1');
  assert.equal(channelOperationInputId(value), channelOperationInputId({ ...value, payload: { serviceId: 'svc-1' } }));
});
