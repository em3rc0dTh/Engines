import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { Pool } from 'pg';
import { loadRuntimeConfig } from '../src/config/runtime-config.js';
import type { IntegrationCommand } from '../src/contracts/integration-engine/index.js';
import { executeIntegrationOutboundOperation } from '../src/integration/delivery-executor.js';
import { acceptIntegrationWebhook, IntegrationInboundError } from '../src/integration/inbound.js';
import { IntegrationProviderAdapterRegistry } from '../src/integration/provider.js';
import {
  INTEGRATION_MESSAGING_RECEIVE_CAPABILITY,
  INTEGRATION_MESSAGING_SEND_CAPABILITY,
  INTEGRATION_SEND_TEXT_ACTION,
  KAPSO_API_KEY_PURPOSE,
  KAPSO_WEBHOOK_SECRET_PURPOSE,
  KAPSO_WHATSAPP_PROVIDER_KIND,
  KapsoWhatsAppIntegrationAdapter,
  KapsoWhatsAppWebhookVerifier,
} from '../src/integration/providers/kapso-whatsapp.js';
import { EnvironmentIntegrationSecretResolver } from '../src/integration/secret-resolution.js';
import { PostgresIntegrationInboundLedger } from '../src/persistence/postgres/integration-inbound-ledger.repository.js';
import { PostgresIntegrationOutboundLedger } from '../src/persistence/postgres/integration-outbound-ledger.repository.js';
import { PostgresIntegrationRegistryRepository } from '../src/persistence/postgres/integration-registry.repository.js';

const BUSINESS = 'i4-kapso-business';
const CONNECTION = 'kapso-primary';
const PHONE_NUMBER_ID = '123456789012345';
const API_KEY = 'i4-proof-api-key-never-persist';
const WEBHOOK_SECRET = 'i4-proof-webhook-secret-never-persist';
const API_KEY_ENV = 'I4_KAPSO_API_KEY';
const WEBHOOK_SECRET_ENV = 'I4_KAPSO_WEBHOOK_SECRET';
const RECIPIENT = '+51999999999';

function command(): IntegrationCommand {
  return {
    schemaVersion: 1,
    commandId: 'i4-command-001',
    operationId: 'i4-operation-001',
    businessSlug: BUSINESS,
    connectionRef: CONNECTION,
    capability: INTEGRATION_MESSAGING_SEND_CAPABILITY,
    action: INTEGRATION_SEND_TEXT_ACTION,
    targetRef: { kind: 'phone', ref: RECIPIENT },
    payload: { text: 'G3-I4 deterministic adapter proof' },
    requestedAt: '2026-09-16T22:30:00.000Z',
    correlation: { correlationId: 'i4-correlation-001' },
  };
}

function sign(rawBody: string): string {
  return createHmac('sha256', WEBHOOK_SECRET).update(rawBody).digest('hex');
}

function webhookBody(messageId = 'wamid.i4-proof-001'): string {
  return JSON.stringify({
    phone_number_id: PHONE_NUMBER_ID,
    conversation: {
      id: 'kapso-conversation-i4',
      phone_number_id: PHONE_NUMBER_ID,
      phone_number: RECIPIENT,
    },
    message: {
      id: messageId,
      from: RECIPIENT,
      timestamp: '1789597800',
      type: 'text',
      text: { body: 'I4 HUMAN-BOUNDARY ACK' },
      kapso: { phone_number_id: PHONE_NUMBER_ID },
    },
  });
}

