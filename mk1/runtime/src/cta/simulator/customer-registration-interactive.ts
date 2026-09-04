import { createHmac, randomUUID } from 'node:crypto';
import { stdin as input, stdout as output } from 'node:process';
import { createInterface } from 'node:readline/promises';
import { setTimeout as delay } from 'node:timers/promises';
import { Pool } from 'pg';
import { loadRuntimeConfig } from '../../config/runtime-config.js';
import type { RegistrationStateProjection } from '../../contracts/register-new-customer/index.js';
import { getRegistrationStateQuery } from '../../orchestration/temporal/workflows/register-new-customer.workflow.js';
import { TemporalRegisterNewCustomerPort } from '../../orchestration/temporal/ports/register-new-customer.temporal-port.js';
import { PostgresChannelRepository } from '../../persistence/postgres/channel.repository.js';
import { CustomerRegistrationChannelExecutionCore } from '../channel-core/customer-registration-channel-execution.js';
import { projectCustomerRegistration } from '../channel-core/customer-registration-view.js';
import type {
  CanonicalChannelEnvelope,
  ChannelKind,
  CustomerRegistrationRenderIntent,
} from '../channel-core/types.js';
import { TelegramAdapter } from '../telegram/telegram.adapter.js';
import { renderTelegramRegistration } from '../telegram/telegram.renderer.js';
import { WhatsAppAdapter } from '../whatsapp/whatsapp.adapter.js';
import { renderWhatsAppRegistration } from '../whatsapp/whatsapp.renderer.js';
import { MetaCloudApiTransport, type VerifiedWhatsAppInbound } from '../whatsapp/whatsapp.transport.js';

const BUSINESS_SLUG = process.env.ENGINES_MESSAGING_LAB_BUSINESS_SLUG?.trim() || 'golden-business';
const STATE_TIMEOUT_MS = 15_000;
const STATE_POLL_MS = 100;

type LabChannel = Extract<ChannelKind, 'TELEGRAM' | 'WHATSAPP'>;
type RegistrationProjection = ReturnType<typeof projectCustomerRegistration>;

type LiveRegistration = Readonly<{
  state: RegistrationStateProjection;
  view: RegistrationProjection;
  runId: string;
}>;

function scriptedChannel(): LabChannel | undefined {
  const raw = process.env.ENGINES_MESSAGING_LAB_SCRIPT?.trim().toUpperCase();
  if (!raw) return undefined;
  if (raw === 'TELEGRAM' || raw === 'WHATSAPP') return raw;
  throw new Error(`LOCAL_E2E_SCRIPT_CHANNEL_INVALID:${raw}`);
}

function randomDigits(count: number): string {
  let value = '';
  for (let index = 0; index < count; index += 1) value += Math.floor(Math.random() * 10).toString();
  return value;
}

function textFromWhatsAppRender(value: Readonly<Record<string, unknown>>): string {
  if (typeof value.text === 'string') return value.text;
  if (typeof value.body === 'string') return value.body;
  return JSON.stringify(value);
}

function renderText(channel: LabChannel, intent: 'CONSENT' | CustomerRegistrationRenderIntent): string {
  if (channel === 'TELEGRAM') return renderTelegramRegistration(intent).text;
  return textFromWhatsAppRender(renderWhatsAppRegistration(intent));
}

function printState(live: LiveRegistration): void {
  console.log('');
  console.log(`Temporal: ${live.state.workflowStatus} / ${live.state.phase} / next=${live.state.nextAction}`);
  console.log(`knownFields   = ${live.view.knownFields.length > 0 ? live.view.knownFields.join(', ') : '(none)'}`);
  console.log(`missingFields = ${live.view.missingFields.length > 0 ? live.view.missingFields.join(', ') : '(none)'}`);
}

