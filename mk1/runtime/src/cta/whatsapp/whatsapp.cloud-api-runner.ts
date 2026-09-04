import { createServer, type IncomingHttpHeaders, type IncomingMessage, type ServerResponse } from 'node:http';
import { setTimeout as delay } from 'node:timers/promises';
import { Pool } from 'pg';
import { loadRuntimeConfig } from '../../config/runtime-config.js';
import type { RegistrationStateProjection } from '../../contracts/register-new-customer/index.js';
import { TemporalRegisterNewCustomerPort } from '../../orchestration/temporal/ports/register-new-customer.temporal-port.js';
import { getRegistrationStateQuery } from '../../orchestration/temporal/workflows/register-new-customer.workflow.js';
import { PostgresChannelRepository } from '../../persistence/postgres/channel.repository.js';
import { CustomerRegistrationChannelExecutionCore } from '../channel-core/customer-registration-channel-execution.js';
import { projectCustomerRegistration } from '../channel-core/customer-registration-view.js';
import type { CustomerRegistrationRenderIntent } from '../channel-core/types.js';
import { WhatsAppAdapter } from './whatsapp.adapter.js';
import { OfficialMetaCloudApiTransport } from './whatsapp.cloud-api-transport.js';
import { verifyMetaWebhookChallenge } from './whatsapp.cloud-api.js';
import { renderWhatsAppRegistration } from './whatsapp.renderer.js';
import type { VerifiedWhatsAppInbound } from './whatsapp.transport.js';

const BUSINESS_SLUG = process.env.ENGINES_WHATSAPP_BUSINESS_SLUG?.trim() || 'golden-business';
const HOST = process.env.WHATSAPP_WEBHOOK_HOST?.trim() || '0.0.0.0';
const PORT = Number(process.env.WHATSAPP_WEBHOOK_PORT?.trim() || '8790');
const WEBHOOK_PATH = '/webhooks/whatsapp';
const QUERY_TIMEOUT_MS = 15_000;
const QUERY_POLL_MS = 100;
const MAX_BODY_BYTES = 1_000_000;

