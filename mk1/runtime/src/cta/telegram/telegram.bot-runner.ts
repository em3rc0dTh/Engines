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
import { TelegramAdapter } from './telegram.adapter.js';
import { TelegramBotApiClient, type TelegramUpdate } from './telegram.bot-api.js';
import { renderTelegramRegistration } from './telegram.renderer.js';

const BUSINESS_SLUG = process.env.ENGINES_TELEGRAM_BUSINESS_SLUG?.trim() || 'golden-business';
const QUERY_TIMEOUT_MS = 15_000;
const QUERY_POLL_MS = 100;

type JsonRecord = Record<string, unknown>;
type UpdateMeta = Readonly<{
  updateId: number;
  chatId: string;
  chatType?: string;
  callbackQueryId?: string;
  text?: string;
}>;
type LiveRegistration = Readonly<{
  workflowId: string;
  state: RegistrationStateProjection;
  renderIntent: CustomerRegistrationRenderIntent;
}>;

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
  return {
    updateId: update.update_id,
    chatId,
    ...(typeof chat?.type === 'string' ? { chatType: chat.type } : {}),
    ...(stringId(callback?.id) ? { callbackQueryId: stringId(callback?.id)! } : {}),
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
        return { workflowId, state, renderIntent: view.renderIntent };
      }
    } catch {
      // The Workflow may need a short interval before the first Query is available.
    }
    await delay(QUERY_POLL_MS);
  }
  throw new Error(`TELEGRAM_WORKFLOW_QUERY_TIMEOUT:${lastPhase}`);
}

function isStartCommand(text: string | undefined): boolean {
  return Boolean(text && /^\/start(?:@\w+)?(?:\s|$)/i.test(text));
}

async function main(): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  if (!token) throw new Error('TELEGRAM_BOT_TOKEN_REQUIRED');

  const config = loadRuntimeConfig();
  const pool = new Pool({ connectionString: config.postgresUrl, max: 4 });
  const repository = new PostgresChannelRepository(pool);
  const customerPort = await TemporalRegisterNewCustomerPort.connect();
  const core = new CustomerRegistrationChannelExecutionCore(repository, customerPort);
  const adapter = new TelegramAdapter();
  const api = new TelegramBotApiClient(token);

  let stopping = false;
  const stop = (): void => { stopping = true; };
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);

  const sendCurrent = async (chatId: string, live: LiveRegistration): Promise<void> => {
    await api.sendMessage(chatId, renderTelegramRegistration(live.renderIntent));
  };

  const getLiveForConversation = async (chatId: string): Promise<LiveRegistration | undefined> => {
    const binding = await repository.getConversationBinding({
      businessSlug: BUSINESS_SLUG,
      channel: 'TELEGRAM',
      externalConversationId: `telegram:${chatId}`,
    });
    if (!binding || binding.operation !== 'RegisterNewCustomer') return undefined;
    return queryRegistration(customerPort, binding.workflowId);
  };

  const processUpdate = async (update: TelegramUpdate): Promise<void> => {
    const meta = updateMeta(update);

    if (meta.callbackQueryId) {
      try { await api.answerCallbackQuery(meta.callbackQueryId); } catch (error) {
        console.warn(`TELEGRAM_CALLBACK_ACK_WARNING ${error instanceof Error ? error.message : 'unknown'}`);
      }
    }

    if (meta.chatType && meta.chatType !== 'private') {
      await api.sendMessage(meta.chatId, { text: 'Para registrarte, abre una conversación privada con este bot.' });
      return;
    }

    let live = await getLiveForConversation(meta.chatId);
    if (!live) {
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

      const started = await core.execute(envelope);
      if (!started.ok || !started.workflowId) {
        await api.sendMessage(meta.chatId, { text: 'No pudimos iniciar tu registro. Inténtalo nuevamente.' });
        return;
      }
      live = await queryRegistration(customerPort, started.workflowId);
      await sendCurrent(meta.chatId, live);
      return;
    }

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

    const applied = await core.execute(envelope);
    if (!applied.ok) {
      await api.sendMessage(meta.chatId, { text: 'Ese dato no es válido. Inténtalo nuevamente.' });
      live = await getLiveForConversation(meta.chatId) ?? live;
      await sendCurrent(meta.chatId, live);
      return;
    }

    live = await getLiveForConversation(meta.chatId) ?? live;
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
    await customerPort.close();
    await pool.end();
  }
}

main().catch((error) => {
  console.error(`TELEGRAM_BOT_FATAL ${error instanceof Error ? error.message : 'unknown'}`);
  process.exitCode = 1;
});