async function queryUntilActionable(
  customerPort: TemporalRegisterNewCustomerPort,
  workflowId: string,
): Promise<LiveRegistration> {
  const handle = customerPort.getClient().workflow.getHandle(workflowId);
  const deadline = Date.now() + STATE_TIMEOUT_MS;
  let lastState: RegistrationStateProjection | undefined;

  while (Date.now() < deadline) {
    try {
      const state = await handle.query(getRegistrationStateQuery) as RegistrationStateProjection;
      lastState = state;
      const view = projectCustomerRegistration(state);
      const description = await handle.describe();

      if (state.nextAction === 'RESOLVE_DUPLICATE') {
        throw new Error('LOCAL_E2E_DUPLICATE_REQUIRES_UNIQUE_INPUT');
      }
      if (view.renderIntent !== 'WAIT' || state.workflowStatus !== 'RUNNING') {
        return { state, view, runId: description.runId };
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message === 'LOCAL_E2E_DUPLICATE_REQUIRES_UNIQUE_INPUT') throw error;
    }
    await delay(STATE_POLL_MS);
  }

  throw new Error(`LOCAL_E2E_STATE_TIMEOUT:${lastState?.phase ?? 'query-not-ready'}`);
}

function assertEnvelope(
  envelope: CanonicalChannelEnvelope | undefined,
  label: string,
): CanonicalChannelEnvelope {
  if (!envelope) throw new Error(`LOCAL_E2E_EXPECTED_OPERATION:${label}`);
  return envelope;
}

