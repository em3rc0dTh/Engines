type JsonRecord = Record<string, unknown>;

type WaitForCtaOptions = Readonly<{
  baseUrl?: string;
  timeoutMs?: number;
  intervalMs?: number;
  fetchImpl?: typeof fetch;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
}>;

export type CtaHealthResult = Readonly<{
  body: JsonRecord;
  attempts: number;
  elapsedMs: number;
}>;

function record(value: unknown): JsonRecord | undefined {
  return value && typeof value === 'object' ? value as JsonRecord : undefined;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export async function waitForCtaHealth(options: WaitForCtaOptions = {}): Promise<CtaHealthResult> {
  const baseUrl = (options.baseUrl ?? process.env.ENGINES_CTA_URL ?? 'http://127.0.0.1:8787').replace(/\/$/, '');
  const timeoutMs = options.timeoutMs ?? 30_000;
  const intervalMs = options.intervalMs ?? 250;
  const fetchImpl = options.fetchImpl ?? fetch;
  const now = options.now ?? Date.now;
  const sleep = options.sleep ?? ((ms: number) => new Promise((resolve) => setTimeout(resolve, ms)));

  const startedAt = now();
  const deadline = startedAt + timeoutMs;
  let attempts = 0;
  let lastFailure = 'CTA health endpoint did not become ready';

  while (now() <= deadline) {
    attempts += 1;
    try {
      const response = await fetchImpl(`${baseUrl}/health`);
      const payload = await response.json() as unknown;
      const body = record(payload) ?? {};
      if (response.ok && body.ok === true) {
        return {
          body,
          attempts,
          elapsedMs: Math.max(0, now() - startedAt),
        };
      }
      lastFailure = `HTTP ${response.status}: ${JSON.stringify(body)}`;
    } catch (error) {
      lastFailure = errorMessage(error);
    }

    if (now() >= deadline) break;
    await sleep(Math.min(intervalMs, Math.max(0, deadline - now())));
  }

  throw new Error(
    `CTA_UNAVAILABLE: ${baseUrl}/health was not ready after ${timeoutMs}ms (${attempts} attempts). Last failure: ${lastFailure}`,
  );
}
