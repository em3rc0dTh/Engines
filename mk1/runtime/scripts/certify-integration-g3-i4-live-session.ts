import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { createServer, type IncomingHttpHeaders, type IncomingMessage, type Server } from 'node:http';
import { createInterface } from 'node:readline/promises';
import { Pool } from 'pg';
import { loadRuntimeConfig } from '../src/config/runtime-config.js';
import type { IntegrationCommand, IntegrationEvent } from '../src/contracts/integration-engine/index.js';
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

const MAX_BODY_BYTES = 1_000_000;
const DEFAULT_HOST = '0.0.0.0';
const DEFAULT_PORT = 8792;
const DEFAULT_PATH = '/webhooks/integration-g3-i4';
const DEFAULT_TIMEOUT_MS = 10 * 60 * 1000;
const DEFAULT_RECEIPT_FILE = '/tmp/engines-g3-i4-real-provider-receipt.json';

type JsonRecord = Record<string, unknown>;

type AcceptedProof = Readonly<{
  event: IntegrationEvent;
  replayed: boolean;
}>;

function record(value: unknown): JsonRecord | undefined {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as JsonRecord
    : undefined;
}

function optionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`MISSING_REQUIRED_ENV:${name}`);
  return value;
}

function integerEnv(name: string, fallback: number, min: number, max: number): number {
  const raw = process.env[name]?.trim();
  if (!raw) return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new Error(`INVALID_INTEGER_ENV:${name}`);
  }
  return value;
}

function normalizedPhone(value: string): string {
  const digits = value.replace(/\D/g, '');
  if (!digits) throw new Error('KAPSO_TEST_RECIPIENT_INVALID');
  return `+${digits}`;
}

function normalizedHeaders(headers: IncomingHttpHeaders): Readonly<Record<string, string | undefined>> {
  const output: Record<string, string | undefined> = {};
  for (const [key, value] of Object.entries(headers)) {
    output[key.toLowerCase()] = Array.isArray(value) ? value[0] : value;
  }
  return output;
}

async function readBody(request: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > MAX_BODY_BYTES) throw new Error('KAPSO_I4_WEBHOOK_BODY_TOO_LARGE');
    chunks.push(buffer);
  }
  return Buffer.concat(chunks).toString('utf8');
}

function eventText(event: IntegrationEvent): string | undefined {
  const message = record(event.payload.message);
  if (message?.kind !== 'text') return undefined;
  return optionalString(message.text);
}

function sourceSha(): string {
  try {
    return execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  } catch {
    return 'unknown';
  }
}

function closeServer(server: Server): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  });
}

async function listen(server: Server, host: string, port: number): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const onError = (error: Error): void => {
      server.off('listening', onListening);
      reject(error);
    };
    const onListening = (): void => {
      server.off('error', onError);
      resolve();
    };
    server.once('error', onError);
    server.once('listening', onListening);
    server.listen(port, host);
  });
}

async function awaitHumanArm(publicWebhookUrl: string | undefined, path: string): Promise<void> {
  if (process.env.KAPSO_I4_AUTO_START?.trim().toLowerCase() === 'true') return;
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    throw new Error('KAPSO_I4_INTERACTIVE_TERMINAL_REQUIRED_OR_SET_KAPSO_I4_AUTO_START=true');
  }
  const terminal = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const endpoint = publicWebhookUrl ?? `https://<your-tunnel>${path}`;
    await terminal.question(
      `Listener is armed. Configure Kapso event whatsapp.message.received -> ${endpoint} with the same webhook secret, then press Enter to send the real proof message... `,
    );
  } finally {
    terminal.close();
  }
}

async function registerKapsoConnection(input: Readonly<{
  registry: PostgresIntegrationRegistryRepository;
  businessSlug: string;
  connectionRef: string;
  phoneNumberId: string;
  now: string;
}>): Promise<void> {
  await input.registry.registerProvider({
    providerKind: KAPSO_WHATSAPP_PROVIDER_KIND,
    displayName: 'Kapso WhatsApp',
    status: 'ENABLED',
    capabilities: [INTEGRATION_MESSAGING_SEND_CAPABILITY, INTEGRATION_MESSAGING_RECEIVE_CAPABILITY],
    revision: 1,
  });

  await input.registry.registerConnection({
    connectionRef: input.connectionRef,
    businessSlug: input.businessSlug,
    providerKind: KAPSO_WHATSAPP_PROVIDER_KIND,
    externalAccountRef: input.phoneNumberId,
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
    createdAt: input.now,
    updatedAt: input.now,
  });
}

