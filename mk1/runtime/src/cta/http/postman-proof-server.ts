import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { loadRuntimeConfig } from '../../config/runtime-config.js';
import {
  normalizeAppointmentDateInput,
  todayInTimeZone,
  type FinalizeAppointmentInput,
  type ProvideAppointmentCustomerInput,
  type ResolveAppointmentCustomerInput,
  type SelectAppointmentProductInput,
  type SelectAppointmentServiceInput,
  type SelectAppointmentSlotInput,
  type SetAppointmentDateInput,
} from '../../contracts/register-new-appointment/index.js';
import {
  validateProvideCustomerDataIngress,
  type ProvideCustomerDataInput,
} from '../../contracts/register-new-customer/index.js';
import {
  AttachmentStoreError,
  MK0_ATTACHMENT_MAX_SINGLE_BYTES,
} from '../../persistence/attachments/attachment-store.types.js';
import { FilesystemAttachmentStore } from '../../persistence/attachments/filesystem-attachment-store.js';
import {
  SessionIdempotencyConflictError,
  TemporalRegisterNewCustomerPort,
} from '../../orchestration/temporal/ports/register-new-customer.temporal-port.js';
import {
  AppointmentSessionIdempotencyConflictError,
  TemporalRegisterNewAppointmentPort,
} from '../../orchestration/temporal/ports/register-new-appointment.temporal-port.js';
import {
  finalizeRegistrationUpdate,
  getRegistrationStateQuery,
  provideCustomerDataUpdate,
  type FinalizeRegistrationInput,
} from '../../orchestration/temporal/workflows/register-new-customer.workflow.js';
import {
  finalizeAppointmentUpdate,
  getAppointmentStateQuery,
  provideAppointmentCustomerUpdate,
  resolveAppointmentCustomerUpdate,
  selectAppointmentProductUpdate,
  selectAppointmentServiceUpdate,
  selectAppointmentSlotUpdate,
  setAppointmentDateUpdate,
} from '../../orchestration/temporal/workflows/register-new-appointment.workflow.js';
import { adaptRegisterNewCustomerCtaInput } from '../register-new-customer.adapter.js';
import { adaptRegisterNewAppointmentCtaInput } from '../register-new-appointment.adapter.js';
import { buildRegisterNewCustomerExecutionTrace } from '../../observability/register-new-customer-trace.js';
import { closeExecutionEvidenceRepository } from '../../observability/execution-evidence.repository.js';

const DEFAULT_PORT = 8787;
const DEFAULT_HOST = '127.0.0.1';
const MAX_JSON_BODY_BYTES = 1024 * 1024;
const BUSINESS_TIME_ZONE = 'America/Lima';

type JsonRecord = Record<string, unknown>;

function record(value: unknown): JsonRecord | undefined {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as JsonRecord
    : undefined;
}

function sendJson(response: ServerResponse, statusCode: number, value: unknown): void {
  const body = JSON.stringify(value);
  response.writeHead(statusCode, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(body),
  });
  response.end(body);
}

async function readBody(request: IncomingMessage, maximumBytes: number): Promise<Buffer> {
  const chunks: Buffer[] = [];
  let bytes = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    bytes += buffer.byteLength;
    if (bytes > maximumBytes) throw new Error('CTA_HTTP_BODY_TOO_LARGE');
    chunks.push(buffer);
  }
  return Buffer.concat(chunks);
}

