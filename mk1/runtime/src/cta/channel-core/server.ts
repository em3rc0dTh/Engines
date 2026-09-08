import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { Pool } from 'pg';
import { loadRuntimeConfig } from '../../config/runtime-config.js';
import type { AppointmentStateProjection } from '../../contracts/register-new-appointment/index.js';
import { getAppointmentStateQuery } from '../../orchestration/temporal/workflows/register-new-appointment.workflow.js';
import { TemporalRegisterNewAppointmentPort } from '../../orchestration/temporal/ports/register-new-appointment.temporal-port.js';
import {
  ChannelBindingConflictError,
  ChannelEventIdentityConflictError,
  PostgresChannelRepository,
} from '../../persistence/postgres/channel.repository.js';
import { PostgresCTAIngressRepository } from '../../persistence/postgres/cta-ingress.repository.js';
import { PostgresServicesRepository } from '../../persistence/postgres/services.repository.js';
import { ChannelCoreCTAOrchestrationPort } from '../canonical/channel-orchestration.port.js';
import { toCanonicalCTAEvent } from '../canonical/compatibility.js';
import { CanonicalCTADispatcher } from '../canonical/dispatcher.js';
import { projectAppointmentWorkflow } from './appointment-workflow-view.js';
import { AppointmentChannelExecutionCore } from './appointment-channel-execution.js';
import { parseCanonicalChannelEnvelope } from './validation.js';
import type { ChannelKind } from './types.js';

const PORT = Number.parseInt(process.env.ENGINES_CHANNEL_PORT ?? '8788', 10);
const HOST = process.env.ENGINES_CHANNEL_HOST?.trim() || '127.0.0.1';
const MAX_BODY_BYTES = 1024 * 1024;

type JsonRecord = Record<string, unknown>;

function sendJson(response: ServerResponse, statusCode: number, value: unknown): void {
  const body = Buffer.from(JSON.stringify(value));
  response.writeHead(statusCode, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': body.byteLength,
    'cache-control': 'no-store',
  });
  response.end(body);
}

async function readJson(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let bytes = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    bytes += buffer.byteLength;
    if (bytes > MAX_BODY_BYTES) throw new Error('CHANNEL_BODY_TOO_LARGE');
    chunks.push(buffer);
  }
  if (bytes === 0) return {};
  return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown;
}

function conversationId(pathname: string): string | undefined {
  const prefix = '/channel/conversations/';
  if (!pathname.startsWith(prefix)) return undefined;
  const rest = pathname.slice(prefix.length);
  if (!rest || rest.includes('/')) return undefined;
  return decodeURIComponent(rest);
}

function channelKind(raw: string | null): ChannelKind | undefined {
  if (raw === 'WEBCHAT' || raw === 'TELEGRAM' || raw === 'WHATSAPP' || raw === 'API'
    || raw === 'MESSENGER' || raw === 'FACEBOOK_COMMENT' || raw === 'TIKTOK') return raw;
  return undefined;
}

