import { createHmac, randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { loadRuntimeConfig } from '../src/config/runtime-config.js';

type Json = Record<string, unknown>;

const baseUrl = (process.env.ENGINES_CHANNEL_URL ?? 'http://127.0.0.1:8788').replace(/\/$/, '');
const secret = process.env.META_APP_SECRET?.trim() ?? '';
const pageId = 'TEST_PAGE';
const businessSlug = 'golden-business';

function record(value: unknown): Json {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Json : {};
}

function assert(value: unknown, message: string): asserts value {
  if (!value) throw new Error(`META_FACEBOOK_COMMENT_ASSERTION_FAILED:${message}`);
}

function signature(rawBody: string): string {
  return `sha256=${createHmac('sha256', secret).update(rawBody, 'utf8').digest('hex')}`;
}

async function post(rawBody: string): Promise<Json> {
  const response = await fetch(`${baseUrl}/meta/page/events`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-hub-signature-256': signature(rawBody),
    },
    body: rawBody,
  });
  const payload = record(await response.json());
  if (!response.ok) throw new Error(`META_FACEBOOK_COMMENT_HTTP_${response.status}:${JSON.stringify(payload)}`);
  return payload;
}

async function main(): Promise<void> {
  assert(secret, 'META_APP_SECRET missing');

  const token = randomUUID();
  const commentId = `comment-${token}`;
  const postId = `post-${token}`;
  const senderId = `user-${token}`;
  const rawBody = JSON.stringify({
    object: 'page',
    entry: [{
      id: pageId,
      time: Date.now(),
      changes: [{
        field: 'feed',
        value: {
          item: 'comment',
          verb: 'add',
          post_id: postId,
          comment_id: commentId,
          sender_id: senderId,
          message: 'CITA',
          published: 1,
          created_time: Date.now(),
        },
      }],
    }],
  });

  const first = await post(rawBody);
  assert(first.accepted === 1, 'signed comment was not accepted');
  const firstResult = record(Array.isArray(first.results) ? first.results[0] : undefined);
  const firstIngress = record(firstResult.ingress);
  const workflowId = String(firstResult.workflowId ?? '');
  assert(workflowId, 'Temporal workflow id missing');
  assert(firstResult.replayed === false, 'first delivery unexpectedly replayed');
  assert(firstIngress.provider === 'facebook', 'provider mismatch');
  assert(firstIngress.channel === 'facebook_comment', 'channel mismatch');
  assert(firstIngress.status === 'PROCESSING', 'CTA ingress should be PROCESSING after workflow start');
  assert(firstIngress.providerEventId === `facebook:comment:${commentId}`, 'provider event id mismatch');

  const replay = await post(rawBody);
  assert(replay.accepted === 1, 'replay comment was not accepted');
  const replayResult = record(Array.isArray(replay.results) ? replay.results[0] : undefined);
  const replayIngress = record(replayResult.ingress);
  assert(replayResult.replayed === true, 'exact comment replay was not deduplicated');
  assert(replayResult.workflowId === workflowId, 'replay changed workflow identity');
  assert(replayIngress.duplicateCount === 1, 'duplicate count mismatch');

  const pool = new Pool({ connectionString: loadRuntimeConfig().postgresUrl });
  try {
    const ingress = await pool.query<Json>(
      `SELECT event_id,provider,channel,business_slug,provider_event_id,status,workflow_id,duplicate_count
       FROM cta_ingress_records
       WHERE provider_event_id=$1`,
      [`facebook:comment:${commentId}`],
    );
    assert(ingress.rows.length === 1, 'expected one CTA ingress record');
    const row = ingress.rows[0]!;
    assert(row.business_slug === businessSlug, 'business route mismatch');
    assert(row.workflow_id === workflowId, 'persisted workflow mismatch');
    assert(row.status === 'PROCESSING', 'persisted ingress status mismatch');
    assert(Number(row.duplicate_count) === 1, 'persisted duplicate count mismatch');

    const binding = await pool.query<Json>(
      `SELECT workflow_id,binding_status
       FROM channel_conversation_bindings
       WHERE business_slug=$1
         AND channel='FACEBOOK_COMMENT'
         AND external_conversation_id=$2`,
      [businessSlug, `facebook:post:${postId}:user:${senderId}`],
    );
    assert(binding.rows.length === 1, 'Facebook comment channel binding missing');
    assert(binding.rows[0]?.workflow_id === workflowId, 'channel binding workflow mismatch');
    assert(binding.rows[0]?.binding_status === 'ACTIVE', 'channel binding should remain ACTIVE pending private continuation');
  } finally {
    await pool.end();
  }

  console.log(`META_FACEBOOK_COMMENT_CANONICAL_BRIDGE_PASS ${JSON.stringify({
    provider: 'facebook',
    channel: 'facebook_comment',
    workflowId,
    replayed: true,
    duplicateCount: 1,
    privateContinuationRequired: true,
  })}`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exitCode = 1;
});
