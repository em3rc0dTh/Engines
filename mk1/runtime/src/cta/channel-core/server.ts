import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { createResilientPostgresPool } from '../../persistence/postgres/resilient-pool.js';
import { resolveAgentProfile } from '../../contracts/agent-layer/index.js';
import { LlamaCppAgentModelProvider } from '../../agent/index.js';
import {
  A5ConversationalAppointmentExperience,
  LlamaCppA5ExperienceProvider,
} from '../../agent/experience/index.js';
import { AgentConversationRuntime } from '../../agent/runtime/index.js';
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
import { PostgresAgentRuntimeRepository } from '../../persistence/postgres/agent-runtime.repository.js';
import { PostgresServicesRepository } from '../../persistence/postgres/services.repository.js';
import { ChannelCoreCTAOrchestrationPort } from '../canonical/channel-orchestration.port.js';
import { toCanonicalCTAEvent } from '../canonical/compatibility.js';
import { CanonicalCTADispatcher } from '../canonical/dispatcher.js';
import { canonicalizeFacebookPageComments, parseMetaPageRoutes } from '../meta/meta-page-ingress.js';
import { projectAppointmentWorkflow } from './appointment-workflow-view.js';
import { AppointmentChannelExecutionCore } from './appointment-channel-execution.js';
import { AgentAppointmentChannelCore } from './appointment-agent-channel-core.js';
import { parseCanonicalChannelEnvelope } from './validation.js';
import type { ChannelKind } from './types.js';

const PORT = Number.parseInt(process.env.ENGINES_CHANNEL_PORT ?? '8788', 10);
const HOST = process.env.ENGINES_CHANNEL_HOST?.trim() || '127.0.0.1';
const MAX_BODY_BYTES = 1024 * 1024;

type JsonRecord = Record<string, unknown>;

function record(value: unknown): JsonRecord | undefined {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as JsonRecord : undefined;
}

function requiredString(source: JsonRecord, key: string): string {
  const value = source[key];
  if (typeof value !== 'string' || !value.trim()) throw new Error(`AGENT_CHANNEL_MESSAGE_INVALID:${key}`);
  return value.trim();
}

function sendJson(response: ServerResponse, statusCode: number, value: unknown): void {
  const body = Buffer.from(JSON.stringify(value));
  response.writeHead(statusCode, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': body.byteLength,
    'cache-control': 'no-store',
  });
  response.end(body);
}

async function readBody(request: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  let bytes = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    bytes += buffer.byteLength;
    if (bytes > MAX_BODY_BYTES) throw new Error('CHANNEL_BODY_TOO_LARGE');
    chunks.push(buffer);
  }
  return Buffer.concat(chunks).toString('utf8');
}

