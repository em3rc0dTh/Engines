import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { Client, Connection } from '@temporalio/client';
import { MongoClient } from 'mongodb';
import { Pool } from 'pg';
import { loadRuntimeConfig } from '../src/config/runtime-config.js';
import type {
  ServicesMutationCommand,
  ServicesMutationOutcome,
} from '../src/contracts/services-engine/index.js';

async function run(): Promise<void> {
  const config = loadRuntimeConfig();
  const connection = await Connection.connect({ address: config.temporalAddress });
  const client = new Client({ connection, namespace: config.temporalNamespace });
  const pool = new Pool({ connectionString: config.postgresUrl, max: 2 });
  const mongo = new MongoClient(config.mongoUrl, { maxPoolSize: 2 });
  await mongo.connect();

  async function execute(label: string, command: ServicesMutationCommand): Promise<Readonly<{
    workflowId: string;
    outcome: ServicesMutationOutcome;
  }>> {
    const workflowId = `mk1-s4-safety:${label}:${randomUUID()}`;
    const outcome = await client.workflow.execute<
      (input: ServicesMutationCommand) => Promise<ServicesMutationOutcome>
    >('servicesManagementWorkflow', {
      workflowId,
      taskQueue: config.temporalTaskQueue,
      args: [command],
    });
    return { workflowId, outcome };
  }

  const service = await execute('service', {
    operation: 'CreateService',
    businessSlug: 's4-safety-business',
    idempotencyKey: 's4-safety-service',
    service: {
      serviceId: 'svc_s4_safety',
      code: 'safety-service',
      name: 'Safety Service',
      tags: ['safety'],
    },
  });
  assert.equal(service.outcome.status, 'APPLIED');

  const rejected = await execute('missing-dependency', {
    operation: 'CreateOffering',
    businessSlug: 's4-safety-business',
    idempotencyKey: 's4-safety-missing-dependency',
    offering: {
      offeringId: 'off_s4_must_not_exist',
      serviceId: 'svc_s4_safety',
      code: 'must-not-exist',
      name: 'Must Not Exist',
      durationMinutes: 30,
      pricing: { kind: 'FREE' },
      priority: 0,
      tags: [],
      requirements: [],
      dependencies: [
        { relation: 'REQUIRES', targetOfferingId: 'off_missing_dependency_target' },
      ],
    },
  });
  assert.equal(rejected.outcome.status, 'REJECTED');
  if (rejected.outcome.status !== 'REJECTED') throw new Error('S4_SAFETY_EXPECTED_REJECTION');
  assert.equal(rejected.outcome.code, 'NOT_FOUND');

  const offeringCount = await pool.query<{ count: string }>(
    `SELECT COUNT(*)::text AS count
       FROM service_products
      WHERE business_slug = 's4-safety-business'
        AND product_id = 'off_s4_must_not_exist'`,
  );
  assert.equal(Number(offeringCount.rows[0]!.count), 0);

  const commandCount = await pool.query<{ count: string }>(
    `SELECT COUNT(*)::text AS count
       FROM service_mutation_commands
      WHERE business_slug = 's4-safety-business'
        AND entity_id = 'off_s4_must_not_exist'`,
  );
  assert.equal(Number(commandCount.rows[0]!.count), 0);

  const audit = mongo.db(config.mongoDb).collection('services_mutation_audit');
  const auditDocument = await audit.findOne({ workflowId: rejected.workflowId });
  assert.ok(auditDocument);
  assert.equal(auditDocument.outcomeStatus, 'REJECTED');
  assert.equal(auditDocument.outcomeCode, 'NOT_FOUND');

  console.log(`SERVICES_S4_REJECTION_SAFETY_PASS ${JSON.stringify({
    missingDependencyRejected: true,
    partialOfferingCreated: false,
    mutationCommandPersisted: false,
    auditPersisted: true,
  })}`);

  await mongo.close();
  await pool.end();
  await connection.close();
}

run().catch((error: unknown) => {
  console.error(`SERVICES_S4_REJECTION_SAFETY_FAILED ${JSON.stringify({
    error: error instanceof Error ? error.stack ?? error.message : String(error),
  })}`);
  process.exitCode = 1;
});