async function run(): Promise<void> {
  const script = scriptedChannel();
  const rl = script ? undefined : createInterface({ input, output });
  const ask = async (prompt: string, scriptedValue: string): Promise<string> => {
    if (script) {
      console.log(`${prompt}${scriptedValue}`);
      return scriptedValue;
    }
    if (!rl) throw new Error('LOCAL_E2E_READLINE_NOT_AVAILABLE');
    return rl.question(prompt);
  };

  const config = loadRuntimeConfig();
  const pool = new Pool({ connectionString: config.postgresUrl, max: 4 });
  const repository = new PostgresChannelRepository(pool);
  const customerPort = await TemporalRegisterNewCustomerPort.connect();
  const core = new CustomerRegistrationChannelExecutionCore(repository, customerPort);

  const session = randomUUID().replaceAll('-', '').slice(0, 16);
  const telegramChatId = Number.parseInt(randomDigits(9), 10);
  const telegramUserId = Number.parseInt(randomDigits(9), 10);
  const sharedTelegramPhone = `+519${randomDigits(8)}`;
  const whatsappPhone = `+519${randomDigits(8)}`;
  const whatsappSenderId = whatsappPhone.replace(/\D/g, '');
  const whatsappSecret = `local-${session}`;
  const whatsappTransport = new MetaCloudApiTransport(whatsappSecret, async () => undefined);
  const telegramAdapter = new TelegramAdapter();
  const whatsappAdapter = new WhatsAppAdapter();
  let eventSequence = Number.parseInt(randomDigits(8), 10);

  const nextTelegramUpdateId = (): number => {
    eventSequence += 1;
    return eventSequence;
  };
  const nextWhatsAppMessageId = (): string => {
    eventSequence += 1;
    return `local-${session}-${eventSequence}`;
  };

  const telegramCallback = (data: string): unknown => ({
    update_id: nextTelegramUpdateId(),
    callback_query: {
      data,
      from: { id: telegramUserId },
      message: { chat: { id: telegramChatId } },
    },
  });
  const telegramText = (text: string): unknown => ({
    update_id: nextTelegramUpdateId(),
    message: { text, chat: { id: telegramChatId }, from: { id: telegramUserId } },
  });
  const telegramContact = (phone: string): unknown => ({
    update_id: nextTelegramUpdateId(),
    message: {
      contact: { phone_number: phone },
      chat: { id: telegramChatId },
      from: { id: telegramUserId },
    },
  });

  const verifiedWhatsApp = (
    kind: 'TEXT' | 'INTERACTIVE',
    material: Readonly<{ text?: string; interactiveId?: string }> = {},
  ): VerifiedWhatsAppInbound => {
    const body = JSON.stringify({
      conversationId: `local-${session}`,
      messageId: nextWhatsAppMessageId(),
      senderId: whatsappSenderId,
      senderPhone: whatsappPhone,
      kind,
      ...material,
    });
    const signature = `sha256=${createHmac('sha256', whatsappSecret).update(body).digest('hex')}`;
    return whatsappTransport.verifyAndNormalize(body, { 'x-hub-signature-256': signature });
  };

  try {
    console.log('ENGINES · LOCAL MESSAGING CUSTOMER REGISTRATION');
    console.log('Real PostgreSQL + Temporal + RegisterNewCustomer. No provider credentials.');
    console.log(script ? `Scripted proof mode: ${script}` : 'Human interactive mode.');
    console.log('');
    console.log('Choose channel:');
    console.log('1 Telegram');
    console.log('2 WhatsApp');
    const channelChoice = (await ask('> ', script === 'TELEGRAM' ? '1' : script === 'WHATSAPP' ? '2' : '')).trim();
    const channel: LabChannel = channelChoice === '1' ? 'TELEGRAM' : channelChoice === '2' ? 'WHATSAPP' : (() => {
      throw new Error('LOCAL_E2E_CHANNEL_INVALID');
    })();

    console.log('');
    console.log(renderText(channel, 'CONSENT'));
    console.log('1 Sí, registrarme');
    console.log('2 Ahora no');
    const consent = (await ask('> ', script ? '1' : '')).trim();

    if (consent === '2') {
      const ignored = channel === 'TELEGRAM'
        ? telegramAdapter.normalizeInbound(telegramCallback('register_customer_no'), { businessSlug: BUSINESS_SLUG })
        : whatsappAdapter.normalizeInbound(
          verifiedWhatsApp('INTERACTIVE', { interactiveId: 'register_customer_no' }),
          { businessSlug: BUSINESS_SLUG },
        );
      if (ignored !== undefined) throw new Error('LOCAL_E2E_NEGATIVE_CONSENT_CREATED_OPERATION');
      console.log('No Workflow was started. No Customer was created.');
      console.log(`MESSAGING_LOCAL_E2E_NO_CONSENT_PASS ${JSON.stringify({ channel, agent: false, mcp: false })}`);
      return;
    }
    if (consent !== '1') throw new Error('LOCAL_E2E_CONSENT_INVALID');

    const startEnvelope = channel === 'TELEGRAM'
      ? assertEnvelope(
        telegramAdapter.normalizeInbound(telegramCallback('register_customer_yes'), { businessSlug: BUSINESS_SLUG }),
        'telegram-consent',
      )
      : assertEnvelope(
        whatsappAdapter.normalizeInbound(
          verifiedWhatsApp('INTERACTIVE', { interactiveId: 'register_customer_yes' }),
          { businessSlug: BUSINESS_SLUG },
        ),
        'whatsapp-consent',
      );

    if (channel === 'WHATSAPP') {
      console.log(`Local verified WhatsApp sender phone: ${whatsappPhone}`);
      console.log('That phone is supplied to Temporal at Workflow start; it must not be requested again.');
    }

    const started = await core.execute(startEnvelope);
    if (!started.ok || !started.workflowId) {
      throw new Error(`LOCAL_E2E_START_FAILED:${started.code ?? 'unknown'}`);
    }
    const workflowId = started.workflowId;
    console.log(`Workflow started: ${workflowId}`);

    while (true) {
      const live = await queryUntilActionable(customerPort, workflowId);
      printState(live);

      if (live.view.renderIntent === 'REGISTRATION_COMPLETE') {
        console.log('');
        console.log(renderText(channel, live.view.renderIntent));
        console.log(`Workflow ID: ${workflowId}`);
        console.log(`Run ID: ${live.runId}`);
        console.log(`Customer ID: ${live.state.customerId ?? '(missing)'}`);
        if (!live.state.customerId) throw new Error('LOCAL_E2E_CUSTOMER_ID_MISSING');
        console.log(`MESSAGING_LOCAL_E2E_PASS ${JSON.stringify({
          channel,
          workflowId,
          runId: live.runId,
          customerId: live.state.customerId,
          phonePrefilled: channel === 'WHATSAPP',
          scripted: Boolean(script),
          agent: false,
          mcp: false,
        })}`);
        return;
      }

      if (live.view.renderIntent === 'REGISTRATION_FAILED') {
        throw new Error(`LOCAL_E2E_WORKFLOW_FAILED:${live.state.failure?.code ?? 'unknown'}`);
      }
      if (live.view.renderIntent === 'FINALIZE_REGISTRATION') {
        throw new Error('LOCAL_E2E_UNEXPECTED_EXPLICIT_FINALIZE');
      }

      const intent = live.view.renderIntent;
      if (channel === 'WHATSAPP' && intent === 'ASK_CUSTOMER_PHONE') {
        throw new Error('LOCAL_E2E_WHATSAPP_PHONE_REPROMPT');
      }

      console.log('');
      console.log(renderText(channel, intent));

      let envelope: CanonicalChannelEnvelope;
      if (channel === 'TELEGRAM' && intent === 'ASK_CUSTOMER_PHONE') {
        console.log(`1 Compartir teléfono simulado (${sharedTelegramPhone})`);
        console.log('2 Escribir teléfono');
        const phoneChoice = (await ask('> ', script ? '1' : '')).trim();
        if (phoneChoice === '1') {
          envelope = assertEnvelope(
            telegramAdapter.normalizeInbound(telegramContact(sharedTelegramPhone), {
              businessSlug: BUSINESS_SLUG,
              registrationRenderIntent: intent,
            }),
            'telegram-contact',
          );
        } else if (phoneChoice === '2') {
          const value = await ask('Teléfono: ', script ? sharedTelegramPhone : '');
          envelope = assertEnvelope(
            telegramAdapter.normalizeInbound(telegramText(value), {
              businessSlug: BUSINESS_SLUG,
              registrationRenderIntent: intent,
            }),
            'telegram-phone-text',
          );
        } else {
          console.log('Opción inválida.');
          continue;
        }
      } else {
        const scriptedValue = intent === 'ASK_CUSTOMER_NAME'
          ? `CI ${channel}`
          : intent === 'ASK_CUSTOMER_EMAIL'
            ? `ci.${channel.toLowerCase()}.${session}@example.com`
            : '';
        const value = await ask('> ', script ? scriptedValue : '');
        envelope = channel === 'TELEGRAM'
          ? assertEnvelope(
            telegramAdapter.normalizeInbound(telegramText(value), {
              businessSlug: BUSINESS_SLUG,
              registrationRenderIntent: intent,
            }),
            'telegram-text',
          )
          : assertEnvelope(
            whatsappAdapter.normalizeInbound(
              verifiedWhatsApp('TEXT', { text: value }),
              { businessSlug: BUSINESS_SLUG, registrationRenderIntent: intent },
            ),
            'whatsapp-text',
          );
      }

      const applied = await core.execute(envelope);
      if (!applied.ok) {
        console.log(`ERROR: ${applied.code ?? 'CHANNEL_EVENT_REJECTED'}`);
        console.log('The same Temporal Workflow remains active; enter a new value.');
        if (script) throw new Error(`LOCAL_E2E_SCRIPT_EVENT_REJECTED:${applied.code ?? 'unknown'}`);
      }
    }
  } finally {
    rl?.close();
    await Promise.allSettled([customerPort.close(), pool.end()]);
  }
}

run().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`MESSAGING_LOCAL_E2E_FAIL ${JSON.stringify({ error: message, agent: false, mcp: false })}`);
  process.exitCode = 1;
});
