import assert from 'node:assert/strict';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { Pool } from 'pg';
import { loadRuntimeConfig } from '../src/config/runtime-config.js';
import type { JsonObject } from '../src/contracts/integration-engine/index.js';
import {
  acceptIntegrationWebhook,
  IntegrationInboundError,
  type IntegrationWebhookRequest,
  type IntegrationWebhookVerifier,
} from '../src/integration/inbound.js';
import {
  IntegrationRegistryError,
  PostgresIntegrationRegistryRepository,
} from '../src/persistence/postgres/integration-registry.repository.js';
import {
  IntegrationInboundLedgerError,
  PostgresIntegrationInboundLedger,
} from '../src/persistence/postgres/integration-inbound-ledger.repository.js';

const PROVIDER = 'g3-i3-proof-provider';
const CONNECTION = 'webhook-primary';
const BUSINESS_A = 'i3-business-a';
const BUSINESS_B = 'i3-business-b';
const PROOF_SECRET_A = 'proof-only-hmac-key-a';
const PROOF_SECRET_B = 'proof-only-hmac-key-b';

function sign(secret: string, rawBody: string): string {
  return createHmac('sha256', secret).update(rawBody).digest('hex');
}

function proofVerifier(secret: string): IntegrationWebhookVerifier {
  return {
    async verify(request) {
      const provided = request.headers['x-proof-signature'];
      const expected = sign(secret, request.rawBody);
      if (provided === undefined) throw new Error('missing proof signature');

      const expectedBytes = Buffer.from(expected, 'hex');
      const providedBytes = Buffer.from(provided, 'hex');
      if (expectedBytes.length !== providedBytes.length || !timingSafeEqual(expectedBytes, providedBytes)) {
        throw new Error('invalid proof signature');
      }

      const parsed = JSON.parse(request.rawBody) as Record<string, unknown>;
      if (typeof parsed.id !== 'string') throw new Error('provider event id missing');
      if (typeof parsed.capability !== 'string') throw new Error('provider capability missing');
      if (typeof parsed.type !== 'string') throw new Error('provider event type missing');
      if (typeof parsed.data !== 'object' || parsed.data === null || Array.isArray(parsed.data)) {
        throw new Error('provider event data missing');
      }
      if (parsed.occurredAt !== undefined && typeof parsed.occurredAt !== 'string') {
        throw new Error('provider occurredAt invalid');
      }

      return {
        providerEventIdentity: parsed.id,
        capability: parsed.capability,
        eventType: parsed.type,
        payload: parsed.data as JsonObject,
        ...(parsed.occurredAt === undefined ? {} : { occurredAt: parsed.occurredAt }),
      };
    },
  };
}

function rawProviderBody(providerEventIdentity: string, status: string): string {
  return JSON.stringify({
    id: providerEventIdentity,
    capability: 'notifications.events',
    type: 'notification.delivery.updated',
    occurredAt: '2026-09-16T22:10:00.000Z',
    data: {
      messageRef: 'message-001',
      status,
    },
    providerRoute: '/proof-provider/webhooks/delivery',
    deliveryAttempt: 7,
  });
}

function request(
  businessSlug: string,
  connectionRef: string,
  rawBody: string,
  signature: string,
  receivedAt: string,
): IntegrationWebhookRequest {
  return {
    businessSlug,
    connectionRef,
    headers: {
      'content-type': 'application/json',
      'x-proof-signature': signature,
      'x-provider-trace': 'transient-trace-only',
    },
    rawBody,
    receivedAt,
  };
}

function expectInboundCode(error: unknown, code: string): boolean {
  assert.ok(error instanceof IntegrationInboundError, `expected IntegrationInboundError, got ${String(error)}`);
  assert.equal(error.code, code);
  return true;
}

function expectRegistryCode(error: unknown, code: string): boolean {
  assert.ok(error instanceof IntegrationRegistryError, `expected IntegrationRegistryError, got ${String(error)}`);
  assert.equal(error.code, code);
  return true;
}

function expectLedgerCode(error: unknown, code: string): boolean {
  assert.ok(error instanceof IntegrationInboundLedgerError, `expected IntegrationInboundLedgerError, got ${String(error)}`);
  assert.equal(error.code, code);
  return true;
}

