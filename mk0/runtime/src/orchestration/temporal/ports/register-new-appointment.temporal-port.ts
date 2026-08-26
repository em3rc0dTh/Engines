import { createHash } from 'node:crypto';
import { Client, Connection } from '@temporalio/client';
import { canonicalJson } from '../../../contracts/register-new-customer/index.js';
import type { RegisterNewAppointmentStartEnvelope } from '../../../contracts/register-new-appointment/index.js';
import { loadRuntimeConfig } from '../../../config/runtime-config.js';
import { assertMk0TemporalTopology, temporalTopologyFrom } from '../topology.js';
import {
  getAppointmentInitialFingerprintQuery,
  registerNewAppointmentWorkflow,
} from '../workflows/register-new-appointment.workflow.js';

function sha256(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

function initialFingerprint(start: RegisterNewAppointmentStartEnvelope): string {
  return canonicalJson({
    operation: start.operation,
    businessSlug: start.businessSlug,
    schemaVersion: start.schemaVersion,
    draft: start.draft ?? {},
  });
}

export function registerNewAppointmentWorkflowId(start: RegisterNewAppointmentStartEnvelope): string {
  const digest = sha256(canonicalJson({
    operation: start.operation,
    businessSlug: start.businessSlug,
    idempotencyKey: start.request.idempotencyKey,
  })).slice(0, 32);
  return `register-appointment:${start.businessSlug}:${digest}`;
}

function alreadyStarted(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const candidate = error as { name?: unknown; message?: unknown };
  return candidate.name === 'WorkflowExecutionAlreadyStartedError'
    || (typeof candidate.message === 'string' && candidate.message.includes('Workflow execution already started'));
}

export class AppointmentSessionIdempotencyConflictError extends Error {
  readonly code = 'APPOINTMENT_SESSION_IDEMPOTENCY_CONFLICT' as const;
  constructor(readonly workflowId: string) {
    super(`Appointment session ${workflowId} already exists with different initial material`);
    this.name = 'AppointmentSessionIdempotencyConflictError';
  }
}

export class TemporalRegisterNewAppointmentPort {
  private constructor(
    private readonly connection: Connection,
    readonly client: Client,
    private readonly taskQueue: string,
  ) {}

  static async connect(): Promise<TemporalRegisterNewAppointmentPort> {
    const config = loadRuntimeConfig();
    const topology = temporalTopologyFrom(config);
    assertMk0TemporalTopology(topology);
    const connection = await Connection.connect({ address: topology.address });
    return new TemporalRegisterNewAppointmentPort(
      connection,
      new Client({ connection, namespace: topology.namespace }),
      topology.taskQueue,
    );
  }

  async start(start: RegisterNewAppointmentStartEnvelope): Promise<Readonly<{ workflowId: string; runId: string }>> {
    const workflowId = registerNewAppointmentWorkflowId(start);
    try {
      const handle = await this.client.workflow.start(registerNewAppointmentWorkflow, {
        workflowId,
        workflowIdReusePolicy: 'REJECT_DUPLICATE',
        taskQueue: this.taskQueue,
        args: [start],
      });
      return { workflowId, runId: handle.firstExecutionRunId };
    } catch (error) {
      if (!alreadyStarted(error)) throw error;
      const handle = this.client.workflow.getHandle(workflowId);
      const existing = await handle.query(getAppointmentInitialFingerprintQuery);
      if (existing !== initialFingerprint(start)) throw new AppointmentSessionIdempotencyConflictError(workflowId);
      const description = await handle.describe();
      return { workflowId, runId: description.runId };
    }
  }

  async close(): Promise<void> {
    await this.connection.close();
  }
}
