import assert from 'node:assert/strict';
import test from 'node:test';
import { createHmac } from 'node:crypto';
import { fromExistingAdapter } from '../canonical/compatibility.js';
import { FacebookCommentAdapter } from './facebook-comment.adapter.js';
import { MessengerAdapter } from './messenger.adapter.js';
import { decodeFacebookComments, decodeMessengerPostbacks } from './meta.webhook.js';

const route = { businessSlug: 'golden-business' } as const;
const now = '2026-09-08T12:00:00.000Z';

test('G9 Messenger postback becomes provider-neutral Register Appointment', () => {
  const event = fromExistingAdapter(new MessengerAdapter(), {
    verified: true, pageId: 'page-1', senderPsid: 'psid-1', messageId: 'mid-1',
    postbackPayload: 'register_appointment',
  }, route, now);
  assert.equal(event?.provider, 'messenger');
  assert.equal(event?.action, 'register_appointment');
});

test('G10 Facebook public comment carries no personal information request', () => {
  const event = fromExistingAdapter(new FacebookCommentAdapter(), {
    verified: true, pageId: 'page-1', postId: 'post-1', commentId: 'comment-1', senderId: 'user-1', text: 'CITA',
  }, route, now);
  assert.equal(event?.channel, 'facebook_comment');
  assert.deepEqual(event?.payload, {
    publicTriggerOnly: true, privateContinuationRequired: true, pageId: 'page-1', postId: 'post-1',
  });
  assert.equal(JSON.stringify(event).includes('phone'), false);
});

test('G10 unrelated Facebook comments are ignored', () => {
  const event = fromExistingAdapter(new FacebookCommentAdapter(), {
    verified: true, pageId: 'page-1', postId: 'post-1', commentId: 'comment-2', senderId: 'user-1', text: 'bonito auto',
  }, route, now);
  assert.equal(event, undefined);
});

test('G9/G10 Meta transport authenticates and decodes provider payloads before adapters', () => {
  const secret = 'meta-test-secret';
  const messengerBody = JSON.stringify({ entry: [{ id: 'page-1', messaging: [{
    sender: { id: 'psid-1' }, timestamp: 1234, postback: { mid: 'mid-1', payload: 'register_appointment' },
  }] }] });
  const sign = (body: string) => ({
    'x-hub-signature-256': `sha256=${createHmac('sha256', secret).update(body).digest('hex')}`,
  });
  assert.equal(decodeMessengerPostbacks(messengerBody, sign(messengerBody), secret)[0]?.verified, true);

  const commentBody = JSON.stringify({ entry: [{ id: 'page-1', changes: [{ field: 'feed', value: {
    item: 'comment', verb: 'add', post_id: 'post-1', comment_id: 'comment-1', sender_id: 'user-1', message: 'CITA',
  } }] }] });
  assert.equal(decodeFacebookComments(commentBody, sign(commentBody), secret)[0]?.commentId, 'comment-1');
  assert.throws(() => decodeFacebookComments(commentBody, { 'x-hub-signature-256': 'sha256=00' }, secret), /UNAUTHENTICATED/);
});
