import type { TelegramRender } from './telegram.renderer.js';

export type TelegramUpdate = Readonly<Record<string, unknown>>;
export type TelegramBotIdentity = Readonly<{
  id: number;
  is_bot: boolean;
  first_name: string;
  username?: string;
}>;
export type TelegramWebhookInfo = Readonly<{
  url: string;
  pending_update_count?: number;
}>;

type JsonRecord = Record<string, unknown>;

function record(value: unknown): JsonRecord | undefined {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as JsonRecord : undefined;
}

function apiError(method: string, payload: JsonRecord | undefined): Error {
  const code = typeof payload?.error_code === 'number' ? payload.error_code : 'UNKNOWN';
  const description = typeof payload?.description === 'string' ? payload.description : 'Telegram Bot API rejected the request';
  return new Error(`TELEGRAM_BOT_API_ERROR:${method}:${code}:${description}`);
}

export class TelegramBotApiClient {
  private readonly baseUrl: string;

  constructor(
    private readonly token: string,
    private readonly fetchFn: typeof fetch = fetch,
    baseUrl = 'https://api.telegram.org',
  ) {
    if (!token.trim()) throw new Error('TELEGRAM_BOT_TOKEN_REQUIRED');
    this.baseUrl = baseUrl.replace(/\/$/, '');
  }

  async getMe(): Promise<TelegramBotIdentity> {
    const result = record(await this.call('getMe', {}));
    if (!result || typeof result.id !== 'number' || result.is_bot !== true || typeof result.first_name !== 'string') {
      throw new Error('TELEGRAM_BOT_API_INVALID:getMe');
    }
    return {
      id: result.id,
      is_bot: true,
      first_name: result.first_name,
      ...(typeof result.username === 'string' ? { username: result.username } : {}),
    };
  }

  async getWebhookInfo(): Promise<TelegramWebhookInfo> {
    const result = record(await this.call('getWebhookInfo', {}));
    if (!result || typeof result.url !== 'string') throw new Error('TELEGRAM_BOT_API_INVALID:getWebhookInfo');
    return {
      url: result.url,
      ...(typeof result.pending_update_count === 'number' ? { pending_update_count: result.pending_update_count } : {}),
    };
  }

  async getUpdates(params: Readonly<{ offset?: number; timeoutSeconds?: number }> = {}): Promise<readonly TelegramUpdate[]> {
    const timeout = params.timeoutSeconds ?? 25;
    const result = await this.call('getUpdates', {
      ...(params.offset !== undefined ? { offset: params.offset } : {}),
      timeout,
      allowed_updates: ['message', 'callback_query'],
    }, AbortSignal.timeout((timeout + 10) * 1000));
    if (!Array.isArray(result)) throw new Error('TELEGRAM_BOT_API_INVALID:getUpdates');
    return result.map((value) => {
      const update = record(value);
      if (!update || typeof update.update_id !== 'number') throw new Error('TELEGRAM_BOT_API_INVALID:update');
      return update;
    });
  }

  async sendMessage(chatId: string, render: TelegramRender): Promise<void> {
    await this.call('sendMessage', {
      chat_id: chatId,
      text: render.text,
      ...(render.replyMarkup ? { reply_markup: render.replyMarkup } : {}),
    });
  }

  async answerCallbackQuery(callbackQueryId: string, text?: string): Promise<void> {
    await this.call('answerCallbackQuery', {
      callback_query_id: callbackQueryId,
      ...(text ? { text } : {}),
    });
  }

  private async call(method: string, payload: JsonRecord, signal?: AbortSignal): Promise<unknown> {
    const response = await this.fetchFn(`${this.baseUrl}/bot${this.token}/${method}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
      ...(signal ? { signal } : {}),
    });
    if (!response.ok) throw new Error(`TELEGRAM_BOT_API_HTTP:${method}:${response.status}`);
    const decoded = record(await response.json());
    if (!decoded || decoded.ok !== true) throw apiError(method, decoded);
    return decoded.result;
  }
}