async function countInbound(pool: Pool, businessSlug: string): Promise<number> {
  const result = await pool.query<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM integration_inbound_events WHERE business_slug = $1`,
    [businessSlug],
  );
  return Number(result.rows[0]?.count ?? '0');
}

async function run(): Promise<void> {
  const config = loadRuntimeConfig();
  const pool = new Pool({ connectionString: config.postgresUrl, max: 16 });
  const registry = new PostgresIntegrationRegistryRepository(pool);
  const ledger = new PostgresIntegrationInboundLedger(pool);
  const verifierA = proofVerifier(PROOF_SECRET_A);
  const verifierB = proofVerifier(PROOF_SECRET_B);

  try {
    await pool.query(`DELETE FROM integration_inbound_events WHERE business_slug IN ($1,$2)`, [BUSINESS_A, BUSINESS_B]);
    await pool.query(`DELETE FROM integration_secret_references WHERE business_slug IN ($1,$2)`, [BUSINESS_A, BUSINESS_B]);
    await pool.query(`DELETE FROM integration_connections WHERE business_slug IN ($1,$2)`, [BUSINESS_A, BUSINESS_B]);
    await pool.query(`DELETE FROM integration_providers WHERE provider_kind = $1`, [PROVIDER]);

    await registry.registerProvider({
      providerKind: PROVIDER,
      displayName: 'G3 I3 Proof Provider',
      status: 'ENABLED',
      capabilities: ['notifications.events'],
      revision: 1,
    });

    for (const businessSlug of [BUSINESS_A, BUSINESS_B]) {
      await registry.registerConnection({
        connectionRef: CONNECTION,
        businessSlug,
        providerKind: PROVIDER,
        externalAccountRef: `acct-${businessSlug}`,
        status: 'ENABLED',
        capabilities: ['notifications.events'],
        secretRefs: [{
          secretRef: 'webhook-auth-primary',
          purpose: 'webhook-auth',
          bindingKind: 'ENV',
          bindingRef: businessSlug === BUSINESS_A ? 'I3_BUSINESS_A_WEBHOOK_SECRET' : 'I3_BUSINESS_B_WEBHOOK_SECRET',
        }],
        revision: 1,
        createdAt: '2026-09-16T22:00:00.000Z',
        updatedAt: '2026-09-16T22:00:00.000Z',
      });
    }

    const bodyA = rawProviderBody('provider-event-001', 'delivered');

    await assert.rejects(
      acceptIntegrationWebhook({
        request: request(BUSINESS_A, CONNECTION, bodyA, '00', '2026-09-16T22:10:01.000Z'),
        verifier: verifierA,
        connections: registry,
        ledger,
      }),
      (error: unknown) => expectInboundCode(error, 'AUTHENTICATION_FAILED'),
    );
    assert.equal(await countInbound(pool, BUSINESS_A), 0);
    console.log('INTEGRATION_G3_I3_INVALID_AUTH_ZERO_DURABLE_PASS');

    const missingConnectionBody = rawProviderBody('provider-event-missing-connection', 'delivered');
    await assert.rejects(
      acceptIntegrationWebhook({
        request: request(
          BUSINESS_A,
          'missing-connection',
          missingConnectionBody,
          sign(PROOF_SECRET_A, missingConnectionBody),
          '2026-09-16T22:10:02.000Z',
        ),
        verifier: verifierA,
        connections: registry,
        ledger,
      }),
      (error: unknown) => expectRegistryCode(error, 'CONNECTION_NOT_FOUND'),
    );
    assert.equal(await countInbound(pool, BUSINESS_A), 0);
    console.log('INTEGRATION_G3_I3_CONNECTION_RESOLUTION_PASS');

    const first = await acceptIntegrationWebhook({
      request: request(
        BUSINESS_A,
        CONNECTION,
        bodyA,
        sign(PROOF_SECRET_A, bodyA),
        '2026-09-16T22:10:03.000Z',
      ),
      verifier: verifierA,
      connections: registry,
      ledger,
    });
    assert.equal(first.replayed, false);
    assert.equal(first.event.providerEventIdentity, 'provider-event-001');
    assert.equal(first.event.businessSlug, BUSINESS_A);
    assert.equal(first.event.payload.status, 'delivered');

    const replay = await acceptIntegrationWebhook({
      request: request(
        BUSINESS_A,
        CONNECTION,
        bodyA,
        sign(PROOF_SECRET_A, bodyA),
        '2026-09-16T22:11:03.000Z',
      ),
      verifier: verifierA,
      connections: registry,
      ledger,
    });
    assert.equal(replay.replayed, true);
    assert.equal(replay.event.eventId, first.event.eventId);
    assert.equal(replay.event.receivedAt, first.event.receivedAt);
    assert.equal(await countInbound(pool, BUSINESS_A), 1);
    console.log('INTEGRATION_G3_I3_REPLAY_DEDUP_PASS');

    const concurrentBody = rawProviderBody('provider-event-002', 'delivered');
    const concurrentResults = await Promise.all([
      acceptIntegrationWebhook({
        request: request(
          BUSINESS_A,
          CONNECTION,
          concurrentBody,
          sign(PROOF_SECRET_A, concurrentBody),
          '2026-09-16T22:12:00.000Z',
        ),
        verifier: verifierA,
        connections: registry,
        ledger,
      }),
      acceptIntegrationWebhook({
        request: request(
          BUSINESS_A,
          CONNECTION,
          concurrentBody,
          sign(PROOF_SECRET_A, concurrentBody),
          '2026-09-16T22:12:01.000Z',
        ),
        verifier: verifierA,
        connections: registry,
        ledger,
      }),
    ]);
    assert.equal(concurrentResults.filter((entry) => entry.replayed === false).length, 1);
    assert.equal(concurrentResults.filter((entry) => entry.replayed === true).length, 1);
    const concurrentCount = await pool.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count
         FROM integration_inbound_events
        WHERE business_slug = $1 AND connection_ref = $2 AND provider_event_identity = $3`,
      [BUSINESS_A, CONNECTION, 'provider-event-002'],
    );
    assert.equal(Number(concurrentCount.rows[0]?.count ?? '0'), 1);
    console.log('INTEGRATION_G3_I3_ATOMIC_DEDUP_PASS');

    const mutatedBody = rawProviderBody('provider-event-001', 'failed');
    await assert.rejects(
      acceptIntegrationWebhook({
        request: request(
          BUSINESS_A,
          CONNECTION,
          mutatedBody,
          sign(PROOF_SECRET_A, mutatedBody),
          '2026-09-16T22:13:00.000Z',
        ),
        verifier: verifierA,
        connections: registry,
        ledger,
      }),
      (error: unknown) => expectLedgerCode(error, 'IDEMPOTENCY_CONFLICT'),
    );
    assert.equal(await countInbound(pool, BUSINESS_A), 2);
    console.log('INTEGRATION_G3_I3_MATERIAL_CONFLICT_PASS');

    const businessB = await acceptIntegrationWebhook({
      request: request(
        BUSINESS_B,
        CONNECTION,
        bodyA,
        sign(PROOF_SECRET_B, bodyA),
        '2026-09-16T22:14:00.000Z',
      ),
      verifier: verifierB,
      connections: registry,
      ledger,
    });
    assert.equal(businessB.replayed, false);
    assert.equal(businessB.event.providerEventIdentity, first.event.providerEventIdentity);
    assert.equal(businessB.event.businessSlug, BUSINESS_B);
    assert.notEqual(businessB.event.eventId, first.event.eventId);
    assert.equal(await countInbound(pool, BUSINESS_B), 1);
    console.log('INTEGRATION_G3_I3_BUSINESS_ISOLATION_PASS');

    const persisted = await ledger.get(BUSINESS_A, CONNECTION, 'provider-event-001');
    assert.ok(persisted);
    const serialized = JSON.stringify(persisted);
    assert.equal(serialized.includes('providerRoute'), false);
    assert.equal(serialized.includes('/proof-provider/webhooks/delivery'), false);
    assert.equal(serialized.includes('x-proof-signature'), false);
    assert.equal(serialized.includes('x-provider-trace'), false);
    assert.equal(serialized.includes(PROOF_SECRET_A), false);
    assert.deepEqual(persisted.payload, { messageRef: 'message-001', status: 'delivered' });
    console.log('INTEGRATION_G3_I3_CANONICAL_EVENT_PASS');

    const schema = await pool.query<{ column_name: string }>(
      `SELECT column_name
         FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'integration_inbound_events'`,
    );
    const forbiddenColumns = new Set([
      'raw_body',
      'headers',
      'signature',
      'token',
      'access_token',
      'api_key',
      'password',
      'secret_value',
      'webhook_secret',
      'credential',
      'authorization',
      'raw_response',
    ]);
    assert.equal(schema.rows.some((row) => forbiddenColumns.has(row.column_name)), false);

    const storageText = await pool.query<{ event_json: string }>(
      `SELECT event_json::text AS event_json
         FROM integration_inbound_events
        WHERE business_slug = $1 AND connection_ref = $2 AND provider_event_identity = $3`,
      [BUSINESS_A, CONNECTION, 'provider-event-001'],
    );
    const durableText = storageText.rows[0]?.event_json ?? '';
    assert.equal(durableText.includes(PROOF_SECRET_A), false);
    assert.equal(durableText.includes('x-proof-signature'), false);
    assert.equal(durableText.includes('providerRoute'), false);
    console.log('INTEGRATION_G3_I3_SECRET_BOUNDARY_PASS');

    console.log('INTEGRATION_G3_I3_DURABLE_INBOUND_PASS');
    console.log('INTEGRATION_G3_I3_CERTIFICATION_PASS');
  } finally {
    await pool.end();
  }
}

run().catch((error: unknown) => {
  console.error(`INTEGRATION_G3_I3_CERTIFICATION_FAILED ${JSON.stringify({
    error: error instanceof Error ? error.message : String(error),
  })}`);
  process.exitCode = 1;
});
