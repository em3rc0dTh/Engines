import {
  AGENT_A0_RESOURCE_BUDGET,
  type AgentModelInput,
  type AgentModelProvider,
} from '../../contracts/agent-layer/index.js';
import { buildAgentDecisionJsonSchema } from '../decision-schema.js';
import { AGENT_A1_LOCAL_MODEL } from '../model-profile.js';
import { buildAgentSystemPrompt, buildAgentUserPrompt } from '../prompt.js';

export type LlamaCppAgentModelProviderConfig = Readonly<{
  baseUrl: string;
  model?: string;
  timeoutMs?: number;
  seed?: number;
}>;

function fail(message: string): never {
  throw new Error('Local Agent provider failed: ' + message);
}

function normalizedBaseUrl(value: string): string {
  const trimmed = value.trim().replace(/\/+$/, '');
  if (!/^https?:\/\//.test(trimmed)) {
    fail('baseUrl must use http or https');
  }
  return trimmed;
}

function parseCompletionContent(value: unknown): unknown {
  if (typeof value !== 'object' || value === null) {
    fail('completion response must be an object');
  }

  const choices = (value as Record<string, unknown>).choices;
  if (!Array.isArray(choices) || choices.length === 0) {
    fail('completion response contains no choices');
  }

  const first = choices[0];
  if (typeof first !== 'object' || first === null) {
    fail('completion choice is malformed');
  }

  const message = (first as Record<string, unknown>).message;
  if (typeof message !== 'object' || message === null) {
    fail('completion message is malformed');
  }

  const content = (message as Record<string, unknown>).content;
  if (typeof content !== 'string' || content.trim().length === 0) {
    fail('completion content must be a non-empty JSON string');
  }

  try {
    return JSON.parse(content);
  } catch {
    fail('completion content is not valid JSON');
  }
}

export class LlamaCppAgentModelProvider implements AgentModelProvider {
  readonly providerId = 'llama.cpp-local';

  readonly #baseUrl: string;
  readonly #model: string;
  readonly #timeoutMs: number;
  readonly #seed: number;

  constructor(config: LlamaCppAgentModelProviderConfig) {
    this.#baseUrl = normalizedBaseUrl(config.baseUrl);
    this.#model = config.model?.trim() || AGENT_A1_LOCAL_MODEL.modelAlias;
    this.#timeoutMs = config.timeoutMs ?? 30_000;
    this.#seed = config.seed ?? 42;

    if (this.#timeoutMs < 250 || this.#timeoutMs > 120_000) {
      fail('timeoutMs must be between 250 and 120000');
    }
  }

  async generateTurn(input: AgentModelInput): Promise<unknown> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.#timeoutMs);

    try {
      const response = await fetch(this.#baseUrl + '/v1/chat/completions', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: this.#model,
          messages: [
            {
              role: 'system',
              content: buildAgentSystemPrompt(input),
            },
            {
              role: 'user',
              content: buildAgentUserPrompt(input),
            },
          ],
          temperature: 0,
          top_p: 1,
          seed: this.#seed,
          max_tokens: AGENT_A0_RESOURCE_BUDGET.maxOutputTokens,
          reasoning_effort: 'none',
          stream: false,
          response_format: {
            type: 'json_schema',
            json_schema: {
              schema: buildAgentDecisionJsonSchema(input),
            },
          },
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const body = (await response.text()).slice(0, 500);
        fail('HTTP ' + response.status + ': ' + (body || response.statusText));
      }

      return parseCompletionContent(await response.json());
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
