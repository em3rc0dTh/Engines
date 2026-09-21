import { createServer, type IncomingHttpHeaders, type IncomingMessage, type ServerResponse } from 'node:http';
import { setTimeout as delay } from 'node:timers/promises';
import { Pool } from 'pg';
import { loadRuntimeConfig } from '../../config/runtime-config.js';
import type { AppointmentStateProjection } from '../../contracts/register-new-appointment/index.js';
import type { RegistrationStateProjection } from '../../contracts/register-new-customer/index.js';
import { TemporalRegisterNewAppointmentPort } from '../../orchestration/temporal/ports/register-new-appointment.temporal-port.js';
import { TemporalRegisterNewCustomerPort } from '../../orchestration/temporal/ports/register-new-customer.temporal-port.js';
import { getAppointmentStateQuery } from '../../orchestration/temporal/workflows/register-new-appointment.workflow.js';
import { getRegistrationStateQuery } from '../../orchestration/temporal/workflows/register-new-customer.workflow.js';
import { PostgresChannelRepository } from '../../persistence/postgres/channel.repository.js';
import { PostgresCTAIngressRepository } from '../../persistence/postgres/cta-ingress.repository.js';
import { PostgresServicesRepository } from '../../persistence/postgres/services.repository.js';
import { ChannelCoreCTAOrchestrationPort } from '../canonical/channel-orchestration.port.js';
import { toCanonicalCTAEvent } from '../canonical/compatibility.js';
import { CanonicalCTADispatcher } from '../canonical/dispatcher.js';
import { AppointmentChannelExecutionCore } from '../channel-core/appointment-channel-execution.js';
import { CustomerRegistrationChannelExecutionCore } from '../channel-core/customer-registration-channel-execution.js';
import { projectCustomerRegistration } from '../channel-core/customer-registration-view.js';
import type {
  AppointmentRenderIntent,
  CanonicalChannelEnvelope,
  ChannelConversationBinding,
  CustomerRegistrationRenderIntent,
} from '../channel-core/types.js';
import { WhatsAppAdapter } from './whatsapp.adapter.js';
import { OfficialKapsoTransport } from './whatsapp.kapso.js';
import {
  renderWhatsAppAppointment,
  renderWhatsAppRegistration,
  whatsappAppointmentRenderIntent,
} from './whatsapp.renderer.js';
import type { VerifiedWhatsAppInbound } from './whatsapp.transport.js';

const BUSINESS_SLUG = process.env.ENGINES_WHATSAPP_BUSINESS_SLUG?.trim() || 'golden-business';
const HOST = process.env.KAPSO_WEBHOOK_HOST?.trim() || '0.0.0.0';
const PORT = Number(process.env.KAPSO_WEBHOOK_PORT?.trim() || '8791');
const WEBHOOK_PATH = '/webhooks/kapso';
const QUERY_TIMEOUT_MS = 15_000;
const QUERY_POLL_MS = 100;
const MAX_BODY_BYTES = 1_000_000;

type LiveRegistration = Readonly<{
  kind: 'REGISTRATION';
  workflowId: string;
  state: RegistrationStateProjection;
  renderIntent: CustomerRegistrationRenderIntent;
}>;
type LiveAppointment = Readonly<{
  kind: 'APPOINTMENT';
  workflowId: string;
  state: AppointmentStateProjection;
  renderIntent: AppointmentRenderIntent;
}>;
type LiveConversation = LiveRegistration | LiveAppointment;

class WhatsAppWorkflowMissingError extends Error {
  constructor(readonly workflowId: string) {
    super(`WHATSAPP_WORKFLOW_MISSING:${workflowId}`);
    this.name = 'WhatsAppWorkflowMissingError';
  }
}

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

function isTemporalWorkflowNotFound(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const candidate = error as { name?: unknown; message?: unknown };
  const name = typeof candidate.name === 'string' ? candidate.name : '';
  const message = typeof candidate.message === 'string' ? candidate.message : '';
  return name === 'WorkflowNotFoundError'
    || /workflow[^\n]*not found/i.test(message)
    || /not found[^\n]*workflow/i.test(message);
}

