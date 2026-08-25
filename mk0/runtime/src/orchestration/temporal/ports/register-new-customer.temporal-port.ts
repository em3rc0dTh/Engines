import { createHash } from 'node:crypto';
import { Client, Connection } from '@temporalio/client';
import type {
  RegisterNewCustomerOrchestrationPort,
  RegistrationStartReceipt,
} from '../../../cta/orchestration-port.js';
import {
  canonicalJson,
  buildRegistrationSessionIdentityMaterial,
  type RegisterNewCustomerStartEnvelope,
} from '../../../contracts/register-new-customer/index.js';
import { loadRuntimeConfig } from '../../../config/runtime-config.js';
import { assertMk0TemporalTopology, temporalTopologyFrom } from '../topology.js';
import { registerNewCustomerWorkflow } from '../workflows/register-new-customer.workflow.js';

function sha256Hex(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

export function registerNewCustomerWorkflowId(start: RegisterNewCustomerStartEnvelope): string {
  const identity = buildRegistrationSessionIdentityMaterial(start);
  const digest = sha256Hex(canonicalJson(identity)).slice(0, 32);
  return `register-customer:${start.businessSlug}:${digest}`;
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
    const handle = await this.client.workflow.start(registerNewCustomerWorkflow, {
      workflowId,
      taskQueue: this.taskQueue,
      args: [envelope],
    });

    return {
      workflowId,
      runId: handle.firstExecutionRunId,
    };
  }

  getClient(): Client {
    return this.client;
  }

  async close(): Promise<void> {
    await this.connection.close();
  }
}