async function run(): Promise<void> {
  const apiKey = required('KAPSO_API_KEY');
  const webhookSecret = required('KAPSO_WEBHOOK_SECRET');
  const phoneNumberId = required('KAPSO_PHONE_NUMBER_ID');
  const recipient = normalizedPhone(required('KAPSO_TEST_RECIPIENT'));
  const businessSlug = process.env.KAPSO_TEST_BUSINESS_SLUG?.trim() || 'i4-kapso-live';
  const connectionRef = process.env.KAPSO_TEST_CONNECTION_REF?.trim() || 'kapso-live';
  const host = process.env.KAPSO_I4_WEBHOOK_HOST?.trim() || DEFAULT_HOST;
  const port = integerEnv('KAPSO_I4_WEBHOOK_PORT', DEFAULT_PORT, 1, 65535);
  const path = process.env.KAPSO_I4_WEBHOOK_PATH?.trim() || DEFAULT_PATH;
  const timeoutMs = integerEnv('KAPSO_I4_WEBHOOK_TIMEOUT_MS', DEFAULT_TIMEOUT_MS, 10_000, 3_600_000);
  const receiptFile = process.env.KAPSO_I4_RECEIPT_FILE?.trim() || DEFAULT_RECEIPT_FILE;
  const publicWebhookUrl = process.env.KAPSO_I4_PUBLIC_WEBHOOK_URL?.trim();
  const now = new Date().toISOString();
  const nonce = randomUUID();
  const replyToken = `I4-${nonce.slice(0, 8).toUpperCase()}`;
  const operationId = `i4-kapso-live:${nonce}`;
  const commandId = `i4-kapso-live-command:${nonce}`;

  if (!path.startsWith('/')) throw new Error('KAPSO_I4_WEBHOOK_PATH_INVALID');
  if (publicWebhookUrl && !publicWebhookUrl.endsWith(path)) {
    throw new Error(`KAPSO_I4_PUBLIC_WEBHOOK_URL_MUST_END_WITH:${path}`);
  }

  const config = loadRuntimeConfig();
  const pool = new Pool({ connectionString: config.postgresUrl, max: 6 });
  const registry = new PostgresIntegrationRegistryRepository(pool);
  const outbound = new PostgresIntegrationOutboundLedger(pool);
  const inbound = new PostgresIntegrationInboundLedger(pool);
  const secrets = new EnvironmentIntegrationSecretResolver(process.env);
  const verifier = new KapsoWhatsAppWebhookVerifier(registry, secrets);

  let proofResolve: ((value: AcceptedProof) => void) | undefined;
  let proofReject: ((reason: unknown) => void) | undefined;
  let proofSettled = false;
  let timeout: NodeJS.Timeout | undefined;
  const proofPromise = new Promise<AcceptedProof>((resolve, reject) => {
    proofResolve = resolve;
    proofReject = reject;
  });

  const server = createServer(async (request, response) => {
    try {
      const requestUrl = new URL(request.url ?? '/', `http://${request.headers.host ?? 'localhost'}`);
      if (request.method === 'GET' && requestUrl.pathname === '/health') {
        response.writeHead(200, { 'content-type': 'application/json' });
        response.end(JSON.stringify({ ok: true, gate: 'G3-I4', provider: 'KAPSO' }));
        return;
      }
      if (request.method !== 'POST' || requestUrl.pathname !== path) {
        response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
        response.end('not found');
        return;
      }

      const rawBody = await readBody(request);
      const headers = normalizedHeaders(request.headers);
      const acceptance = await acceptIntegrationWebhook({
        request: {
          businessSlug,
          connectionRef,
          headers,
          rawBody,
          receivedAt: new Date().toISOString(),
        },
        verifier,
        connections: registry,
        ledger: inbound,
      });

      response.writeHead(200, { 'content-type': 'text/plain; charset=utf-8' });
      response.end('OK');

      // Valid but unrelated events are acknowledged and durably deduplicated.
      // Only the nonce-bound reply completes this physical proof session.
      if (!proofSettled && eventText(acceptance.event) === replyToken) {
        proofSettled = true;
        proofResolve?.(acceptance);
      }
    } catch (error) {
      const authenticationFailure = error instanceof IntegrationInboundError
        && error.code === 'AUTHENTICATION_FAILED';
      response.writeHead(authenticationFailure ? 401 : 400, { 'content-type': 'text/plain; charset=utf-8' });
      response.end(authenticationFailure ? 'unauthorized' : 'invalid webhook');
      // Keep waiting after unrelated/invalid traffic; the bounded session ends
      // only on the expected signed reply or timeout.
    }
  });

  try {
    await registerKapsoConnection({ registry, businessSlug, connectionRef, phoneNumberId, now });
    await listen(server, host, port);

    console.log(`INTEGRATION_G3_I4_LIVE_LISTENER_READY ${JSON.stringify({
      host,
      port,
      path,
      ...(publicWebhookUrl ? { publicWebhookUrl } : {}),
      healthPath: '/health',
    })}`);

    await awaitHumanArm(publicWebhookUrl, path);

    timeout = setTimeout(() => {
      if (proofSettled) return;
      proofSettled = true;
      proofReject?.(new Error(`KAPSO_I4_REAL_WEBHOOK_TIMEOUT:${timeoutMs}`));
    }, timeoutMs);
    timeout.unref();

    console.log(`INTEGRATION_G3_I4_LIVE_ACTION_REQUIRED Reply exactly ${replyToken} from the authorized WhatsApp test recipient.`);

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
        text: `Engines G3-I4 real-provider proof. Reply exactly: ${replyToken}`,
      },
      requestedAt: now,
      correlation: { correlationId: operationId },
    };

    await outbound.enqueue(command, 1);
    const adapter = new KapsoWhatsAppIntegrationAdapter(secrets);
    const adapters = new IntegrationProviderAdapterRegistry([adapter]);
    const outboundResult = await executeIntegrationOutboundOperation({
      businessSlug,
      operationId,
      now: new Date().toISOString(),
      connections: registry,
      ledger: outbound,
      adapters,
      leaseSeconds: 60,
    });

    assert.equal(
      outboundResult.status,
      'SUCCEEDED',
      `real Kapso delivery ended in ${outboundResult.status}:${outboundResult.lastErrorCode ?? 'none'}`,
    );
    assert.ok(outboundResult.providerReceiptRef, 'Kapso success did not return a provider message id');
    assert.equal(JSON.stringify(outboundResult).includes(apiKey), false, 'API key leaked into durable outbound result');
    assert.equal(JSON.stringify(outboundResult).includes(webhookSecret), false, 'webhook secret leaked into durable outbound result');

    console.log(`INTEGRATION_G3_I4_REAL_OUTBOUND_ACCEPTED ${JSON.stringify({
      businessSlug,
      connectionRef,
      operationId,
      providerReceiptRef: outboundResult.providerReceiptRef,
    })}`);

    const inboundResult = await proofPromise;
    assert.equal(JSON.stringify(inboundResult.event).includes(apiKey), false, 'API key leaked into canonical inbound event');
    assert.equal(JSON.stringify(inboundResult.event).includes(webhookSecret), false, 'webhook secret leaked into canonical inbound event');
    assert.equal(eventText(inboundResult.event), replyToken, 'accepted inbound event did not match the nonce-bound reply');

    console.log(`INTEGRATION_G3_I4_REAL_WEBHOOK_ACCEPTED ${JSON.stringify({
      businessSlug,
      connectionRef,
      providerEventIdentity: inboundResult.event.providerEventIdentity,
      eventId: inboundResult.event.eventId,
      eventType: inboundResult.event.eventType,
      replayed: inboundResult.replayed,
    })}`);

    const completedAt = new Date().toISOString();
    const receipt = {
      schemaVersion: 1,
      gate: 'G3-I4',
      result: 'PASS',
      sourceSha: sourceSha(),
      businessSlug,
      connectionRef,
      phoneNumberId,
      providerKind: KAPSO_WHATSAPP_PROVIDER_KIND,
      outbound: {
        operationId,
        providerReceiptRef: outboundResult.providerReceiptRef,
        acceptedAt: outboundResult.updatedAt,
      },
      inbound: {
        providerEventIdentity: inboundResult.event.providerEventIdentity,
        eventId: inboundResult.event.eventId,
        eventType: inboundResult.event.eventType,
        receivedAt: inboundResult.event.receivedAt,
        replayed: inboundResult.replayed,
      },
      startedAt: now,
      completedAt,
      markers: [
        'INTEGRATION_G3_I4_REAL_OUTBOUND_ACCEPTED',
        'INTEGRATION_G3_I4_REAL_WEBHOOK_ACCEPTED',
        'INTEGRATION_G3_I4_REAL_PROVIDER_PASS',
      ],
      truthBoundary: {
        containsSecrets: false,
        containsRawWebhookBody: false,
        containsProviderHeaders: false,
        containsRecipientPhone: false,
        containsMessageContent: false,
      },
    } as const;

    await writeFile(receiptFile, `${JSON.stringify(receipt, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 });
    console.log(`INTEGRATION_G3_I4_REAL_PROVIDER_PASS ${JSON.stringify({
      sourceSha: receipt.sourceSha,
      businessSlug,
      connectionRef,
      providerReceiptRef: receipt.outbound.providerReceiptRef,
      providerEventIdentity: receipt.inbound.providerEventIdentity,
      receiptFile,
    })}`);
  } finally {
    if (timeout) clearTimeout(timeout);
    if (server.listening) await closeServer(server);
    await pool.end();
  }
}

run().catch((error: unknown) => {
  console.error(`INTEGRATION_G3_I4_REAL_PROVIDER_FAILED ${JSON.stringify({
    error: error instanceof Error ? error.message : String(error),
  })}`);
  process.exitCode = 1;
});
