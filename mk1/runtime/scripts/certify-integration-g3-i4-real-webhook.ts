import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Pool } from 'pg';
import { loadRuntimeConfig } from '../src/config/runtime-config.js';
import { acceptIntegrationWebhook } from '../src/integration/inbound.js';
import { KapsoWhatsAppWebhookVerifier } from '../src/integration/providers/kapso-whatsapp.js';
import { EnvironmentIntegrationSecretResolver } from '../src/integration/secret-resolution.js';
import { PostgresIntegrationInboundLedger } from '../src/persistence/postgres/integration-inbound-ledger.repository.js';
import { PostgresIntegrationRegistryRepository } from '../src/persistence/postgres/integration-registry.repository.js';

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`MISSING_REQUIRED_ENV:${name}`);
  return value;
}

async function run(): Promise<void> {
  required('KAPSO_WEBHOOK_SECRET');
  const signature = required('KAPSO_REAL_WEBHOOK_SIGNATURE');
  const bodyFile = required('KAPSO_REAL_WEBHOOK_BODY_FILE');
  const businessSlug = process.env.KAPSO_TEST_BUSINESS_SLUG?.trim() || 'i4-kapso-live';
  const connectionRef = process.env.KAPSO_TEST_CONNECTION_REF?.trim() || 'kapso-live';
  const eventName = process.env.KAPSO_REAL_WEBHOOK_EVENT?.trim() || 'whatsapp.message.received';
  const payloadVersion = process.env.KAPSO_REAL_WEBHOOK_PAYLOAD_VERSION?.trim() || 'v2';
  const rawBody = await readFile(bodyFile, 'utf8');

  const config = loadRuntimeConfig();
  const pool = new Pool({ connectionString: config.postgresUrl, max: 6 });
  const registry = new PostgresIntegrationRegistryRepository(pool);
  const inbound = new PostgresIntegrationInboundLedger(pool);
  const verifier = new KapsoWhatsAppWebhookVerifier(
    registry,
    new EnvironmentIntegrationSecretResolver(process.env),
  );

  try {
    const before = await pool.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count
         FROM integration_inbound_events
        WHERE business_slug = $1 AND connection_ref = $2`,
      [businessSlug, connectionRef],
    );

    const result = await acceptIntegrationWebhook({
      request: {
        businessSlug,
        connectionRef,
        headers: {
          'content-type': 'application/json',
          'x-webhook-event': eventName,
          'x-webhook-payload-version': payloadVersion,
          'x-webhook-signature': signature,
        },
        rawBody,
        receivedAt: new Date().toISOString(),
      },
      verifier,
      connections: registry,
      ledger: inbound,
    });

    const after = await pool.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count
         FROM integration_inbound_events
        WHERE business_slug = $1 AND connection_ref = $2`,
      [businessSlug, connectionRef],
    );

    if (!result.replayed) {
      assert.equal(Number(after.rows[0]?.count ?? '0'), Number(before.rows[0]?.count ?? '0') + 1);
    } else {
      assert.equal(after.rows[0]?.count, before.rows[0]?.count);
    }

    assert.equal(JSON.stringify(result.event).includes(required('KAPSO_WEBHOOK_SECRET')), false);
    assert.equal(JSON.stringify(result.event).includes(signature), false);

    console.log(`INTEGRATION_G3_I4_REAL_WEBHOOK_ACCEPTED ${JSON.stringify({
      businessSlug,
      connectionRef,
      providerEventIdentity: result.event.providerEventIdentity,
      eventType: result.event.eventType,
      replayed: result.replayed,
    })}`);
  } finally {
    await pool.end();
  }
}

run().catch((error: unknown) => {
  console.error(`INTEGRATION_G3_I4_REAL_WEBHOOK_FAILED ${JSON.stringify({
    error: error instanceof Error ? error.message : String(error),
  })}`);
  process.exitCode = 1;
});
