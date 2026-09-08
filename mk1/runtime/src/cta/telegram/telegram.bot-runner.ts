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
import { TelegramAdapter } from './telegram.adapter.js';
import { TelegramBotApiClient, type TelegramUpdate } from './telegram.bot-api.js';
import {
  TelegramWorkflowMissingError,
  channelBindingStatusForWorkflow,
  isTemporalWorkflowNotFound,
  isTerminalWorkflowStatus,
} from './telegram.lifecycle.js';
import {
  renderTelegramAppointment,
  renderTelegramRegistration,
  telegramAppointmentRenderIntent,
} from './telegram.renderer.js';

const BUSINESS_SLUG = process.env.ENGINES_TELEGRAM_BUSINESS_SLUG?.trim() || 'golden-business';
const QUERY_TIMEOUT_MS = 15_000;
const QUERY_POLL_MS = 100;

type JsonRecord = Record<string, unknown>;
type UpdateMeta = Readonly<{
  updateId: number;
  chatId: string;
  chatType?: string;
  callbackQueryId?: string;
  callbackData?: string;
  text?: string;
}>;
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

function record(value: unknown): JsonRecord | undefined {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as JsonRecord : undefined;
}

function stringId(value: unknown): string | undefined {
  return typeof value === 'string' || typeof value === 'number' ? String(value) : undefined;
}

function updateMeta(update: TelegramUpdate): UpdateMeta {
  const callback = record(update.callback_query);
  const message = record(update.message) ?? record(callback?.message);
  const chat = record(message?.chat);
  const chatId = stringId(chat?.id);
  if (typeof update.update_id !== 'number' || !chatId) throw new Error('TELEGRAM_UPDATE_ROUTING_INVALID');
  const text = typeof message?.text === 'string' ? message.text.trim() : undefined;
  const callbackData = typeof callback?.data === 'string' ? callback.data.trim() : undefined;
  return {
    updateId: update.update_id,
    chatId,
    ...(typeof chat?.type === 'string' ? { chatType: chat.type } : {}),
    ...(stringId(callback?.id) ? { callbackQueryId: stringId(callback?.id)! } : {}),
    ...(callbackData ? { callbackData } : {}),
    ...(text ? { text } : {}),
  };
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
      if (isTemporalWorkflowNotFound(error)) throw new TelegramWorkflowMissingError(workflowId);
      // The Workflow may need a short interval before the first Query is available.
    }
    await delay(QUERY_POLL_MS);
  }
  throw new Error(`TELEGRAM_WORKFLOW_QUERY_TIMEOUT:${lastPhase}`);
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
      const renderIntent = telegramAppointmentRenderIntent(state);
      if (renderIntent !== 'WAIT' || state.workflowStatus !== 'RUNNING') {
        return { kind: 'APPOINTMENT', workflowId, state, renderIntent };
      }
    } catch (error) {
      if (isTemporalWorkflowNotFound(error)) throw new TelegramWorkflowMissingError(workflowId);
      // The Workflow may need a short interval before the first Query is available.
    }
    await delay(QUERY_POLL_MS);
  }
  throw new Error(`TELEGRAM_APPOINTMENT_QUERY_TIMEOUT:${lastPhase}`);
}

function isStartCommand(text: string | undefined): boolean {
  return Boolean(text && /^\/start(?:@\w+)?(?:\s|$)/i.test(text));
}

function isAppointmentCommand(text: string | undefined): boolean {
  return Boolean(text && /^\/(?:appointment|cita)(?:@\w+)?(?:\s|$)/i.test(text));
}