async function run(): Promise<void> {
  const config = loadRuntimeConfig();
  const pool = new Pool({ connectionString: config.postgresUrl, max: 8 });
  const repository = new PostgresChannelRepository(pool);
  const ingressRepository = new PostgresCTAIngressRepository(pool);
  const servicesRepository = new PostgresServicesRepository(pool);
  const appointmentPort = await TemporalRegisterNewAppointmentPort.connect();
  const execution = new AppointmentChannelExecutionCore(repository, appointmentPort, servicesRepository);
  const ctaDispatcher = new CanonicalCTADispatcher(
    ingressRepository,
    new ChannelCoreCTAOrchestrationPort(execution),
  );

  const server = createServer(async (request, response) => {
    try {
      const url = new URL(request.url ?? '/', `http://${request.headers.host ?? 'localhost'}`);

      if (request.method === 'GET' && url.pathname === '/health') {
        await pool.query('SELECT 1');
        sendJson(response, 200, {
          ok: true,
          service: 'engines-channel-core',
          persistence: 'postgresql',
          orchestration: 'temporal',
          agent: false,
          mcp: false,
        });
        return;
      }

      if (request.method === 'POST' && url.pathname === '/channel/events') {
        const envelope = parseCanonicalChannelEnvelope(await readJson(request));
        const cta = toCanonicalCTAEvent(envelope, new Date().toISOString());
        if (cta) {
          const dispatched = await ctaDispatcher.dispatch(cta);
          sendJson(response, 200, {
            ok: true,
            replayed: dispatched.duplicate,
            workflowId: dispatched.ingress.workflowId,
            ingress: dispatched.ingress,
          });
          return;
        }
        const result = await execution.execute(envelope);
        const operation = result.operationResult && typeof result.operationResult === 'object'
          ? result.operationResult as { state?: { result?: Record<string, unknown> } }
          : undefined;
        const appointment = operation?.state?.result;
        if (result.ok && result.workflowId && appointment
          && typeof appointment.appointmentId === 'string'
          && typeof appointment.caseId === 'string') {
          await ingressRepository.completeConversation({
            businessSlug: envelope.businessSlug,
            correlationId: envelope.externalConversationId,
            workflowId: result.workflowId,
            caseId: appointment.caseId,
            appointmentId: appointment.appointmentId,
          });
        }
        sendJson(response, result.ok ? 200 : 422, result);
        return;
      }

      if (request.method === 'GET') {
        const externalConversationId = conversationId(url.pathname);
        if (externalConversationId) {
          const businessSlug = url.searchParams.get('businessSlug')?.trim();
          const channel = channelKind(url.searchParams.get('channel'));
          if (!businessSlug || !channel) {
            sendJson(response, 400, { ok: false, code: 'CHANNEL_CONVERSATION_QUERY_INVALID' });
            return;
          }
          const binding = await repository.getConversationBinding({ businessSlug, channel, externalConversationId });
          if (!binding) {
            sendJson(response, 404, { ok: false, code: 'CHANNEL_CONVERSATION_NOT_BOUND' });
            return;
          }
          const handle = appointmentPort.client.workflow.getHandle(binding.workflowId);
          const state = await handle.query(getAppointmentStateQuery) as AppointmentStateProjection;
          const description = await handle.describe();
          const bindingStatus = state.workflowStatus === 'COMPLETED'
            ? 'COMPLETED'
            : state.workflowStatus === 'FAILED' ? 'FAILED' : 'ACTIVE';
          const currentBinding = bindingStatus === binding.bindingStatus
            ? binding
            : await repository.updateBindingStatus({ businessSlug, channel, externalConversationId, status: bindingStatus }) ?? binding;
          const completed = state.result;
          if (state.workflowStatus === 'COMPLETED' && completed?.appointmentId && completed.caseId) {
            await ingressRepository.completeConversation({
              businessSlug,
              correlationId: externalConversationId,
              workflowId: binding.workflowId,
              caseId: completed.caseId,
              appointmentId: completed.appointmentId,
            });
          } else if (state.workflowStatus === 'FAILED') {
            await ingressRepository.failConversation({
              businessSlug,
              correlationId: externalConversationId,
              workflowId: binding.workflowId,
              errorCode: state.failure?.code ?? 'APPOINTMENT_WORKFLOW_FAILED',
            });
          }
          sendJson(response, 200, {
            ok: true,
            workflowId: binding.workflowId,
            runId: description.runId,
            binding: currentBinding,
            state,
            view: projectAppointmentWorkflow(state),
          });
          return;
        }
      }

      sendJson(response, 404, { ok: false, code: 'CHANNEL_ROUTE_NOT_FOUND' });
    } catch (error) {
      if (error instanceof ChannelEventIdentityConflictError || error instanceof ChannelBindingConflictError) {
        sendJson(response, 409, { ok: false, code: error.code, error: error.message });
        return;
      }
      const message = error instanceof Error ? error.message : String(error);
      if (message.startsWith('CHANNEL_EVENT_INVALID') || message === 'CHANNEL_OPERATION_NOT_SUPPORTED') {
        sendJson(response, 400, { ok: false, code: message.split(':')[0], error: message });
        return;
      }
      sendJson(response, 500, { ok: false, code: 'CHANNEL_INTERNAL_ERROR', error: message });
    }
  });

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(PORT, HOST, () => resolve());
  });

  console.log(`ENGINES_CHANNEL_CORE_READY ${JSON.stringify({ host: HOST, port: PORT, agent: false, mcp: false })}`);

  const shutdown = async (): Promise<void> => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await Promise.all([appointmentPort.close(), pool.end()]);
  };

  process.once('SIGTERM', () => void shutdown().then(() => process.exit(0)));
  process.once('SIGINT', () => void shutdown().then(() => process.exit(0)));
}

run().catch((error: unknown) => {
  console.error(`ENGINES_CHANNEL_CORE_FAILED ${JSON.stringify({ error: error instanceof Error ? error.message : String(error) })}`);
  process.exitCode = 1;
});