type LiveRegistration = Readonly<{
  workflowId: string;
  state: RegistrationStateProjection;
  renderIntent: CustomerRegistrationRenderIntent;
}>;

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name}_REQUIRED`);
  return value;
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
    if (size > MAX_BODY_BYTES) throw new Error('WHATSAPP_WEBHOOK_BODY_TOO_LARGE');
    chunks.push(buffer);
  }
  return Buffer.concat(chunks).toString('utf8');
}

function reply(response: ServerResponse, status: number, body: string, contentType = 'text/plain; charset=utf-8'): void {
  response.writeHead(status, { 'content-type': contentType });
  response.end(body);
}

async function queryRegistration(
  customerPort: TemporalRegisterNewCustomerPort,
  workflowId: string,
): Promise<LiveRegistration> {
  const handle = customerPort.getClient().workflow.getHandle(workflowId);
  const deadline = Date.now() + QUERY_TIMEOUT_MS;
  let lastPhase = 'query-not-ready';
  while (Date.now() < deadline) {
    try {
      const state = await handle.query(getRegistrationStateQuery) as RegistrationStateProjection;
      lastPhase = state.phase;
      const view = projectCustomerRegistration(state);
      if (view.renderIntent !== 'WAIT' || state.workflowStatus !== 'RUNNING') {
        return { workflowId, state, renderIntent: view.renderIntent };
      }
    } catch {
      // Temporal may need a short interval before the first Query becomes available.
    }
    await delay(QUERY_POLL_MS);
  }
  throw new Error(`WHATSAPP_WORKFLOW_QUERY_TIMEOUT:${lastPhase}`);
}

async function main(): Promise<void> {
  if (!Number.isInteger(PORT) || PORT < 1 || PORT > 65535) throw new Error('WHATSAPP_WEBHOOK_PORT_INVALID');

  const appSecret = requiredEnv('WHATSAPP_APP_SECRET');
  const accessToken = requiredEnv('WHATSAPP_ACCESS_TOKEN');
  const phoneNumberId = requiredEnv('WHATSAPP_PHONE_NUMBER_ID');
  const verifyToken = requiredEnv('WHATSAPP_WEBHOOK_VERIFY_TOKEN');
  const graphApiVersion = requiredEnv('WHATSAPP_GRAPH_API_VERSION');

  const config = loadRuntimeConfig();
  const pool = new Pool({ connectionString: config.postgresUrl, max: 4 });
  const repository = new PostgresChannelRepository(pool);
  const customerPort = await TemporalRegisterNewCustomerPort.connect();
  const core = new CustomerRegistrationChannelExecutionCore(repository, customerPort);
  const adapter = new WhatsAppAdapter();
  const transport = new OfficialMetaCloudApiTransport({
    appSecret,
    accessToken,
    phoneNumberId,
    graphApiVersion,
  });

  const sendCurrent = async (event: VerifiedWhatsAppInbound, live: LiveRegistration): Promise<void> => {
    await transport.send(event.senderPhone, renderWhatsAppRegistration(live.renderIntent));
  };

  const getLiveForConversation = async (event: VerifiedWhatsAppInbound): Promise<LiveRegistration | undefined> => {
    const binding = await repository.getConversationBinding({
      businessSlug: BUSINESS_SLUG,
      channel: 'WHATSAPP',
      externalConversationId: `whatsapp:${event.conversationId}`,
    });
    if (!binding || binding.operation !== 'RegisterNewCustomer') return undefined;
    return queryRegistration(customerPort, binding.workflowId);
  };

  const processInbound = async (event: VerifiedWhatsAppInbound): Promise<void> => {
    let live = await getLiveForConversation(event);

    if (!live) {
      if (event.kind !== 'INTERACTIVE') {
        await transport.send(event.senderPhone, renderWhatsAppRegistration('CONSENT'));
        return;
      }

      let envelope;
      try {
        envelope = adapter.normalizeInbound(event, { businessSlug: BUSINESS_SLUG });
      } catch {
        await transport.send(event.senderPhone, renderWhatsAppRegistration('CONSENT'));
        return;
      }

      if (!envelope) {
        await transport.send(event.senderPhone, { type: 'text', text: 'Entendido. No se inició ningún registro.' });
        return;
      }

      const started = await core.execute(envelope);
      if (!started.ok || !started.workflowId) {
        await transport.send(event.senderPhone, { type: 'text', text: 'No pudimos iniciar tu registro. Inténtalo nuevamente.' });
        return;
      }

      live = await queryRegistration(customerPort, started.workflowId);
      await sendCurrent(event, live);
      return;
    }

    if (live.renderIntent === 'REGISTRATION_COMPLETE' || live.renderIntent === 'REGISTRATION_FAILED') {
      await sendCurrent(event, live);
      return;
    }

    let envelope;
    try {
      envelope = adapter.normalizeInbound(event, {
        businessSlug: BUSINESS_SLUG,
        registrationRenderIntent: live.renderIntent,
      });
    } catch {
      await transport.send(event.senderPhone, { type: 'text', text: 'No pude interpretar esa respuesta. Usa la opción solicitada o escribe el dato nuevamente.' });
      await sendCurrent(event, live);
      return;
    }

    if (!envelope) {
      await sendCurrent(event, live);
      return;
    }

    const applied = await core.execute(envelope);
    if (!applied.ok) {
      await transport.send(event.senderPhone, { type: 'text', text: 'Ese dato no es válido. Inténtalo nuevamente.' });
      live = await getLiveForConversation(event) ?? live;
      await sendCurrent(event, live);
      return;
    }

    live = await getLiveForConversation(event) ?? live;
    await sendCurrent(event, live);
  };

  const server = createServer(async (request, response) => {
    const url = new URL(request.url ?? '/', `http://${request.headers.host ?? 'localhost'}`);

    if (request.method === 'GET' && url.pathname === '/health') {
      reply(response, 200, JSON.stringify({ ok: true, provider: 'META_CLOUD_API', agent: false, mcp: false }), 'application/json');
      return;
    }

    if (request.method === 'GET' && url.pathname === WEBHOOK_PATH) {
      const challenge = verifyMetaWebhookChallenge(url, verifyToken);
      if (!challenge) {
        reply(response, 403, 'FORBIDDEN');
        return;
      }
      reply(response, 200, challenge);
      return;
    }

    if (request.method === 'POST' && url.pathname === WEBHOOK_PATH) {
      try {
        const body = await readBody(request);
        const events = transport.verifyAndNormalizeMany(body, normalizedHeaders(request.headers));
        for (const event of events) await processInbound(event);
        reply(response, 200, 'EVENT_RECEIVED');
      } catch (error) {
        const message = error instanceof Error ? error.message : 'unknown';
        if (message.includes('WHATSAPP_WEBHOOK_UNAUTHENTICATED')) {
          console.warn('WHATSAPP_WEBHOOK_REJECTED unauthenticated');
          reply(response, 401, 'UNAUTHENTICATED');
          return;
        }
        console.error(`WHATSAPP_WEBHOOK_PROCESSING_ERROR ${message}`);
        reply(response, 500, 'RETRY');
      }
      return;
    }

    reply(response, 404, 'NOT_FOUND');
  });

  let stopping = false;
  const stop = (): void => {
    if (stopping) return;
    stopping = true;
    server.close();
  };
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);

  try {
    await new Promise<void>((resolve, reject) => {
      server.once('error', reject);
      server.listen(PORT, HOST, () => resolve());
    });

    console.log(`WHATSAPP_CLOUD_API_READY ${JSON.stringify({
      host: HOST,
      port: PORT,
      webhookPath: WEBHOOK_PATH,
      phoneNumberId,
      graphApiVersion,
      businessSlug: BUSINESS_SLUG,
      agent: false,
      mcp: false,
    })}`);

    await new Promise<void>((resolve) => server.once('close', resolve));
  } finally {
    await customerPort.close();
    await pool.end();
  }
}

main().catch((error) => {
  console.error(`WHATSAPP_CLOUD_API_FATAL ${error instanceof Error ? error.message : 'unknown'}`);
  process.exitCode = 1;
});
