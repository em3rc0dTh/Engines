import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { adaptRegisterNewCustomerCtaInput } from '../register-new-customer.adapter.js';
import type { ProvideCustomerDataInput } from '../../contracts/register-new-customer/index.js';
import {
  SessionIdempotencyConflictError,
  TemporalRegisterNewCustomerPort,
} from '../../orchestration/temporal/ports/register-new-customer.temporal-port.js';
import {
  getRegistrationStateQuery,
  provideCustomerDataUpdate,
} from '../../orchestration/temporal/workflows/register-new-customer.workflow.js';

const DEFAULT_PORT = 8787;
const MAX_BODY_BYTES = 1024 * 1024;

function sendJson(response: ServerResponse, statusCode: number, value: unknown): void {
  const body = JSON.stringify(value);
  response.writeHead(statusCode, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(body),
  });
  response.end(body);
}

async function readJson(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let bytes = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    bytes += buffer.byteLength;
    if (bytes > MAX_BODY_BYTES) throw new Error('CTA_HTTP_BODY_TOO_LARGE');
    chunks.push(buffer);
  }
  if (chunks.length === 0) return {};
  return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown;
}

function pathWorkflowId(pathname: string, suffix = ''): string | undefined {
  const prefix = '/mk0/register-new-customer/';
  if (!pathname.startsWith(prefix)) return undefined;
  const rest = pathname.slice(prefix.length);
  if (suffix) {
    if (!rest.endsWith(suffix)) return undefined;
    return decodeURIComponent(rest.slice(0, -suffix.length));
  }
  if (!rest || rest.includes('/')) return undefined;
  return decodeURIComponent(rest);
}

async function run(): Promise<void> {
  const temporalPort = await TemporalRegisterNewCustomerPort.connect();
  const client = temporalPort.getClient();
  const port = Number.parseInt(process.env.CORE_HTTP_PORT ?? String(DEFAULT_PORT), 10);

  const server = createServer(async (request, response) => {
    try {
      const url = new URL(request.url ?? '/', `http://${request.headers.host ?? 'localhost'}`);

      if (request.method === 'POST' && url.pathname === '/mk0/register-new-customer') {
        const payload = await readJson(request);
        const adapted = adaptRegisterNewCustomerCtaInput(payload, { channel: 'postman' });
        if (!adapted.ok) {
          sendJson(response, 400, { ok: false, status: 'CTA_REJECTED', issues: adapted.issues });
          return;
        }

        try {
          const receipt = await temporalPort.startRegisterNewCustomer(adapted.value);
          sendJson(response, 202, {
            ok: true,
            status: 'WORKFLOW_ACCEPTED',
            workflowId: receipt.workflowId,
            runId: receipt.runId,
            channel: adapted.value.request.channel,
          });
        } catch (error) {
          if (error instanceof SessionIdempotencyConflictError) {
            sendJson(response, 409, {
              ok: false,
              code: error.code,
              workflowId: error.workflowId,
              error: error.message,
            });
            return;
          }
          throw error;
        }
        return;
      }

      if (request.method === 'GET') {
        const workflowId = pathWorkflowId(url.pathname);
        if (workflowId) {
          const handle = client.workflow.getHandle(workflowId);
          const state = await handle.query(getRegistrationStateQuery);
          const description = await handle.describe();
          sendJson(response, 200, {
            ok: true,
            workflowId,
            runId: description.runId,
            state,
          });
          return;
        }
      }

      if (request.method === 'POST') {
        const workflowId = pathWorkflowId(url.pathname, '/customer-data');
        if (workflowId) {
          const input = (await readJson(request)) as ProvideCustomerDataInput;
          const handle = client.workflow.getHandle(workflowId);
          const result = await handle.executeUpdate(provideCustomerDataUpdate, { args: [input] });
          const description = await handle.describe();
          sendJson(response, 200, {
            ok: true,
            workflowId,
            runId: description.runId,
            result,
          });
          return;
        }
      }

      sendJson(response, 404, { ok: false, code: 'NOT_FOUND' });
    } catch (error) {
      sendJson(response, 500, {
        ok: false,
        code: 'CTA_HTTP_INTERNAL_ERROR',
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', () => resolve());
  });

  console.log(
    `CORE_HTTP_CTA_STARTED ${JSON.stringify({
      host: '127.0.0.1',
      port,
      channel: 'postman',
      pid: process.pid,
    })}`,
  );

  const shutdown = async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await temporalPort.close();
  };

  process.once('SIGTERM', () => void shutdown().then(() => process.exit(0)));
  process.once('SIGINT', () => void shutdown().then(() => process.exit(0)));
}

run().catch((error: unknown) => {
  console.error(
    `CORE_HTTP_CTA_FAILED ${JSON.stringify({
      error: error instanceof Error ? error.message : String(error),
    })}`,
  );
  process.exitCode = 1;
});