async function readJson(request: IncomingMessage): Promise<unknown> {
  const body = await readBody(request, MAX_JSON_BODY_BYTES);
  if (body.byteLength === 0) return {};
  return JSON.parse(body.toString('utf8')) as unknown;
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

function pathAppointmentWorkflowId(pathname: string, suffix = ''): string | undefined {
  const prefix = '/mk0/register-new-appointment/';
  if (!pathname.startsWith(prefix)) return undefined;
  const rest = pathname.slice(prefix.length);
  if (suffix) {
    if (!rest.endsWith(suffix)) return undefined;
    return decodeURIComponent(rest.slice(0, -suffix.length));
  }
  if (!rest || rest.includes('/')) return undefined;
  return decodeURIComponent(rest);
}

function pathExecutionTraceWorkflowId(pathname: string): string | undefined {
  const prefix = '/mk0/executions/';
  const suffix = '/trace';
  if (!pathname.startsWith(prefix) || !pathname.endsWith(suffix)) return undefined;
  const encoded = pathname.slice(prefix.length, -suffix.length);
  if (!encoded || encoded.includes('/')) return undefined;
  return decodeURIComponent(encoded);
}

function pathIngressRef(pathname: string): string | undefined {
  const prefix = '/mk0/attachments/';
  if (!pathname.startsWith(prefix)) return undefined;
  const rest = pathname.slice(prefix.length);
  if (!rest || rest.includes('/')) return undefined;
  return decodeURIComponent(rest);
}

function headerString(request: IncomingMessage, name: string): string | undefined {
  const value = request.headers[name];
  if (Array.isArray(value)) return value[0]?.trim() || undefined;
  return value?.trim() || undefined;
}

function workflowAlreadyClosed(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /already completed|already closed|workflow execution.*completed/i.test(message);
}

function inputId(body: JsonRecord): string | undefined {
  return typeof body.inputId === 'string' && body.inputId.trim() ? body.inputId.trim() : undefined;
}

function stringField(body: JsonRecord, key: string): string | undefined {
  const value = body[key];
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

async function run(): Promise<void> {
  const config = loadRuntimeConfig();
  const temporalPort = await TemporalRegisterNewCustomerPort.connect();
  const appointmentPort = await TemporalRegisterNewAppointmentPort.connect();
  const client = temporalPort.getClient();
  const appointmentClient = appointmentPort.client;
  const attachmentStore = new FilesystemAttachmentStore(config.attachmentStoreRoot);
  const port = Number.parseInt(process.env.CORE_HTTP_PORT ?? String(DEFAULT_PORT), 10);
  const host = process.env.CORE_HTTP_HOST?.trim() || DEFAULT_HOST;

  const server = createServer(async (request, response) => {
    try {
      const url = new URL(request.url ?? '/', `http://${request.headers.host ?? 'localhost'}`);

      if (request.method === 'GET' && url.pathname === '/health') {
        sendJson(response, 200, {
          ok: true,
          service: 'engines-mk0-cta',
          temporalAddress: config.temporalAddress,
          operations: ['RegisterNewCustomer', 'RegisterNewAppointment'],
        });
        return;
      }

      if (request.method === 'POST' && url.pathname === '/mk0/attachments/stage') {
        const bytes = await readBody(request, MK0_ATTACHMENT_MAX_SINGLE_BYTES);
        const contentType = headerString(request, 'content-type')?.split(';')[0]?.trim();
        const mediaType = headerString(request, 'x-media-type') ?? contentType;
        if (!mediaType) {
          sendJson(response, 400, { ok: false, code: 'ATTACHMENT_MEDIA_TYPE_REQUIRED' });
          return;
        }
        const expectedSha256 = headerString(request, 'x-expected-sha256');
        const displayName = headerString(request, 'x-file-name');
        const ingressRef = headerString(request, 'x-ingress-ref');
        try {
          const staged = await attachmentStore.stage({
            bytes,
            mediaType,
            ...(expectedSha256 ? { expectedSha256 } : {}),
            ...(displayName ? { displayName } : {}),
            ...(ingressRef ? { ingressRef } : {}),
          });
          sendJson(response, 201, { ok: true, status: 'ATTACHMENT_STAGED', attachment: staged });
        } catch (error) {
          if (error instanceof AttachmentStoreError) {
            sendJson(response, error.code === 'ATTACHMENT_STORE_UNAVAILABLE' ? 503 : 400, {
              ok: false,
              code: error.code,
              error: error.message,
            });
            return;
          }
          throw error;
        }
        return;
      }

      if (request.method === 'GET') {
        const traceWorkflowId = pathExecutionTraceWorkflowId(url.pathname);
        if (traceWorkflowId) {
          if (traceWorkflowId.startsWith('register-appointment:')) {
            const handle = appointmentClient.workflow.getHandle(traceWorkflowId);
            const state = await handle.query(getAppointmentStateQuery);
            const description = await handle.describe();
            sendJson(response, 200, {
              ok: true,
              trace: {
                schemaVersion: 'mk0.appointment-execution-trace.v0',
                workflow: { workflowId: traceWorkflowId, runId: description.runId, workflowStatus: state.workflowStatus, phase: state.phase },
                conversation: state,
                evidence: { temporal: true, stateProjection: true },
              },
            });
            return;
          }
          const trace = await buildRegisterNewCustomerExecutionTrace(client, attachmentStore, traceWorkflowId);
          sendJson(response, 200, { ok: true, trace });
          return;
        }
      }

      if (request.method === 'GET') {
        const ingressRef = pathIngressRef(url.pathname);
        if (ingressRef) {
          const metadata = await attachmentStore.resolveIngress(ingressRef);
          if (!metadata) {
            sendJson(response, 404, { ok: false, code: 'ATTACHMENT_INGRESS_NOT_FOUND' });
            return;
          }
          sendJson(response, 200, { ok: true, attachment: metadata });
          return;
        }
      }

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
            sendJson(response, 409, { ok: false, code: error.code, workflowId: error.workflowId, error: error.message });
            return;
          }
          throw error;
        }
        return;
      }

      if (request.method === 'POST' && url.pathname === '/mk0/register-new-appointment') {
        const payload = await readJson(request);
        const adapted = adaptRegisterNewAppointmentCtaInput(payload, { channel: 'lab' });
        if (!adapted.ok) {
          sendJson(response, 400, { ok: false, status: 'CTA_REJECTED', issues: adapted.issues });
          return;
        }
        try {
          const receipt = await appointmentPort.start(adapted.value);
          sendJson(response, 202, {
            ok: true,
            status: 'WORKFLOW_ACCEPTED',
            workflowId: receipt.workflowId,
            runId: receipt.runId,
            channel: adapted.value.request.channel,
          });
        } catch (error) {
          if (error instanceof AppointmentSessionIdempotencyConflictError) {
            sendJson(response, 409, { ok: false, code: error.code, workflowId: error.workflowId, error: error.message });
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
          sendJson(response, 200, { ok: true, workflowId, runId: description.runId, state });
          return;
        }
      }

      if (request.method === 'GET') {
        const workflowId = pathAppointmentWorkflowId(url.pathname);
        if (workflowId) {
          const handle = appointmentClient.workflow.getHandle(workflowId);
          const state = await handle.query(getAppointmentStateQuery);
          const description = await handle.describe();
          sendJson(response, 200, { ok: true, workflowId, runId: description.runId, state });
          return;
        }
      }

      if (request.method === 'POST') {
        const workflowId = pathWorkflowId(url.pathname, '/customer-data');
        if (workflowId) {
          const rawInput = await readJson(request);
          const handle = client.workflow.getHandle(workflowId);
          try {
            const state = await handle.query(getRegistrationStateQuery);
            if (state.workflowStatus !== 'RUNNING') {
              sendJson(response, 409, { ok: false, code: 'WORKFLOW_ALREADY_COMPLETED', workflowId, state });
              return;
            }
            const validated = validateProvideCustomerDataIngress(rawInput);
            if (!validated.ok) {
              const description = await handle.describe();
              sendJson(response, 200, {
                ok: true,
                workflowId,
                runId: description.runId,
                result: { ok: false, issues: validated.issues, state },
              });
              return;
            }
            const input: ProvideCustomerDataInput = validated.value;
            const result = await handle.executeUpdate(provideCustomerDataUpdate, { args: [input] });
            const description = await handle.describe();
            sendJson(response, 200, { ok: true, workflowId, runId: description.runId, result });
          } catch (error) {
            if (workflowAlreadyClosed(error)) {
              sendJson(response, 409, { ok: false, code: 'WORKFLOW_ALREADY_COMPLETED', workflowId, error: error instanceof Error ? error.message : String(error) });
              return;
            }
            throw error;
          }
          return;
        }
      }

      if (request.method === 'POST') {
        const workflowId = pathWorkflowId(url.pathname, '/finalize');
        if (workflowId) {
          const input = (await readJson(request)) as FinalizeRegistrationInput;
          const handle = client.workflow.getHandle(workflowId);
          try {
            const state = await handle.query(getRegistrationStateQuery);
            if (state.workflowStatus !== 'RUNNING') {
              sendJson(response, 409, { ok: false, code: 'WORKFLOW_ALREADY_COMPLETED', workflowId, state });
              return;
            }
            const result = await handle.executeUpdate(finalizeRegistrationUpdate, { args: [input] });
            const description = await handle.describe();
            sendJson(response, 200, { ok: true, workflowId, runId: description.runId, result });
          } catch (error) {
            if (workflowAlreadyClosed(error)) {
              sendJson(response, 409, { ok: false, code: 'WORKFLOW_ALREADY_COMPLETED', workflowId, error: error instanceof Error ? error.message : String(error) });
              return;
            }
            throw error;
          }
          return;
        }
      }

      if (request.method === 'POST') {
        const workflowId = pathAppointmentWorkflowId(url.pathname, '/customer-data');
        if (workflowId) {
          const raw = record(await readJson(request)) ?? {};
          const id = inputId(raw);
          const customerId = stringField(raw, 'customerId');
          const customerPatch = record(raw.customerPatch);
          if (!id || (!customerId && !customerPatch)) {
            sendJson(response, 400, { ok: false, code: 'INVALID_APPOINTMENT_CUSTOMER_INPUT' });
            return;
          }
          const handle = appointmentClient.workflow.getHandle(workflowId);
          const state = await handle.query(getAppointmentStateQuery);
          if (customerPatch) {
            const validated = validateProvideCustomerDataIngress({ inputId: id, customerPatch });
            if (!validated.ok) {
              const description = await handle.describe();
              sendJson(response, 200, {
                ok: true,
                workflowId,
                runId: description.runId,
                result: { ok: false, issues: validated.issues, state },
              });
              return;
            }
          }
          const input: ProvideAppointmentCustomerInput = {
            inputId: id,
            ...(customerId ? { customerId } : {}),
            ...(customerPatch ? { customerPatch } : {}),
          };
          const result = await handle.executeUpdate(provideAppointmentCustomerUpdate, { args: [input] });
          const description = await handle.describe();
          sendJson(response, 200, { ok: true, workflowId, runId: description.runId, result });
          return;
        }
      }

      if (request.method === 'POST') {
        const workflowId = pathAppointmentWorkflowId(url.pathname, '/resolve-customer');
        if (workflowId) {
          const raw = record(await readJson(request)) ?? {};
          const id = inputId(raw);
          if (!id) { sendJson(response, 400, { ok: false, code: 'INPUT_ID_REQUIRED' }); return; }
          const handle = appointmentClient.workflow.getHandle(workflowId);
          const input: ResolveAppointmentCustomerInput = { inputId: id };
          const result = await handle.executeUpdate(resolveAppointmentCustomerUpdate, { args: [input] });
          const description = await handle.describe();
          sendJson(response, 200, { ok: true, workflowId, runId: description.runId, result });
          return;
        }
      }

      if (request.method === 'POST') {
        const workflowId = pathAppointmentWorkflowId(url.pathname, '/service');
        if (workflowId) {
          const raw = record(await readJson(request)) ?? {};
          const id = inputId(raw);
          const serviceId = stringField(raw, 'serviceId');
          if (!id || !serviceId) { sendJson(response, 400, { ok: false, code: 'SERVICE_SELECTION_INVALID' }); return; }
          const handle = appointmentClient.workflow.getHandle(workflowId);
          const input: SelectAppointmentServiceInput = { inputId: id, serviceId };
          const result = await handle.executeUpdate(selectAppointmentServiceUpdate, { args: [input] });
          const description = await handle.describe();
          sendJson(response, 200, { ok: true, workflowId, runId: description.runId, result });
          return;
        }
      }

      if (request.method === 'POST') {
        const workflowId = pathAppointmentWorkflowId(url.pathname, '/product');
        if (workflowId) {
          const raw = record(await readJson(request)) ?? {};
          const id = inputId(raw);
          const productId = stringField(raw, 'productId');
          if (!id || !productId) { sendJson(response, 400, { ok: false, code: 'PRODUCT_SELECTION_INVALID' }); return; }
          const handle = appointmentClient.workflow.getHandle(workflowId);
          const input: SelectAppointmentProductInput = { inputId: id, productId };
          const result = await handle.executeUpdate(selectAppointmentProductUpdate, { args: [input] });
          const description = await handle.describe();
          sendJson(response, 200, { ok: true, workflowId, runId: description.runId, result });
          return;
        }
      }

      if (request.method === 'POST') {
        const workflowId = pathAppointmentWorkflowId(url.pathname, '/date');
        if (workflowId) {
          const raw = record(await readJson(request)) ?? {};
          const id = inputId(raw);
          const dateInput = stringField(raw, 'dateInput') ?? stringField(raw, 'appointmentDate');
          if (!id || !dateInput) { sendJson(response, 400, { ok: false, code: 'APPOINTMENT_DATE_INPUT_INVALID' }); return; }
          const parsed = normalizeAppointmentDateInput(dateInput, todayInTimeZone(BUSINESS_TIME_ZONE));
          if (!parsed.ok) {
            sendJson(response, 200, {
              ok: true,
              workflowId,
              result: {
                ok: false,
                issues: [{ code: parsed.code, path: 'appointmentDate', message: parsed.message }],
              },
            });
            return;
          }
          const handle = appointmentClient.workflow.getHandle(workflowId);
          const input: SetAppointmentDateInput = { inputId: id, appointmentDate: parsed.appointmentDate };
          const result = await handle.executeUpdate(setAppointmentDateUpdate, { args: [input] });
          const description = await handle.describe();
          sendJson(response, 200, {
            ok: true,
            workflowId,
            runId: description.runId,
            normalizedAppointmentDate: parsed.appointmentDate,
            result,
          });
          return;
        }
      }

      if (request.method === 'POST') {
        const workflowId = pathAppointmentWorkflowId(url.pathname, '/slot');
        if (workflowId) {
          const raw = record(await readJson(request)) ?? {};
          const id = inputId(raw);
          const slotStart = stringField(raw, 'slotStart');
          if (!id || !slotStart) { sendJson(response, 400, { ok: false, code: 'SLOT_SELECTION_INVALID' }); return; }
          const handle = appointmentClient.workflow.getHandle(workflowId);
          const input: SelectAppointmentSlotInput = { inputId: id, slotStart };
          const result = await handle.executeUpdate(selectAppointmentSlotUpdate, { args: [input] });
          const description = await handle.describe();
          sendJson(response, 200, { ok: true, workflowId, runId: description.runId, result });
          return;
        }
      }

      if (request.method === 'POST') {
        const workflowId = pathAppointmentWorkflowId(url.pathname, '/finalize');
        if (workflowId) {
          const raw = record(await readJson(request)) ?? {};
          const id = inputId(raw);
          if (!id) { sendJson(response, 400, { ok: false, code: 'INPUT_ID_REQUIRED' }); return; }
          const handle = appointmentClient.workflow.getHandle(workflowId);
          const input: FinalizeAppointmentInput = { inputId: id };
          const result = await handle.executeUpdate(finalizeAppointmentUpdate, { args: [input] });
          const description = await handle.describe();
          sendJson(response, 200, { ok: true, workflowId, runId: description.runId, result });
          return;
        }
      }

      sendJson(response, 404, { ok: false, code: 'NOT_FOUND' });
    } catch (error) {
      if (workflowAlreadyClosed(error)) {
        sendJson(response, 409, {
          ok: false,
          code: 'WORKFLOW_ALREADY_COMPLETED',
          error: error instanceof Error ? error.message : String(error),
        });
        return;
      }
      sendJson(response, 500, {
        ok: false,
        code: 'CTA_HTTP_INTERNAL_ERROR',
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, () => resolve());
  });

  console.log(`CORE_HTTP_CTA_STARTED ${JSON.stringify({
    host,
    port,
    channel: 'postman',
    attachmentStoreRoot: config.attachmentStoreRoot,
    operations: ['RegisterNewCustomer', 'RegisterNewAppointment'],
    pid: process.pid,
  })}`);

  const shutdown = async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await Promise.all([
      temporalPort.close(),
      appointmentPort.close(),
      closeExecutionEvidenceRepository(),
    ]);
  };

  process.once('SIGTERM', () => void shutdown().then(() => process.exit(0)));
  process.once('SIGINT', () => void shutdown().then(() => process.exit(0)));
}

run().catch((error: unknown) => {
  console.error(`CORE_HTTP_CTA_FAILED ${JSON.stringify({
    error: error instanceof Error ? error.message : String(error),
  })}`);
  process.exitCode = 1;
});
