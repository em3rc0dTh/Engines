import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { loadRuntimeConfig } from '../src/config/runtime-config.js';
import type { IntegrationCommand } from '../src/contracts/integration-engine/index.js';
import { executeIntegrationOutboundOperation } from '../src/integration/delivery-executor.js';
import { IntegrationProviderAdapterRegistry } from '../src/integration/provider.js';
import {
  INTEGRATION_MESSAGING_RECEIVE_CAPABILITY,
  INTEGRATION_MESSAGING_SEND_CAPABILITY,
  INTEGRATION_SEND_TEXT_ACTION,
  KAPSO_API_KEY_PURPOSE,
  KAPSO_WEBHOOK_SECRET_PURPOSE,
  KAPSO_WHATSAPP_PROVIDER_KIND,
  KapsoWhatsAppIntegrationAdapter,
} from '../src/integration/providers/kapso-whatsapp.js';
import { EnvironmentIntegrationSecretResolver } from '../src/integration/secret-resolution.js';
import { PostgresIntegrationOutboundLedger } from '../src/persistence/postgres/integration-outbound-ledger.repository.js';
import { PostgresIntegrationRegistryRepository } from '../src/persistence/postgres/integration-registry.repository.js';

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`MISSING_REQUIRED_ENV:${name}`);
  return value;
}

function normalizedPhone(value: string): string {
  const digits = value.replace(/\D/g, '');
  if (!digits) throw new Error('KAPSO_TEST_RECIPIENT_INVALID');
  return `+${digits}`;
}

async function run(): Promise<void> {
  const apiKey = required('KAPSO_API_KEY');
  required('KAPSO_WEBHOOK_SECRET');
  const phoneNumberId = required('KAPSO_PHONE_NUMBER_ID');
  const recipient = normalizedPhone(required('KAPSO_TEST_RECIPIENT'));
  const businessSlug = process.env.KAPSO_TEST_BUSINESS_SLUG?.trim() || 'i4-kapso-live';
  const connectionRef = process.env.KAPSO_TEST_CONNECTION_REF?.trim() || 'kapso-live';
  const now = new Date().toISOString();
  const nonce = randomUUID();
  const operationId = `i4-kapso-real:${nonce}`;
  const commandId = `i4-kapso-real-command:${nonce}`;

  const config = loadRuntimeConfig();
  const pool = new Pool({ connectionString: config.postgresUrl, max: 6 });
  const registry = new PostgresIntegrationRegistryRepository(pool);
  const outbound = new PostgresIntegrationOutboundLedger(pool);

  try {
    await registry.registerProvider({
      providerKind: KAPSO_WHATSAPP_PROVIDER_KIND,
      displayName: 'Kapso WhatsApp',
      status: 'ENABLED',
      capabilities: [INTEGRATION_MESSAGING_SEND_CAPABILITY, INTEGRATION_MESSAGING_RECEIVE_CAPABILITY],
      revision: 1,
    });

    await registry.registerConnection({
      connectionRef,
      businessSlug,
      providerKind: KAPSO_WHATSAPP_PROVIDER_KIND,
      externalAccountRef: phoneNumberId,
      status: 'ENABLED',
      capabilities: [INTEGRATION_MESSAGING_SEND_CAPABILITY, INTEGRATION_MESSAGING_RECEIVE_CAPABILITY],
      secretRefs: [
        {
          secretRef: 'kapso-api-key-primary',
          purpose: KAPSO_API_KEY_PURPOSE,
          bindingKind: 'ENV',
          bindingRef: 'KAPSO_API_KEY',
        },
        {
          secretRef: 'kapso-webhook-secret-primary',
          purpose: KAPSO_WEBHOOK_SECRET_PURPOSE,
          bindingKind: 'ENV',
          bindingRef: 'KAPSO_WEBHOOK_SECRET',
        },
      ],
      revision: 1,
      createdAt: now,
      updatedAt: now,
    });

    const command: IntegrationCommand = {
      schemaVersion: 1,
      commandId,
      operationId,
      businessSlug,
      connectionRef,
      capability: INTEGRATION_MESSAGING_SEND_CAPABILITY,
      action: INTEGRATION_SEND_TEXT_ACTION,
      targetRef: { kind: 'phone', ref: recipient },
      payload: {
        text: `Engines G3-I4 real-provider proof ${nonce.slice(0, 8)}`,
      },
      requestedAt: now,
      correlation: { correlationId: operationId },
    };

    await outbound.enqueue(command, 1);
    const adapter = new KapsoWhatsAppIntegrationAdapter(
      new EnvironmentIntegrationSecretResolver(process.env),
    );
    const adapters = new IntegrationProviderAdapterRegistry([adapter]);
    const result = await executeIntegrationOutboundOperation({
      businessSlug,
      operationId,
      now: new Date().toISOString(),
      connections: registry,
      ledger: outbound,
      adapters,
      leaseSeconds: 60,
    });

    assert.equal(result.status, 'SUCCEEDED', `real Kapso delivery ended in ${result.status}:${result.lastErrorCode ?? 'none'}`);
    assert.ok(result.providerReceiptRef, 'Kapso success did not return a provider message id');
    assert.equal(JSON.stringify(result).includes(apiKey), false, 'API key leaked into durable outbound result');

    console.log(`INTEGRATION_G3_I4_REAL_OUTBOUND_ACCEPTED ${JSON.stringify({
      businessSlug,
      connectionRef,
      operationId,
      providerReceiptRef: result.providerReceiptRef,
      recipient,
    })}`);
  } finally {
    await pool.end();
  }
}

run().catch((error: unknown) => {
  console.error(`INTEGRATION_G3_I4_REAL_OUTBOUND_FAILED ${JSON.stringify({
    error: error instanceof Error ? error.message : String(error),
  })}`);
  process.exitCode = 1;
});
