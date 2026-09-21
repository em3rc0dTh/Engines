import assert from 'node:assert/strict';
import test from 'node:test';
import { waitForCtaHealth } from './wait-for-cta.js';

function jsonResponse(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

test('lab console waits through startup connection failures until CTA health is ready', async () => {
  let clock = 0;
  let calls = 0;
  const fetchImpl: typeof fetch = async () => {
    calls += 1;
    if (calls === 1) throw new TypeError('fetch failed');
    if (calls === 2) return jsonResponse(503, { ok: false, service: 'engines-mk0-cta' });
    return jsonResponse(200, { ok: true, service: 'engines-mk0-cta', temporalAddress: 'temporal:7233' });
  };

  const result = await waitForCtaHealth({
    baseUrl: 'http://127.0.0.1:8787',
    timeoutMs: 5_000,
    intervalMs: 100,
    fetchImpl,
    now: () => clock,
    sleep: async (ms) => { clock += ms; },
  });

  assert.equal(result.attempts, 3);
  assert.equal(result.elapsedMs, 200);
  assert.equal(result.body.ok, true);
  assert.equal(result.body.service, 'engines-mk0-cta');
});

test('lab console reports a typed readiness failure after the bounded timeout', async () => {
  let clock = 0;
  const fetchImpl: typeof fetch = async () => {
    throw new TypeError('fetch failed');
  };

  await assert.rejects(
    waitForCtaHealth({
      baseUrl: 'http://127.0.0.1:8787',
      timeoutMs: 250,
      intervalMs: 100,
      fetchImpl,
      now: () => clock,
      sleep: async (ms) => { clock += ms; },
    }),
    /CTA_UNAVAILABLE: .*\/health was not ready after 250ms \(4 attempts\).*fetch failed/,
  );
});
