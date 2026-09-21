import assert from 'node:assert/strict';
import test from 'node:test';
import { createHmac } from 'node:crypto';
import { canonicalizeFacebookPageComments, parseMetaPageRoutes } from './meta-page-ingress.js';

const secret = 'meta-test-secret';

function signed(body: string): Record<string, string> {
  return {
    'x-hub-signature-256': `sha256=${createHmac('sha256', secret).update(body).digest('hex')}`,
  };
}

test('Meta Page signed comment is canonicalized by the FacebookCommentAdapter, not by edge business rules', () => {
  const rawBody = JSON.stringify({
    object: 'page',
    entry: [{
      id: 'page-1',
      changes: [{
        field: 'feed',
        value: {
          item: 'comment',
          verb: 'add',
          post_id: 'post-1',
          comment_id: 'comment-1',
          sender_id: 'user-1',
          message: 'CITA',
        },
      }],
    }],
  });

  const events = canonicalizeFacebookPageComments({
    rawBody,
    headers: signed(rawBody),
    appSecret: secret,
    routes: parseMetaPageRoutes('{"page-1":"golden-business"}'),
    receivedAt: '2026-09-21T16:00:00.000Z',
  });

  assert.equal(events.length, 1);
  assert.equal(events[0]?.provider, 'facebook');
  assert.equal(events[0]?.channel, 'facebook_comment');
  assert.equal(events[0]?.action, 'register_appointment');
  assert.equal(events[0]?.eventType, 'comment');
  assert.equal(events[0]?.providerEventId, 'facebook:comment:comment-1');
  assert.equal(events[0]?.businessSlug, 'golden-business');
  assert.deepEqual(events[0]?.payload, {
    publicTriggerOnly: true,
    privateContinuationRequired: true,
    pageId: 'page-1',
    postId: 'post-1',
  });
});

test('Meta Page ingress ignores non-trigger comments after authentication', () => {
  const rawBody = JSON.stringify({
    object: 'page',
    entry: [{
      id: 'page-1',
      changes: [{
        field: 'feed',
        value: {
          item: 'comment',
          verb: 'add',
          post_id: 'post-1',
          comment_id: 'comment-2',
          sender_id: 'user-1',
          message: 'bonito auto',
        },
      }],
    }],
  });

  const events = canonicalizeFacebookPageComments({
    rawBody,
    headers: signed(rawBody),
    appSecret: secret,
    routes: { 'page-1': 'golden-business' },
    receivedAt: '2026-09-21T16:00:00.000Z',
  });
  assert.deepEqual(events, []);
});

test('Meta Page ingress rejects invalid signatures before adapter normalization', () => {
  const rawBody = JSON.stringify({ object: 'page', entry: [] });
  assert.throws(
    () => canonicalizeFacebookPageComments({
      rawBody,
      headers: { 'x-hub-signature-256': 'sha256=00' },
      appSecret: secret,
      routes: {},
      receivedAt: '2026-09-21T16:00:00.000Z',
    }),
    /META_WEBHOOK_UNAUTHENTICATED/,
  );
});

test('Meta Page ingress requires an explicit trusted page-to-business route', () => {
  const rawBody = JSON.stringify({
    object: 'page',
    entry: [{
      id: 'page-unmapped',
      changes: [{
        field: 'feed',
        value: {
          item: 'comment',
          verb: 'add',
          post_id: 'post-1',
          comment_id: 'comment-3',
          sender_id: 'user-1',
          message: 'agendar cita',
        },
      }],
    }],
  });

  assert.throws(
    () => canonicalizeFacebookPageComments({
      rawBody,
      headers: signed(rawBody),
      appSecret: secret,
      routes: {},
      receivedAt: '2026-09-21T16:00:00.000Z',
    }),
    /META_PAGE_ROUTE_NOT_CONFIGURED/,
  );
});