async function run(): Promise<void> {
  const config = loadRuntimeConfig();
  const pool = new Pool({ connectionString: config.postgresUrl, max: 12 });
  const registry = new PostgresIntegrationRegistryRepository(pool);
  const outbound = new PostgresIntegrationOutboundLedger(pool);
  const inbound = new PostgresIntegrationInboundLedger(pool);
  const secrets = new EnvironmentIntegrationSecretResolver({
    [API_KEY_ENV]: API_KEY,
    [WEBHOOK_SECRET_ENV]: WEBHOOK_SECRET,
  });

  const observedRequests: Array<Readonly<{ url: string; init?: RequestInit }>> = [];
  const fetchFn: typeof fetch = async (input, init) => {
    observedRequests.push({ url: String(input), ...(init === undefined ? {} : { init }) });
    return new Response(JSON.stringify({
      messaging_product: 'whatsapp',
      contacts: [{ input: RECIPIENT.replace(/\D/g, ''), wa_id: RECIPIENT.replace(/\D/g, '') }],
      messages: [{ id: 'wamid.i4-outbound-001' }],
    }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  };

  try {
    await pool.query(`DELETE FROM integration_inbound_events WHERE business_slug = $1`, [BUSINESS]);
    await pool.query(`DELETE FROM integration_outbound_attempts WHERE business_slug = $1`, [BUSINESS]);
    await pool.query(`DELETE FROM integration_outbound_commands WHERE business_slug = $1`, [BUSINESS]);
    await pool.query(`DELETE FROM integration_secret_references WHERE business_slug = $1`, [BUSINESS]);
    await pool.query(`DELETE FROM integration_connections WHERE business_slug = $1`, [BUSINESS]);
    await pool.query(`DELETE FROM integration_providers WHERE provider_kind = $1`, [KAPSO_WHATSAPP_PROVIDER_KIND]);

    await registry.registerProvider({
      providerKind: KAPSO_WHATSAPP_PROVIDER_KIND,
      displayName: 'Kapso WhatsApp',
      status: 'ENABLED',
      capabilities: [INTEGRATION_MESSAGING_SEND_CAPABILITY, INTEGRATION_MESSAGING_RECEIVE_CAPABILITY],
      revision: 1,
    });
    await registry.registerConnection({
      connectionRef: CONNECTION,
      businessSlug: BUSINESS,
      providerKind: KAPSO_WHATSAPP_PROVIDER_KIND,
      externalAccountRef: PHONE_NUMBER_ID,
      status: 'ENABLED',
      capabilities: [INTEGRATION_MESSAGING_SEND_CAPABILITY, INTEGRATION_MESSAGING_RECEIVE_CAPABILITY],
      secretRefs: [
        {
          secretRef: 'kapso-api-key-primary',
          purpose: KAPSO_API_KEY_PURPOSE,
          bindingKind: 'ENV',
          bindingRef: API_KEY_ENV,
        },
        {
          secretRef: 'kapso-webhook-secret-primary',
          purpose: KAPSO_WEBHOOK_SECRET_PURPOSE,
          bindingKind: 'ENV',
          bindingRef: WEBHOOK_SECRET_ENV,
        },
      ],
      revision: 1,
      createdAt: '2026-09-16T22:30:00.000Z',
      updatedAt: '2026-09-16T22:30:00.000Z',
    });

    const configured = await registry.resolveConnection(BUSINESS, CONNECTION, INTEGRATION_MESSAGING_SEND_CAPABILITY);
    assert.equal(configured.providerKind, KAPSO_WHATSAPP_PROVIDER_KIND);
    assert.equal(configured.secretRefs.some((entry) => entry.bindingRef === API_KEY_ENV), true);
    assert.equal(JSON.stringify(configured).includes(API_KEY), false);
    assert.equal(JSON.stringify(configured).includes(WEBHOOK_SECRET), false);
    console.log('INTEGRATION_G3_I4_SECRET_REF_RESOLUTION_PASS');

    await outbound.enqueue(command(), 3);
    const adapter = new KapsoWhatsAppIntegrationAdapter(secrets, { fetchFn });
    const adapters = new IntegrationProviderAdapterRegistry([adapter]);
    const delivered = await executeIntegrationOutboundOperation({
      businessSlug: BUSINESS,
      operationId: 'i4-operation-001',
      now: '2026-09-16T22:31:00.000Z',
      connections: registry,
      ledger: outbound,
      adapters,
    });
    assert.equal(delivered.status, 'SUCCEEDED');
    assert.equal(delivered.providerReceiptRef, 'wamid.i4-outbound-001');
    assert.equal(observedRequests.length, 1);
    assert.equal(observedRequests[0]!.url, `https://api.kapso.ai/meta/whatsapp/v24.0/${PHONE_NUMBER_ID}/messages`);
    assert.equal((observedRequests[0]!.init?.headers as Record<string, string>)['x-api-key'], API_KEY);
    const requestBody = JSON.parse(String(observedRequests[0]!.init?.body)) as Record<string, unknown>;
    assert.equal(requestBody.messaging_product, 'whatsapp');
    assert.equal(requestBody.to, RECIPIENT.replace(/\D/g, ''));
    assert.equal(JSON.stringify(requestBody).includes(API_KEY), false);
    console.log('INTEGRATION_G3_I4_KAPSO_OUTBOUND_MAPPING_PASS');

    const rateLimited = new KapsoWhatsAppIntegrationAdapter(secrets, {
      fetchFn: async () => new Response('{}', { status: 429 }),
    });
    const authRejected = new KapsoWhatsAppIntegrationAdapter(secrets, {
      fetchFn: async () => new Response('{}', { status: 401 }),
    });
    assert.deepEqual(await rateLimited.deliver(command(), configured), { kind: 'RETRYABLE', errorCode: 'RATE_LIMITED' });
    assert.deepEqual(await authRejected.deliver(command(), configured), { kind: 'FAILED_PERMANENT', errorCode: 'AUTHENTICATION_FAILED' });
    console.log('INTEGRATION_G3_I4_PROVIDER_ERROR_MAPPING_PASS');

    const verifier = new KapsoWhatsAppWebhookVerifier(registry, secrets);
    const rawBody = webhookBody();
    const accepted = await acceptIntegrationWebhook({
      request: {
        businessSlug: BUSINESS,
        connectionRef: CONNECTION,
        headers: {
          'content-type': 'application/json',
          'x-webhook-event': 'whatsapp.message.received',
          'x-webhook-payload-version': 'v2',
          'x-webhook-signature': sign(rawBody),
          'x-idempotency-key': 'kapso-delivery-i4-proof',
        },
        rawBody,
        receivedAt: '2026-09-16T22:32:00.000Z',
      },
      verifier,
      connections: registry,
      ledger: inbound,
    });
    assert.equal(accepted.replayed, false);
    assert.equal(accepted.event.providerEventIdentity, 'kapso-message:wamid.i4-proof-001');
    assert.equal(accepted.event.capability, INTEGRATION_MESSAGING_RECEIVE_CAPABILITY);
    assert.equal(accepted.event.eventType, 'message.received');
    assert.deepEqual(accepted.event.payload.message, { kind: 'text', text: 'I4 HUMAN-BOUNDARY ACK' });
    console.log('INTEGRATION_G3_I4_KAPSO_WEBHOOK_VERIFICATION_PASS');

    const countBeforeInvalid = await pool.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM integration_inbound_events WHERE business_slug = $1`,
      [BUSINESS],
    );
    const invalidBody = webhookBody('wamid.i4-invalid-signature');
    await assert.rejects(
      acceptIntegrationWebhook({
        request: {
          businessSlug: BUSINESS,
          connectionRef: CONNECTION,
          headers: {
            'x-webhook-event': 'whatsapp.message.received',
            'x-webhook-payload-version': 'v2',
            'x-webhook-signature': '00',
          },
          rawBody: invalidBody,
          receivedAt: '2026-09-16T22:33:00.000Z',
        },
        verifier,
        connections: registry,
        ledger: inbound,
      }),
      (error: unknown) => {
        assert.ok(error instanceof IntegrationInboundError);
        assert.equal(error.code, 'AUTHENTICATION_FAILED');
        return true;
      },
    );
    const countAfterInvalid = await pool.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM integration_inbound_events WHERE business_slug = $1`,
      [BUSINESS],
    );
    assert.equal(countAfterInvalid.rows[0]?.count, countBeforeInvalid.rows[0]?.count);
    console.log('INTEGRATION_G3_I4_INVALID_SIGNATURE_ZERO_DURABLE_PASS');

    const durable = await pool.query<{ command_json: string; provider_receipt_ref: string | null }>(
      `SELECT command_json::text AS command_json, provider_receipt_ref
         FROM integration_outbound_commands
        WHERE business_slug = $1 AND operation_id = $2`,
      [BUSINESS, 'i4-operation-001'],
    );
    const inboundDurable = await pool.query<{ event_json: string }>(
      `SELECT event_json::text AS event_json
         FROM integration_inbound_events
        WHERE business_slug = $1 AND connection_ref = $2`,
      [BUSINESS, CONNECTION],
    );
    const durableText = `${durable.rows[0]?.command_json ?? ''}\n${inboundDurable.rows.map((row) => row.event_json).join('\n')}`;
    assert.equal(durableText.includes(API_KEY), false);
    assert.equal(durableText.includes(WEBHOOK_SECRET), false);
    assert.equal(durableText.toLowerCase().includes('x-webhook-signature'), false);
    assert.equal(durableText.toLowerCase().includes('x-api-key'), false);
    console.log('INTEGRATION_G3_I4_SECRET_PERSISTENCE_BOUNDARY_PASS');

    console.log('INTEGRATION_G3_I4_KAPSO_ADAPTER_READY_PASS');
    console.log('INTEGRATION_G3_I4_HUMAN_TEST_READY');
  } finally {
    await pool.end();
  }
}

run().catch((error: unknown) => {
  console.error(`INTEGRATION_G3_I4_READINESS_FAILED ${JSON.stringify({
    error: error instanceof Error ? error.message : String(error),
  })}`);
  process.exitCode = 1;
});
