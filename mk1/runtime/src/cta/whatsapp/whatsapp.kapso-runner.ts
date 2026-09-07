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
import { OfficialKapsoTransport } from './whatsapp.kapso.js';
import { renderWhatsAppRegistration } from './whatsapp.renderer.js';
import type { VerifiedWhatsAppInbound } from './whatsapp.transport.js';

const BUSINESS_SLUG = process.env.ENGINES_WHATSAPP_BUSINESS_SLUG?.trim() || 'golden-business';
const HOST = process.env.KAPSO_WEBHOOK_HOST?.trim() || '0.0.0.0';
const PORT = Number(process.env.KAPSO_WEBHOOK_PORT?.trim() || '8791');
const WEBHOOK_PATH = '/webhooks/kapso';
const QUERY_TIMEOUT_MS = 8_000;
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
      // Workflow Query can lag Workflow start by a short interval.
    }
    await delay(QUERY_POLL_MS);
  }
  throw new Error(`WHATSAPP_WORKFLOW_QUERY_TIMEOUT:${lastPhase}`);
}

async function main(): Promise<void> {
  if (!Number.isInteger(PORT) || PORT < 1 || PORT > 65535) throw new Error('KAPSO_WEBHOOK_PORT_INVALID');

  const webhookSecret = requiredEnv('KAPSO_WEBHOOK_SECRET');
  const apiKey = requiredEnv('KAPSO_API_KEY');
  const phoneNumberId = requiredEnv('KAPSO_PHONE_NUMBER_ID');
  const graphApiVersion = process.env.KAPSO_GRAPH_API_VERSION?.trim() || 'v24.0';

  const config = loadRuntimeConfig();
  const pool = new Pool({ connectionString: config.postgresUrl, max: 4 });
  const repository = new PostgresChannelRepository(pool);
  const customerPort = await TemporalRegisterNewCustomerPort.connect();
  const core = new CustomerRegistrationChannelExecutionCore(repository, customerPort);
  const adapter = new WhatsAppAdapter();
  const transport = new OfficialKapsoTransport({
    webhookSecret,
    apiKey,
    phoneNumberId,
    expectedPhoneNumberId: phoneNumberId,
    graphApiVersion,
  });

  const destination = (event: VerifiedWhatsAppInbound): string => event.senderPhone ?? event.senderId;

  const sendCurrent = async (event: VerifiedWhatsAppInbound, live: LiveRegistration): Promise<void> => {
    await transport.send(destination(event), renderWhatsAppRegistration(live.renderIntent));
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
        await transport.send(destination(event), renderWhatsAppRegistration('CONSENT'));
        return;
      }

      let envelope;
      try {
        envelope = adapter.normalizeInbound(event, { businessSlug: BUSINESS_SLUG });
      } catch {
        await transport.send(destination(event), renderWhatsAppRegistration('CONSENT'));
        return;
      }

      if (!envelope) {
        await transport.send(destination(event), { type: 'text', text: 'Entendido. No se inició ningún registro.' });
        return;
      }

      const started = await core.execute(envelope);
      if (!started.ok || !started.workflowId) {
        await transport.send(destination(event), { type: 'text', text: 'No pudimos iniciar tu registro. Inténtalo nuevamente.' });
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
      await transport.send(destination(event), { type: 'text', text: 'No pude interpretar esa respuesta. Usa la opción solicitada o escribe el dato nuevamente.' });
      await sendCurrent(event, live);
      return;
    }

    if (!envelope) {
      await sendCurrent(event, live);
      return;
    }

    const applied = await core.execute(envelope);
    if (!applied.ok) {
      await transport.send(destination(event), { type: 'text', text: 'Ese dato no es válido. Inténtalo nuevamente.' });
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
      reply(response, 200, JSON.stringify({ ok: true, provider: 'KAPSO', agent: false, mcp: false }), 'application/json');
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
          console.warn('KAPSO_WEBHOOK_REJECTED unauthenticated');
          reply(response, 401, 'UNAUTHENTICATED');
          return;
        }
        if (message.includes('PAYLOAD_VERSION_UNSUPPORTED') || message.includes('PHONE_NUMBER_ID_MISMATCH')) {
          console.warn(`KAPSO_WEBHOOK_REJECTED ${message}`);
          reply(response, 422, 'REJECTED');
          return;
        }
        console.error(`KAPSO_WEBHOOK_PROCESSING_ERROR ${message}`);
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

    console.log(`WHATSAPP_KAPSO_READY ${JSON.stringify({
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
  console.error(`WHATSAPP_KAPSO_FATAL ${error instanceof Error ? error.message : 'unknown'}`);
  process.exitCode = 1;
});