async function readJson(request: IncomingMessage): Promise<unknown> {
  const rawBody = await readBody(request);
  if (!rawBody) return {};
  return JSON.parse(rawBody) as unknown;
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

function projectTerminalTemporalFailure(
  state: AppointmentStateProjection,
  closeTime: Date | undefined,
): AppointmentStateProjection {
  if (!closeTime || state.workflowStatus !== 'RUNNING') return state;
  return {
    ...state,
    workflowStatus: 'FAILED',
    phase: 'FAILED',
    nextAction: 'NONE',
    failure: state.failure ?? {
      code: 'APPOINTMENT_WORKFLOW_FAILED',
      message: 'Temporal workflow execution closed without a completed Appointment',
    },
  };
}

async function run(): Promise<void> {
  const config = loadRuntimeConfig();
  const pool = createResilientPostgresPool({ connectionString: config.postgresUrl, max: 8 }, 'channel-core');
  const repository = new PostgresChannelRepository(pool);
  const ingressRepository = new PostgresCTAIngressRepository(pool);
  const agentRuntimeRepository = new PostgresAgentRuntimeRepository(pool);
  const agentRuntime = new AgentConversationRuntime(agentRuntimeRepository);
  const servicesRepository = new PostgresServicesRepository(pool);
  const appointmentPort = await TemporalRegisterNewAppointmentPort.connect();
  const execution = new AppointmentChannelExecutionCore(repository, appointmentPort, servicesRepository);
  const agentEnabled = (process.env.ENGINES_AGENT_ENABLED ?? '').trim().toLowerCase() === 'true';
  const agentExperienceEnabled = agentEnabled
    && (process.env.ENGINES_AGENT_EXPERIENCE_ENABLED ?? '').trim().toLowerCase() === 'true';
  const agentBaseUrl = process.env.AGENT_LLAMA_BASE_URL?.trim() || 'http://host.docker.internal:8080';
  const agentModel = process.env.AGENT_LLAMA_MODEL?.trim() || 'engines-agent-local';
  const agentTimeoutMs = Number.parseInt(process.env.AGENT_MODEL_TIMEOUT_MS ?? '30000', 10);
  const agentName = process.env.ENGINES_AGENT_NAME?.trim() || 'Assistant';
  const agentRole = process.env.ENGINES_AGENT_ROLE?.trim() || 'Customer Assistant';
  const agentBusinessName = process.env.ENGINES_AGENT_BUSINESS_NAME?.trim() || 'Golden Business';
  const agentProfile = resolveAgentProfile({
    identity: {
      name: agentName,
      role: agentRole,
    },
  });

  const readBoundConversation = async (input: Readonly<{
    businessSlug: string;
    channel: ChannelKind;
    externalConversationId: string;
  }>) => {
    const binding = await repository.getConversationBinding(input);
    if (!binding) return undefined;
    const handle = appointmentPort.client.workflow.getHandle(binding.workflowId);
    const state = await handle.query(getAppointmentStateQuery) as AppointmentStateProjection;
    return { workflowId: binding.workflowId, state };
  };

  const agentProvider = agentEnabled
    ? new LlamaCppAgentModelProvider({
        baseUrl: agentBaseUrl,
        model: agentModel,
        timeoutMs: agentTimeoutMs,
      })
    : undefined;
  const agentCore = agentProvider
    ? new AgentAppointmentChannelCore(
        {
          async read(input) {
            const current = await readBoundConversation(input);
            if (!current) throw new Error('CHANNEL_CONVERSATION_NOT_BOUND');
            return current;
          },
        },
        execution,
        agentProvider,
        agentRuntime,
        agentProfile,
      )
    : undefined;

  const a5Provider = agentExperienceEnabled
    ? new LlamaCppA5ExperienceProvider({
        baseUrl: agentBaseUrl,
        model: agentModel,
        timeoutMs: agentTimeoutMs,
      })
    : undefined;
  const a5Experience = a5Provider
    ? new A5ConversationalAppointmentExperience(
        {
          tryRead: readBoundConversation,
        },
        execution,
        a5Provider,
        agentRuntime,
        agentProfile,
        agentBusinessName,
      )
    : undefined;
  const ctaDispatcher = new CanonicalCTADispatcher(
    ingressRepository,
    new ChannelCoreCTAOrchestrationPort(execution),
  );
  const metaAppSecret = process.env.META_APP_SECRET?.trim() ?? '';
  const metaPageRoutes = parseMetaPageRoutes(process.env.ENGINES_META_PAGE_ROUTES_JSON);

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
          agent: Boolean(agentCore),
          agentRuntime: Boolean(agentCore),
          agentContext: agentCore ? 'postgresql' : 'disabled',
          agentExperience: Boolean(a5Experience),
          agentName: agentProfile.identity.name,
          agentBusinessName,
          mcp: false,
        });
        return;
      }

      if (request.method === 'POST' && url.pathname === '/meta/page/events') {
        if (!metaAppSecret) {
          sendJson(response, 503, { ok: false, code: 'META_APP_SECRET_NOT_CONFIGURED' });
          return;
        }

        const rawBody = await readBody(request);
        const events = canonicalizeFacebookPageComments({
          rawBody,
          headers: request.headers,
          appSecret: metaAppSecret,
          routes: metaPageRoutes,
          receivedAt: new Date().toISOString(),
        });

        const results = [];
        for (const event of events) {
          const dispatched = await ctaDispatcher.dispatch(event);
          results.push({
            replayed: dispatched.duplicate,
            workflowId: dispatched.ingress.workflowId,
            ingress: dispatched.ingress,
          });
        }

        sendJson(response, 200, {
          ok: true,
          accepted: events.length,
          results,
        });
        return;
      }

      if (request.method === 'POST' && url.pathname === '/channel/agent/experience/messages') {
        if (!a5Experience) {
          sendJson(response, 503, { ok: false, code: 'AGENT_EXPERIENCE_NOT_ENABLED' });
          return;
        }
        const body = record(await readJson(request));
        if (!body) {
          sendJson(response, 400, { ok: false, code: 'AGENT_CHANNEL_MESSAGE_INVALID' });
          return;
        }
        const channel = channelKind(typeof body.channel === 'string' ? body.channel : null);
        if (!channel) {
          sendJson(response, 400, { ok: false, code: 'AGENT_CHANNEL_MESSAGE_INVALID:channel' });
          return;
        }
        const result = await a5Experience.handle({
          businessSlug: requiredString(body, 'businessSlug'),
          channel,
          externalConversationId: requiredString(body, 'externalConversationId'),
          externalMessageId: requiredString(body, 'externalMessageId'),
          externalSenderId: requiredString(body, 'externalSenderId'),
          text: requiredString(body, 'text'),
        });
        sendJson(response, 200, result);
        return;
      }

      if (request.method === 'POST' && url.pathname === '/channel/agent/messages') {
        if (!agentCore) {
          sendJson(response, 503, { ok: false, code: 'AGENT_NOT_ENABLED' });
          return;
        }
        const body = record(await readJson(request));
        if (!body) {
          sendJson(response, 400, { ok: false, code: 'AGENT_CHANNEL_MESSAGE_INVALID' });
          return;
        }
        const channel = channelKind(typeof body.channel === 'string' ? body.channel : null);
        if (!channel) {
          sendJson(response, 400, { ok: false, code: 'AGENT_CHANNEL_MESSAGE_INVALID:channel' });
          return;
        }
        const result = await agentCore.handle({
          businessSlug: requiredString(body, 'businessSlug'),
          channel,
          externalConversationId: requiredString(body, 'externalConversationId'),
          externalMessageId: requiredString(body, 'externalMessageId'),
          externalSenderId: requiredString(body, 'externalSenderId'),
          text: requiredString(body, 'text'),
        });
        sendJson(response, 200, result);
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
          const queriedState = await handle.query(getAppointmentStateQuery) as AppointmentStateProjection;
          const description = await handle.describe();
          const state = projectTerminalTemporalFailure(queriedState, description.closeTime);
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
      if (message === 'META_WEBHOOK_UNAUTHENTICATED') {
        sendJson(response, 401, { ok: false, code: message });
        return;
      }
      if (message.startsWith('META_PAGE_ROUTE_NOT_CONFIGURED:')) {
        sendJson(response, 422, { ok: false, code: 'META_PAGE_ROUTE_NOT_CONFIGURED', error: message });
        return;
      }
      if (error instanceof SyntaxError) {
        sendJson(response, 400, { ok: false, code: 'META_PAYLOAD_INVALID', error: message });
        return;
      }
      if (message.startsWith('AGENT_CHANNEL_MESSAGE_INVALID')) {
        sendJson(response, 400, { ok: false, code: 'AGENT_CHANNEL_MESSAGE_INVALID', error: message });
        return;
      }
      if (message.startsWith('Local Agent provider failed:')) {
        sendJson(response, 503, { ok: false, code: 'AGENT_MODEL_UNAVAILABLE', error: message });
        return;
      }
      if (
        message.startsWith('AGENT_ACTION_')
        || message.startsWith('AGENT_ENGINE_EXECUTION_FAILED')
        || message.startsWith('A5_ENGINE_EXECUTION_FAILED')
        || message.startsWith('A5_CUSTOMER_NAME_INVALID')
      ) {
        sendJson(response, 422, { ok: false, code: message.split(':')[0], error: message });
        return;
      }
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

  console.log(`ENGINES_CHANNEL_CORE_READY ${JSON.stringify({ host: HOST, port: PORT, agent: Boolean(agentCore), agentRuntime: Boolean(agentCore), agentExperience: Boolean(a5Experience), mcp: false })}`);

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
