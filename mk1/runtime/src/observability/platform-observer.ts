import { createServer, type ServerResponse } from 'node:http';
import { connect } from 'node:net';
import { createResilientPostgresPool } from '../persistence/postgres/resilient-pool.js';
import { MongoClient } from 'mongodb';

const PORT = Number.parseInt(process.env.ENGINES_OBSERVER_PORT ?? '8890', 10);
const HOST = process.env.ENGINES_OBSERVER_HOST?.trim() || '0.0.0.0';
const ADMIN_TOKEN = process.env.ENGINES_OBSERVER_ADMIN_TOKEN?.trim() || '';
const POSTGRES_URL = process.env.POSTGRES_URL ?? 'postgresql://engines:engines@postgres:5432/engines_mk0';
const MONGO_URL = process.env.MONGO_URL ?? 'mongodb://mongo:27017';
const MONGO_DB = process.env.MONGO_DB ?? 'engines_mk0';
const CTA_HEALTH_URL = process.env.ENGINES_OBSERVER_CTA_URL ?? 'http://cta:8787/health';
const CHANNEL_HEALTH_URL = process.env.ENGINES_OBSERVER_CHANNEL_URL ?? 'http://channel-core:8788/health';
const MINIO_HEALTH_URL = process.env.ENGINES_OBSERVER_MINIO_URL ?? 'http://minio:9000/minio/health/live';
const TEMPORAL_HOST = process.env.ENGINES_OBSERVER_TEMPORAL_HOST ?? 'temporal';
const TEMPORAL_PORT = Number.parseInt(process.env.ENGINES_OBSERVER_TEMPORAL_PORT ?? '7233', 10);
const INTERVAL_MS = Number.parseInt(process.env.ENGINES_OBSERVER_INTERVAL_MS ?? '1000', 10);

type Component = 'cta' | 'channel-core' | 'temporal' | 'postgres' | 'mongo' | 'minio';
type ProbeState = Readonly<{ up: boolean; checkedAt: string; latencyMs: number }>;

const components: readonly Component[] = ['cta', 'channel-core', 'temporal', 'postgres', 'mongo', 'minio'];
const state = new Map<Component, ProbeState>();
const pool = createResilientPostgresPool({ connectionString: POSTGRES_URL, max: 2 }, 'platform-observer');
const mongo = new MongoClient(MONGO_URL, { maxPoolSize: 2 });

function sendJson(response: ServerResponse, status: number, value: unknown): void {
  const body = Buffer.from(JSON.stringify(value));
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': body.byteLength,
    'cache-control': 'no-store',
  });
  response.end(body);
}

function sendText(response: ServerResponse, status: number, text: string): void {
  const body = Buffer.from(text);
  response.writeHead(status, {
    'content-type': 'text/plain; version=0.0.4; charset=utf-8',
    'content-length': body.byteLength,
    'cache-control': 'no-store',
  });
  response.end(body);
}

async function timed(probe: () => Promise<void>): Promise<Readonly<{ up: boolean; latencyMs: number }>> {
  const started = Date.now();
  try {
    await probe();
    return { up: true, latencyMs: Date.now() - started };
  } catch {
    return { up: false, latencyMs: Date.now() - started };
  }
}

async function httpProbe(url: string): Promise<void> {
  const response = await fetch(url, { signal: AbortSignal.timeout(1500) });
  if (!response.ok) throw new Error(`HTTP_${response.status}`);
}

async function tcpProbe(host: string, port: number): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const socket = connect({ host, port });
    const timer = setTimeout(() => {
      socket.destroy();
      reject(new Error('TCP_TIMEOUT'));
    }, 1500);
    socket.once('connect', () => {
      clearTimeout(timer);
      socket.end();
      resolve();
    });
    socket.once('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
  });
}

async function probeAll(): Promise<void> {
  const probes: Record<Component, () => Promise<void>> = {
    cta: () => httpProbe(CTA_HEALTH_URL),
    'channel-core': () => httpProbe(CHANNEL_HEALTH_URL),
    temporal: () => tcpProbe(TEMPORAL_HOST, TEMPORAL_PORT),
    postgres: async () => { await pool.query('SELECT 1'); },
    mongo: async () => { await mongo.db(MONGO_DB).command({ ping: 1 }); },
    minio: () => httpProbe(MINIO_HEALTH_URL),
  };

  for (const component of components) {
    const result = await timed(probes[component]);
    const previous = state.get(component);
    const next: ProbeState = { ...result, checkedAt: new Date().toISOString() };
    state.set(component, next);
    if (!previous || previous.up !== next.up) {
      console.log(JSON.stringify({
        event: 'ENGINES_COMPONENT_STATE_CHANGE',
        component,
        up: next.up,
        checkedAt: next.checkedAt,
        latencyMs: next.latencyMs,
      }));
    }
  }
}

