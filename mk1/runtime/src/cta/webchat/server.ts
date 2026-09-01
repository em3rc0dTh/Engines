import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import type { AppointmentStateProjection } from '../../contracts/register-new-appointment/index.js';
import { projectAppointmentWorkflow } from '../channel-core/appointment-workflow-view.js';

const CTA_BASE_URL = (process.env.ENGINES_CTA_URL ?? 'http://127.0.0.1:8787').replace(/\/$/, '');
const PORT = Number.parseInt(process.env.ENGINES_WEBCHAT_PORT ?? '8790', 10);
const HOST = process.env.ENGINES_WEBCHAT_HOST?.trim() || '127.0.0.1';
const MAX_BODY_BYTES = 1024 * 1024;
const PUBLIC_ROOT = fileURLToPath(new URL('./public/', import.meta.url));

const STATIC_ROUTES = new Map<string, Readonly<{ file: string; contentType: string }>>([
  ['/', { file: 'chat.html', contentType: 'text/html; charset=utf-8' }],
  ['/webchat/', { file: 'chat.html', contentType: 'text/html; charset=utf-8' }],
  ['/webchat/index.html', { file: 'chat.html', contentType: 'text/html; charset=utf-8' }],
  ['/webchat/workflow.html', { file: 'workflow.html', contentType: 'text/html; charset=utf-8' }],
  ['/webchat/styles.css', { file: 'styles.css', contentType: 'text/css; charset=utf-8' }],
  ['/webchat/app.js', { file: 'app.js', contentType: 'text/javascript; charset=utf-8' }],
  ['/webchat/workflow.js', { file: 'workflow.js', contentType: 'text/javascript; charset=utf-8' }],
]);

type JsonRecord = Record<string, unknown>;

function record(value: unknown): JsonRecord | undefined {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as JsonRecord : undefined;
}

function sendJson(response: ServerResponse, statusCode: number, value: unknown): void {
  const body = Buffer.from(JSON.stringify(value));
  response.writeHead(statusCode, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': body.byteLength,
    'cache-control': 'no-store',
  });
  response.end(body);
}

function sendBuffer(response: ServerResponse, statusCode: number, contentType: string, body: Buffer): void {
  response.writeHead(statusCode, {
    'content-type': contentType,
    'content-length': body.byteLength,
    'cache-control': 'no-store',
  });
  response.end(body);
}

async function readBody(request: IncomingMessage): Promise<Buffer> {
  const chunks: Buffer[] = [];
  let bytes = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    bytes += buffer.byteLength;
    if (bytes > MAX_BODY_BYTES) throw new Error('WEBCHAT_BODY_TOO_LARGE');
    chunks.push(buffer);
  }
  return Buffer.concat(chunks);
}

function workflowIdFromViewPath(pathname: string): string | undefined {
  const prefix = '/api/appointments/';
  const suffix = '/view';
  if (!pathname.startsWith(prefix) || !pathname.endsWith(suffix)) return undefined;
  const encoded = pathname.slice(prefix.length, -suffix.length);
  if (!encoded || encoded.includes('/')) return undefined;
  return decodeURIComponent(encoded);
}

function allowedCtaPath(pathname: string): boolean {
  return pathname === '/health' || pathname === '/mk0/register-new-appointment'
    || pathname.startsWith('/mk0/register-new-appointment/');
}

async function proxyToCta(request: IncomingMessage, response: ServerResponse, pathname: string, search: string): Promise<void> {
  if (!allowedCtaPath(pathname)) {
    sendJson(response, 404, { ok: false, code: 'WEBCHAT_CTA_ROUTE_NOT_ALLOWED' });
    return;
  }

  const body = request.method === 'GET' || request.method === 'HEAD' ? undefined : await readBody(request);
  const headers: Record<string, string> = {};
  const contentType = request.headers['content-type'];
  if (typeof contentType === 'string') headers['content-type'] = contentType;

  const method = request.method ?? 'GET';
  const init: RequestInit = body && body.byteLength > 0
    ? { method, headers, body: body.toString('utf8') }
    : { method, headers };

  const upstream = await fetch(`${CTA_BASE_URL}${pathname}${search}`, init);
  const payload = Buffer.from(await upstream.arrayBuffer());
  sendBuffer(
    response,
    upstream.status,
    upstream.headers.get('content-type') ?? 'application/json; charset=utf-8',
    payload,
  );
}

async function workflowView(response: ServerResponse, workflowId: string): Promise<void> {
  const upstream = await fetch(`${CTA_BASE_URL}/mk0/register-new-appointment/${encodeURIComponent(workflowId)}`);
  const raw = await upstream.json() as unknown;
  const body = record(raw) ?? {};
  if (!upstream.ok) {
    sendJson(response, upstream.status, body);
    return;
  }
  const state = record(body.state) as AppointmentStateProjection | undefined;
  if (!state) {
    sendJson(response, 502, { ok: false, code: 'WEBCHAT_STATE_PROJECTION_MISSING' });
    return;
  }
  sendJson(response, 200, {
    ...body,
    view: projectAppointmentWorkflow(state),
  });
}

async function serveStatic(response: ServerResponse, pathname: string): Promise<boolean> {
  const asset = STATIC_ROUTES.get(pathname);
  if (!asset) return false;
  const body = await readFile(join(PUBLIC_ROOT, asset.file));
  sendBuffer(response, 200, asset.contentType, body);
  return true;
}

async function run(): Promise<void> {
  const server = createServer(async (request, response) => {
    try {
      const url = new URL(request.url ?? '/', `http://${request.headers.host ?? 'localhost'}`);

      if (request.method === 'GET' && url.pathname === '/health') {
        const cta = await fetch(`${CTA_BASE_URL}/health`);
        sendJson(response, cta.ok ? 200 : 503, {
          ok: cta.ok,
          service: 'engines-webchat-poc',
          ctaBaseUrl: CTA_BASE_URL,
          agent: false,
          mcp: false,
        });
        return;
      }

      if (request.method === 'GET' && await serveStatic(response, url.pathname)) return;

      if (request.method === 'GET') {
        const workflowId = workflowIdFromViewPath(url.pathname);
        if (workflowId) {
          await workflowView(response, workflowId);
          return;
        }
      }

      if (url.pathname.startsWith('/api/cta/')) {
        const targetPath = `/${url.pathname.slice('/api/cta/'.length)}`;
        await proxyToCta(request, response, targetPath, url.search);
        return;
      }

      sendJson(response, 404, { ok: false, code: 'WEBCHAT_ROUTE_NOT_FOUND' });
    } catch (error) {
      sendJson(response, 500, {
        ok: false,
        code: 'WEBCHAT_INTERNAL_ERROR',
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  server.listen(PORT, HOST, () => {
    console.log(`ENGINES_WEBCHAT_READY http://${HOST}:${PORT}/webchat/ -> ${CTA_BASE_URL}`);
  });
}

run().catch((error: unknown) => {
  console.error(`ENGINES_WEBCHAT_FAILED ${error instanceof Error ? error.stack ?? error.message : String(error)}`);
  process.exitCode = 1;
});
