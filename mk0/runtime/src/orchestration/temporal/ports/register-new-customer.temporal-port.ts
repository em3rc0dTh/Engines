import { createHash } from 'node:crypto';
import { Client, Connection } from '@temporalio/client';
import type {
  RegisterNewCustomerOrchestrationPort,
  RegistrationStartReceipt,
} from '../../../cta/orchestration-port.js';
import {
  canonicalJson,
  buildRegistrationSessionIdentityMaterial,
  serializeInitialStartFingerprintMaterial,
  type RegisterNewCustomerStartEnvelope,
} from '../../../contracts/register-new-customer/index.js';
import { loadRuntimeConfig } from '../../../config/runtime-config.js';
import { assertMk0TemporalTopology, temporalTopologyFrom } from '../topology.js';
import {
  getInitialStartFingerprintQuery,
  registerNewCustomerWorkflow,
} from '../workflows/register-new-customer.workflow.js';

function sha256Hex(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

export class SessionIdempotencyConflictError extends Error {
  readonly code = 'SESSION_IDEMPOTENCY_CONFLICT' as const;
  constructor(readonly workflowId: string) {
    super(`Business-scoped registration session ${workflowId} already exists with different initial-start material`);
    this.name = 'SessionIdempotencyConflictError';
  }
}

export function registerNewCustomerWorkflowId(start: RegisterNewCustomerStartEnvelope): string {
  const identity = buildRegistrationSessionIdentityMaterial(start);
  const digest = sha256Hex(canonicalJson(identity)).slice(0, 32);
  return `register-customer:${start.businessSlug}:${digest}`;
}

function isAlreadyStartedError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const candidate = error as { name?: unknown; message?: unknown };
  return (
    candidate.name === 'WorkflowExecutionAlreadyStartedError' ||
    (typeof candidate.message === 'string' && candidate.message.includes('Workflow execution already started'))
  );
}

export class TemporalRegisterNewCustomerPort implements RegisterNewCustomerOrchestrationPort {
  private constructor(
    private readonly connection: Connection,
    private readonly client: Client,
    private readonly taskQueue: string,
  ) {}

  static async connect(): Promise<TemporalRegisterNewCustomerPort> {
    const config = loadRuntimeConfig();
    const topology = temporalTopologyFrom(config);
    assertMk0TemporalTopology(topology);

    const connection = await Connection.connect({ address: topology.address });
    const client = new Client({ connection, namespace: topology.namespace });
    return new TemporalRegisterNewCustomerPort(connection, client, topology.taskQueue);
  }

  async startRegisterNewCustomer(
    envelope: RegisterNewCustomerStartEnvelope,
  ): Promise<RegistrationStartReceipt> {
    const workflowId = registerNewCustomerWorkflowId(envelope);

    try {
      const handle = await this.client.workflow.start(registerNewCustomerWorkflow, {
        workflowId,
        taskQueue: this.taskQueue,
        args: [envelope],
      });

      return {
        workflowId,
        runId: handle.firstExecutionRunId,
      };
    } catch (error) {
      if (!isAlreadyStartedError(error)) throw error;

      const existing = this.client.workflow.getHandle(workflowId);
      const existingFingerprint = await existing.query(getInitialStartFingerprintQuery);
      const incomingFingerprint = serializeInitialStartFingerprintMaterial(envelope);

      if (existingFingerprint !== incomingFingerprint) {
        throw new SessionIdempotencyConflictError(workflowId);
      }

      const description = await existing.describe();
      return {
        workflowId,
        runId: description.runId,
      };
    }
  }

  getClient(): Client {
    return this.client;
  }

  async close(): Promise<void> {
    await this.connection.close();
  }
}