function metrics(): string {
  const lines = [
    '# HELP engines_component_up Whether the Engines platform component is reachable (1=yes, 0=no).',
    '# TYPE engines_component_up gauge',
  ];
  for (const component of components) {
    lines.push(`engines_component_up{component="${component}"} ${state.get(component)?.up ? 1 : 0}`);
  }
  lines.push('# HELP engines_component_probe_latency_milliseconds Last component probe latency.');
  lines.push('# TYPE engines_component_probe_latency_milliseconds gauge');
  for (const component of components) {
    lines.push(`engines_component_probe_latency_milliseconds{component="${component}"} ${state.get(component)?.latencyMs ?? 0}`);
  }
  lines.push(`engines_observer_last_probe_timestamp_seconds ${Math.floor(Date.now() / 1000)}`);
  return `${lines.join('\n')}\n`;
}

function allUp(): boolean {
  return components.every((component) => state.get(component)?.up === true);
}

function operatorAuthorized(header: string | string[] | undefined): 'OK' | 'MISSING' | 'DENIED' {
  const value = Array.isArray(header) ? header[0] : header;
  if (!value) return 'MISSING';
  if (!ADMIN_TOKEN || value !== `Bearer ${ADMIN_TOKEN}`) return 'DENIED';
  return 'OK';
}

async function run(): Promise<void> {
  if (!ADMIN_TOKEN) throw new Error('ENGINES_OBSERVER_ADMIN_TOKEN_REQUIRED');
  await mongo.connect();
  await probeAll();

  const timer = setInterval(() => {
    void probeAll().catch((error) => {
      console.error(JSON.stringify({
        event: 'ENGINES_OBSERVER_PROBE_FAILED',
        error: error instanceof Error ? error.message : String(error),
      }));
    });
  }, INTERVAL_MS);
  timer.unref();

  const server = createServer((request, response) => {
    const url = new URL(request.url ?? '/', `http://${request.headers.host ?? 'localhost'}`);

    if (request.method === 'GET' && url.pathname === '/health') {
      const ok = allUp();
      sendJson(response, ok ? 200 : 503, {
        ok,
        service: 'engines-platform-observer',
        components: Object.fromEntries(components.map((component) => [component, state.get(component)?.up ?? false])),
      });
      return;
    }

    if (request.method === 'GET' && url.pathname === '/metrics') {
      sendText(response, 200, metrics());
      return;
    }

    if (request.method === 'GET' && url.pathname === '/governance/status') {
      const auth = operatorAuthorized(request.headers.authorization);
      if (auth === 'MISSING') {
        sendJson(response, 401, { ok: false, code: 'OPERATOR_AUTH_REQUIRED' });
        return;
      }
      if (auth === 'DENIED') {
        sendJson(response, 403, { ok: false, code: 'OPERATOR_AUTH_DENIED' });
        return;
      }
      sendJson(response, 200, {
        ok: true,
        role: 'platform-operator',
        authorities: {
          workflow: 'temporal',
          businessTruth: 'postgresql',
          operationalAudit: 'mongodb',
          objectIntegrity: 's3-compatible',
        },
        boundaries: {
          agent: false,
          mcp: false,
          secretsExposed: false,
          rawProviderPayloadsExposed: false,
        },
        components: Object.fromEntries(components.map((component) => [component, state.get(component) ?? null])),
      });
      return;
    }

    sendJson(response, 404, { ok: false, code: 'OBSERVER_ROUTE_NOT_FOUND' });
  });

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(PORT, HOST, resolve);
  });

  console.log(JSON.stringify({ event: 'ENGINES_PLATFORM_OBSERVER_READY', host: HOST, port: PORT }));

  const shutdown = async (): Promise<void> => {
    clearInterval(timer);
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await Promise.all([pool.end(), mongo.close()]);
  };
  process.once('SIGTERM', () => void shutdown().then(() => process.exit(0)));
  process.once('SIGINT', () => void shutdown().then(() => process.exit(0)));
}

run().catch((error: unknown) => {
  console.error(JSON.stringify({
    event: 'ENGINES_PLATFORM_OBSERVER_FAILED',
    error: error instanceof Error ? error.message : String(error),
  }));
  process.exitCode = 1;
});
