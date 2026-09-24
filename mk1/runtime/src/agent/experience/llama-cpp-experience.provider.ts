import { AGENT_A0_RESOURCE_BUDGET } from '../../contracts/agent-layer/index.js';
import { AGENT_A1_LOCAL_MODEL } from '../model-profile.js';
import {
  buildA5ExperienceJsonSchema,
  buildA5ExperienceSystemPrompt,
  buildA5ExperienceUserPrompt,
} from './progressive-distillation.js';
import type {
  A5ExperienceModelInput,
  A5ExperienceModelProvider,
} from './types.js';

export const A5_MAX_OUTPUT_TOKENS = 192;

export type LlamaCppA5ExperienceProviderConfig = Readonly<{
  baseUrl: string;
  model?: string;
  timeoutMs?: number;
  seed?: number;
}>;

function fail(message: string): never {
  throw new Error('A5 local experience provider failed: ' + message);
}

function normalizedBaseUrl(value: string): string {
  const clean = value.trim().replace(/\/+$/, '');
  if (!/^https?:\/\//.test(clean)) fail('baseUrl must use http or https');
  return clean;
}

function parseContent(value: unknown): unknown {
  if (!value || typeof value !== 'object') fail('completion response must be an object');
  const choices = (value as Record<string, unknown>).choices;
  if (!Array.isArray(choices) || choices.length === 0) fail('completion response contains no choices');
  const first = choices[0];
  if (!first || typeof first !== 'object') fail('completion choice is malformed');
  const message = (first as Record<string, unknown>).message;
  if (!message || typeof message !== 'object') fail('completion message is malformed');
  const content = (message as Record<string, unknown>).content;
  if (typeof content !== 'string' || !content.trim()) fail('completion content must be a non-empty JSON string');
  const finishReason = typeof (first as Record<string, unknown>).finish_reason === 'string'
    ? String((first as Record<string, unknown>).finish_reason)
    : 'unknown';

  try {
    const parsed = JSON.parse(content) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      fail('completion content must decode to a JSON object');
    }
    return {
      ...(parsed as Record<string, unknown>),
      schemaVersion: 1,
    };
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('A5 local experience provider failed:')) throw error;
    fail('completion content is not valid JSON'
      + ' (finish_reason=' + finishReason + '; chars=' + content.length + ')');
  }
}

export class LlamaCppA5ExperienceProvider implements A5ExperienceModelProvider {
  readonly providerId = 'llama.cpp-local-a5-experience';

  readonly #baseUrl: string;
  readonly #model: string;
  readonly #timeoutMs: number;
  readonly #seed: number;

  constructor(config: LlamaCppA5ExperienceProviderConfig) {
    this.#baseUrl = normalizedBaseUrl(config.baseUrl);
    this.#model = config.model?.trim() || AGENT_A1_LOCAL_MODEL.modelAlias;
    this.#timeoutMs = config.timeoutMs ?? 30_000;
    this.#seed = config.seed ?? 42;
    if (this.#timeoutMs < 250 || this.#timeoutMs > 120_000) {
      fail('timeoutMs must be between 250 and 120000');
    }
  }

  async generateTurn(input: A5ExperienceModelInput): Promise<unknown> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.#timeoutMs);

    try {
      const response = await fetch(this.#baseUrl + '/v1/chat/completions', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          model: this.#model,
          messages: [
            { role: 'system', content: buildA5ExperienceSystemPrompt(input) },
            { role: 'user', content: buildA5ExperienceUserPrompt(input) },
          ],
          temperature: 0,
          top_p: 1,
          seed: this.#seed,
          max_tokens: Math.max(AGENT_A0_RESOURCE_BUDGET.maxOutputTokens, A5_MAX_OUTPUT_TOKENS),
          reasoning_effort: 'none',
          stream: false,
          response_format: {
            type: 'json_schema',
            json_schema: {
              schema: buildA5ExperienceJsonSchema(input),
            },
          },
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const body = (await response.text()).slice(0, 500);
        fail('HTTP ' + response.status + ': ' + (body || response.statusText));
      }
      return parseContent(await response.json());
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        fail('request timed out after ' + this.#timeoutMs + 'ms');
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }
}