function bindingStatusForWorkflow(workflowStatus: string): 'ACTIVE' | 'COMPLETED' | 'FAILED' {
  if (workflowStatus === 'COMPLETED') return 'COMPLETED';
  if (workflowStatus === 'FAILED') return 'FAILED';
  return 'ACTIVE';
}

function isTerminalWorkflowStatus(workflowStatus: string): boolean {
  return workflowStatus === 'COMPLETED' || workflowStatus === 'FAILED';
}

function isAppointmentRequest(event: VerifiedWhatsAppInbound): boolean {
  if (event.kind === 'INTERACTIVE') return event.interactiveId === 'register_appointment';
  const text = event.text?.trim() ?? '';
  return /^\/?(?:appointment|cita)$/i.test(text);
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
        return { kind: 'REGISTRATION', workflowId, state, renderIntent: view.renderIntent };
      }
    } catch (error) {
      if (isTemporalWorkflowNotFound(error)) throw new WhatsAppWorkflowMissingError(workflowId);
    }
    await delay(QUERY_POLL_MS);
  }
  throw new Error(`WHATSAPP_WORKFLOW_QUERY_TIMEOUT:${lastPhase}`);
}

function projectTerminalAppointmentFailure(
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

async function queryAppointment(
  appointmentPort: TemporalRegisterNewAppointmentPort,
  workflowId: string,
): Promise<LiveAppointment> {
  const handle = appointmentPort.client.workflow.getHandle(workflowId);
  const deadline = Date.now() + QUERY_TIMEOUT_MS;
  let lastPhase = 'query-not-ready';
  while (Date.now() < deadline) {
    try {
      const queried = await handle.query(getAppointmentStateQuery) as AppointmentStateProjection;
      const description = await handle.describe();
      const state = projectTerminalAppointmentFailure(queried, description.closeTime);
      lastPhase = state.phase;
      const renderIntent = whatsappAppointmentRenderIntent(state);
      if (renderIntent !== 'WAIT' || state.workflowStatus !== 'RUNNING') {
        return { kind: 'APPOINTMENT', workflowId, state, renderIntent };
      }
    } catch (error) {
      if (isTemporalWorkflowNotFound(error)) throw new WhatsAppWorkflowMissingError(workflowId);
    }
    await delay(QUERY_POLL_MS);
  }
  throw new Error(`WHATSAPP_APPOINTMENT_QUERY_TIMEOUT:${lastPhase}`);
}

async function main(): Promise<void> {
  if (!Number.isInteger(PORT) || PORT < 1 || PORT > 65535) throw new Error('KAPSO_WEBHOOK_PORT_INVALID');

  const webhookSecret = requiredEnv('KAPSO_WEBHOOK_SECRET');
  const apiKey = requiredEnv('KAPSO_API_KEY');
  const phoneNumberId = requiredEnv('KAPSO_PHONE_NUMBER_ID');
  const graphApiVersion = process.env.KAPSO_GRAPH_API_VERSION?.trim() || 'v24.0';

  const config = loadRuntimeConfig();
  const pool = new Pool({ connectionString: config.postgresUrl, max: 6 });
  const repository = new PostgresChannelRepository(pool);
  const ingressRepository = new PostgresCTAIngressRepository(pool);
  const servicesRepository = new PostgresServicesRepository(pool);
  const customerPort = await TemporalRegisterNewCustomerPort.connect();
  const appointmentPort = await TemporalRegisterNewAppointmentPort.connect();
  const registrationCore = new CustomerRegistrationChannelExecutionCore(repository, customerPort);
  const appointmentCore = new AppointmentChannelExecutionCore(repository, appointmentPort, servicesRepository);
  const ctaDispatcher = new CanonicalCTADispatcher(
    ingressRepository,
    new ChannelCoreCTAOrchestrationPort(appointmentCore),
  );
  const adapter = new WhatsAppAdapter();
  const transport = new OfficialKapsoTransport({
    webhookSecret,
    apiKey,
    phoneNumberId,
    expectedPhoneNumberId: phoneNumberId,
    graphApiVersion,
  });

  const destination = (event: VerifiedWhatsAppInbound): string => event.senderPhone ?? event.senderId;
  const externalConversationId = (event: VerifiedWhatsAppInbound): string => `whatsapp:${event.conversationId}`;

  const reconcileAppointmentIngress = async (event: VerifiedWhatsAppInbound, live: LiveAppointment): Promise<void> => {
    const result = live.state.result;
    if (live.state.workflowStatus === 'COMPLETED' && result?.appointmentId && result.caseId) {
      await ingressRepository.completeConversation({
        businessSlug: BUSINESS_SLUG,
        correlationId: externalConversationId(event),
        workflowId: live.workflowId,
        caseId: result.caseId,
        appointmentId: result.appointmentId,
      });
    } else if (live.state.workflowStatus === 'FAILED') {
      await ingressRepository.failConversation({
        businessSlug: BUSINESS_SLUG,
        correlationId: externalConversationId(event),
        workflowId: live.workflowId,
        errorCode: live.state.failure?.code ?? 'APPOINTMENT_WORKFLOW_FAILED',
      });
    }
  };

  const reconcileBinding = async (binding: ChannelConversationBinding, workflowStatus: string): Promise<void> => {
    const status = bindingStatusForWorkflow(workflowStatus);
    if (status === binding.bindingStatus) return;
    await repository.updateBindingStatus({
      businessSlug: binding.businessSlug,
      channel: binding.channel,
      externalConversationId: binding.externalConversationId,
      workflowId: binding.workflowId,
      status,
    });
  };

  const recoverMissingWorkflowBinding = async (binding: ChannelConversationBinding): Promise<void> => {
    await repository.updateBindingStatus({
      businessSlug: binding.businessSlug,
      channel: binding.channel,
      externalConversationId: binding.externalConversationId,
      workflowId: binding.workflowId,
      status: 'FAILED',
    });
    console.warn(`WHATSAPP_STALE_BINDING_RECOVERED ${JSON.stringify({
      externalConversationId: binding.externalConversationId,
      workflowId: binding.workflowId,
      operation: binding.operation,
    })}`);
  };

  const sendCurrent = async (event: VerifiedWhatsAppInbound, live: LiveConversation): Promise<void> => {
    if (live.kind === 'APPOINTMENT') {
      await transport.send(destination(event), renderWhatsAppAppointment(live.state, live.renderIntent));
      return;
    }
    await transport.send(destination(event), renderWhatsAppRegistration(live.renderIntent));
  };

  const getLiveForConversation = async (event: VerifiedWhatsAppInbound): Promise<LiveConversation | undefined> => {
    const binding = await repository.getConversationBinding({
      businessSlug: BUSINESS_SLUG,
      channel: 'WHATSAPP',
      externalConversationId: externalConversationId(event),
    });
    if (!binding) return undefined;

    try {
      if (binding.operation === 'RegisterNewCustomer') {
        const live = await queryRegistration(customerPort, binding.workflowId);
        await reconcileBinding(binding, live.state.workflowStatus);
        return live;
      }
      if (binding.operation === 'RegisterNewAppointment') {
        const live = await queryAppointment(appointmentPort, binding.workflowId);
        await reconcileBinding(binding, live.state.workflowStatus);
        await reconcileAppointmentIngress(event, live);
        return live;
      }
      return undefined;
    } catch (error) {
      if (error instanceof WhatsAppWorkflowMissingError) {
        await recoverMissingWorkflowBinding(binding);
        return undefined;
      }
      throw error;
    }
  };

  const startAppointment = async (
    event: VerifiedWhatsAppInbound,
    envelope: CanonicalChannelEnvelope,
  ): Promise<LiveAppointment | undefined> => {
    const cta = toCanonicalCTAEvent(envelope, new Date().toISOString());
    if (!cta) return undefined;
    const dispatched = await ctaDispatcher.dispatch(cta);
    const workflowId = dispatched.ingress.workflowId;
    if (!workflowId) return undefined;
    const live = await queryAppointment(appointmentPort, workflowId);
    await reconcileAppointmentIngress(event, live);
    return live;
  };

  const processRegistrationInbound = async (
    event: VerifiedWhatsAppInbound,
    live: LiveRegistration,
  ): Promise<void> => {
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

    const applied = await registrationCore.execute(envelope);
    if (!applied.ok) {
      await transport.send(destination(event), { type: 'text', text: 'Ese dato no es válido. Inténtalo nuevamente.' });
      const current = await getLiveForConversation(event);
      await sendCurrent(event, current?.kind === 'REGISTRATION' ? current : live);
      return;
    }

    const current = await getLiveForConversation(event);
    await sendCurrent(event, current?.kind === 'REGISTRATION' ? current : live);
  };

  const processAppointmentInbound = async (
    event: VerifiedWhatsAppInbound,
    live: LiveAppointment,
  ): Promise<void> => {
    if (live.renderIntent === 'APPOINTMENT_COMPLETE' || live.renderIntent === 'APPOINTMENT_FAILED') {
      await sendCurrent(event, live);
      return;
    }

    let envelope;
    try {
      envelope = adapter.normalizeInbound(event, {
        businessSlug: BUSINESS_SLUG,
        appointmentRenderIntent: live.renderIntent,
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

    const applied = await appointmentCore.execute(envelope);
    if (!applied.ok) {
      await transport.send(destination(event), { type: 'text', text: 'Ese dato no es válido para este paso. Inténtalo nuevamente.' });
      const current = await getLiveForConversation(event);
      await sendCurrent(event, current?.kind === 'APPOINTMENT' ? current : live);
      return;
    }

    const current = await getLiveForConversation(event);
    await sendCurrent(event, current?.kind === 'APPOINTMENT' ? current : live);
  };

  const processInbound = async (event: VerifiedWhatsAppInbound): Promise<void> => {
    const appointmentRequested = isAppointmentRequest(event);
    const existing = await getLiveForConversation(event);

    if (existing?.kind === 'REGISTRATION') {
      if (!(appointmentRequested && isTerminalWorkflowStatus(existing.state.workflowStatus))) {
        await processRegistrationInbound(event, existing);
        return;
      }
    }
    if (existing?.kind === 'APPOINTMENT') {
      if (!(appointmentRequested && isTerminalWorkflowStatus(existing.state.workflowStatus))) {
        await processAppointmentInbound(event, existing);
        return;
      }
    }

    if (appointmentRequested) {
      let envelope;
      try {
        envelope = adapter.normalizeInbound(event, { businessSlug: BUSINESS_SLUG });
      } catch {
        await transport.send(destination(event), { type: 'text', text: 'No pudimos interpretar la solicitud de cita. Inténtalo nuevamente.' });
        return;
      }
      if (!envelope || envelope.action !== 'START_APPOINTMENT') {
        await transport.send(destination(event), { type: 'text', text: 'No pudimos iniciar la cita. Inténtalo nuevamente.' });
        return;
      }
      const live = await startAppointment(event, envelope);
      if (!live) {
        await transport.send(destination(event), { type: 'text', text: 'No pudimos iniciar la cita. Inténtalo nuevamente.' });
        return;
      }
      await sendCurrent(event, live);
      return;
    }

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

    const started = await registrationCore.execute(envelope);
    if (!started.ok || !started.workflowId) {
      await transport.send(destination(event), { type: 'text', text: 'No pudimos iniciar tu registro. Inténtalo nuevamente.' });
      return;
    }

    const live = await queryRegistration(customerPort, started.workflowId);
    await sendCurrent(event, live);
  };

  const server = createServer(async (request, response) => {
    const url = new URL(request.url ?? '/', `http://${request.headers.host ?? 'localhost'}`);

    if (request.method === 'GET' && url.pathname === '/health') {
      reply(response, 200, JSON.stringify({
        ok: true,
        provider: 'KAPSO',
        appointmentOperation: 'RegisterNewAppointment',
        registrationOperation: 'RegisterNewCustomer',
        agent: false,
        mcp: false,
      }), 'application/json');
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
      appointmentOperation: 'RegisterNewAppointment',
      registrationOperation: 'RegisterNewCustomer',
      agent: false,
      mcp: false,
    })}`);

    await new Promise<void>((resolve) => server.once('close', resolve));
  } finally {
    await Promise.all([customerPort.close(), appointmentPort.close()]);
    await pool.end();
  }
}

main().catch((error) => {
  console.error(`WHATSAPP_KAPSO_FATAL ${error instanceof Error ? error.message : 'unknown'}`);
  process.exitCode = 1;
});