async function main(): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  if (!token) throw new Error('TELEGRAM_BOT_TOKEN_REQUIRED');

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
  const adapter = new TelegramAdapter();
  const api = new TelegramBotApiClient(token);

  let stopping = false;
  const stop = (): void => { stopping = true; };
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);

  const reconcileAppointmentIngress = async (
    externalConversationId: string,
    live: LiveAppointment,
  ): Promise<void> => {
    const result = live.state.result;
    if (live.state.workflowStatus === 'COMPLETED' && result?.appointmentId && result.caseId) {
      await ingressRepository.completeConversation({
        businessSlug: BUSINESS_SLUG,
        correlationId: externalConversationId,
        workflowId: live.workflowId,
        caseId: result.caseId,
        appointmentId: result.appointmentId,
      });
    } else if (live.state.workflowStatus === 'FAILED') {
      await ingressRepository.failConversation({
        businessSlug: BUSINESS_SLUG,
        correlationId: externalConversationId,
        workflowId: live.workflowId,
        errorCode: live.state.failure?.code ?? 'APPOINTMENT_WORKFLOW_FAILED',
      });
    }
  };

  const reconcileBinding = async (
    binding: ChannelConversationBinding,
    workflowStatus: string,
  ): Promise<void> => {
    const status = channelBindingStatusForWorkflow(workflowStatus);
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
    console.warn(`TELEGRAM_STALE_BINDING_RECOVERED ${JSON.stringify({
      externalConversationId: binding.externalConversationId,
      workflowId: binding.workflowId,
      operation: binding.operation,
    })}`);
  };

  const sendCurrent = async (chatId: string, live: LiveConversation): Promise<void> => {
    if (live.kind === 'APPOINTMENT') {
      await api.sendMessage(chatId, renderTelegramAppointment(live.state, live.renderIntent));
      return;
    }
    await api.sendMessage(chatId, renderTelegramRegistration(live.renderIntent));
  };

  const getLiveForConversation = async (chatId: string): Promise<LiveConversation | undefined> => {
    const externalConversationId = `telegram:${chatId}`;
    const binding = await repository.getConversationBinding({
      businessSlug: BUSINESS_SLUG,
      channel: 'TELEGRAM',
      externalConversationId,
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
        await reconcileAppointmentIngress(externalConversationId, live);
        return live;
      }
      return undefined;
    } catch (error) {
      if (error instanceof TelegramWorkflowMissingError) {
        await recoverMissingWorkflowBinding(binding);
        return undefined;
      }
      throw error;
    }
  };

  const startAppointment = async (envelope: CanonicalChannelEnvelope): Promise<LiveAppointment | undefined> => {
    const cta = toCanonicalCTAEvent(envelope, new Date().toISOString());
    if (!cta) return undefined;
    const dispatched = await ctaDispatcher.dispatch(cta);
    const workflowId = dispatched.ingress.workflowId;
    if (!workflowId) return undefined;
    const live = await queryAppointment(appointmentPort, workflowId);
    await reconcileAppointmentIngress(envelope.externalConversationId, live);
    return live;
  };

  const processRegistrationUpdate = async (
    update: TelegramUpdate,
    meta: UpdateMeta,
    live: LiveRegistration,
  ): Promise<void> => {
    if (isStartCommand(meta.text) || live.renderIntent === 'REGISTRATION_COMPLETE' || live.renderIntent === 'REGISTRATION_FAILED') {
      await sendCurrent(meta.chatId, live);
      return;
    }

    let envelope;
    try {
      envelope = adapter.normalizeInbound(update, {
        businessSlug: BUSINESS_SLUG,
        registrationRenderIntent: live.renderIntent,
      });
    } catch {
      await api.sendMessage(meta.chatId, { text: 'No pude interpretar esa respuesta. Usa la opción solicitada o escribe el dato nuevamente.' });
      await sendCurrent(meta.chatId, live);
      return;
    }

    if (!envelope) {
      await sendCurrent(meta.chatId, live);
      return;
    }

    const applied = await registrationCore.execute(envelope);
    if (!applied.ok) {
      await api.sendMessage(meta.chatId, { text: 'Ese dato no es válido. Inténtalo nuevamente.' });
      const current = await getLiveForConversation(meta.chatId);
      await sendCurrent(meta.chatId, current?.kind === 'REGISTRATION' ? current : live);
      return;
    }

    const current = await getLiveForConversation(meta.chatId);
    await sendCurrent(meta.chatId, current?.kind === 'REGISTRATION' ? current : live);
  };

  const processAppointmentUpdate = async (
    update: TelegramUpdate,
    meta: UpdateMeta,
    live: LiveAppointment,
  ): Promise<void> => {
    if (isStartCommand(meta.text)
      || isAppointmentCommand(meta.text)
      || live.renderIntent === 'APPOINTMENT_COMPLETE'
      || live.renderIntent === 'APPOINTMENT_FAILED') {
      await sendCurrent(meta.chatId, live);
      return;
    }

    let envelope;
    try {
      envelope = adapter.normalizeInbound(update, {
        businessSlug: BUSINESS_SLUG,
        appointmentRenderIntent: live.renderIntent,
      });
    } catch {
      await api.sendMessage(meta.chatId, { text: 'No pude interpretar esa respuesta. Usa la opción solicitada o escribe el dato nuevamente.' });
      await sendCurrent(meta.chatId, live);
      return;
    }

    if (!envelope) {
      await sendCurrent(meta.chatId, live);
      return;
    }

    const applied = await appointmentCore.execute(envelope);
    if (!applied.ok) {
      await api.sendMessage(meta.chatId, { text: 'Ese dato no es válido para este paso. Inténtalo nuevamente.' });
      const current = await getLiveForConversation(meta.chatId);
      await sendCurrent(meta.chatId, current?.kind === 'APPOINTMENT' ? current : live);
      return;
    }

    const current = await getLiveForConversation(meta.chatId);
    await sendCurrent(meta.chatId, current?.kind === 'APPOINTMENT' ? current : live);
  };

  const processUpdate = async (update: TelegramUpdate): Promise<void> => {
    const meta = updateMeta(update);

    if (meta.callbackQueryId) {
      try { await api.answerCallbackQuery(meta.callbackQueryId); } catch (error) {
        console.warn(`TELEGRAM_CALLBACK_ACK_WARNING ${error instanceof Error ? error.message : 'unknown'}`);
      }
    }

    if (meta.chatType && meta.chatType !== 'private') {
      await api.sendMessage(meta.chatId, { text: 'Para continuar, abre una conversación privada con este bot.' });
      return;
    }

    const appointmentRequested = isAppointmentCommand(meta.text) || meta.callbackData === 'register_appointment';
    const existing = await getLiveForConversation(meta.chatId);
    if (existing?.kind === 'REGISTRATION') {
      if (!(appointmentRequested && isTerminalWorkflowStatus(existing.state.workflowStatus))) {
        await processRegistrationUpdate(update, meta, existing);
        return;
      }
    }
    if (existing?.kind === 'APPOINTMENT') {
      if (!(appointmentRequested && isTerminalWorkflowStatus(existing.state.workflowStatus))) {
        await processAppointmentUpdate(update, meta, existing);
        return;
      }
    }

    if (appointmentRequested) {
      let envelope;
      try {
        envelope = adapter.normalizeInbound(update, { businessSlug: BUSINESS_SLUG });
      } catch {
        await api.sendMessage(meta.chatId, { text: 'No pudimos interpretar la solicitud de cita. Inténtalo nuevamente.' });
        return;
      }
      if (!envelope || envelope.action !== 'START_APPOINTMENT') {
        await api.sendMessage(meta.chatId, { text: 'No pudimos iniciar la cita. Inténtalo nuevamente.' });
        return;
      }
      const live = await startAppointment(envelope);
      if (!live) {
        await api.sendMessage(meta.chatId, { text: 'No pudimos iniciar la cita. Inténtalo nuevamente.' });
        return;
      }
      await sendCurrent(meta.chatId, live);
      return;
    }

    if (!record(update.callback_query)) {
      await api.sendMessage(meta.chatId, renderTelegramRegistration('CONSENT'));
      return;
    }

    let envelope;
    try {
      envelope = adapter.normalizeInbound(update, { businessSlug: BUSINESS_SLUG });
    } catch {
      await api.sendMessage(meta.chatId, renderTelegramRegistration('CONSENT'));
      return;
    }

    if (!envelope) {
      await api.sendMessage(meta.chatId, { text: 'Entendido. No se inició ningún registro.' });
      return;
    }

    const started = await registrationCore.execute(envelope);
    if (!started.ok || !started.workflowId) {
      await api.sendMessage(meta.chatId, { text: 'No pudimos iniciar tu registro. Inténtalo nuevamente.' });
      return;
    }
    const live = await queryRegistration(customerPort, started.workflowId);
    await sendCurrent(meta.chatId, live);
  };

  try {
    const bot = await api.getMe();
    const webhook = await api.getWebhookInfo();
    if (webhook.url) {
      throw new Error('TELEGRAM_WEBHOOK_ACTIVE:remove the webhook before starting getUpdates long polling');
    }

    console.log(`TELEGRAM_BOT_API_READY ${JSON.stringify({
      botId: bot.id,
      username: bot.username ?? null,
      businessSlug: BUSINESS_SLUG,
      mode: 'getUpdates',
      appointmentOperation: 'RegisterNewAppointment',
      registrationOperation: 'RegisterNewCustomer',
      agent: false,
      mcp: false,
    })}`);

    let offset: number | undefined;
    while (!stopping) {
      try {
        const updates = await api.getUpdates({ ...(offset !== undefined ? { offset } : {}), timeoutSeconds: 25 });
        for (const update of updates) {
          if (stopping) break;
          const meta = updateMeta(update);
          try {
            await processUpdate(update);
            offset = meta.updateId + 1;
          } catch (error) {
            console.error(`TELEGRAM_UPDATE_RETRY ${JSON.stringify({
              updateId: meta.updateId,
              error: error instanceof Error ? error.message : 'unknown',
            })}`);
            break;
          }
        }
      } catch (error) {
        if (stopping) break;
        console.error(`TELEGRAM_LONG_POLL_RETRY ${error instanceof Error ? error.message : 'unknown'}`);
        await delay(1_000);
      }
    }
  } finally {
    await Promise.all([customerPort.close(), appointmentPort.close()]);
    await pool.end();
  }
}

main().catch((error) => {
  console.error(`TELEGRAM_BOT_FATAL ${error instanceof Error ? error.message : 'unknown'}`);
  process.exitCode = 1;
});
