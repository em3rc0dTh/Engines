import assert from 'node:assert/strict';
import { Pool } from 'pg';
import { loadRuntimeConfig } from '../src/config/runtime-config.js';
import type { IntegrationCommand } from '../src/contracts/integration-engine/index.js';
import { PostgresIntegrationRegistryRepository } from '../src/persistence/postgres/integration-registry.repository.js';
import {
  IntegrationOutboundLedgerError,
  PostgresIntegrationOutboundLedger,
} from '../src/persistence/postgres/integration-outbound-ledger.repository.js';

const PROVIDER = 'g3-i2-proof-provider';
const CONNECTION = 'delivery-primary';
const BUSINESS_A = 'i2-business-a';
const BUSINESS_B = 'i2-business-b';

function command(
  businessSlug: string,
  operationId: string,
  commandId: string,
  requestedAt: string,
  messageRef: string,
): IntegrationCommand {
  return {
    schemaVersion: 1,
    commandId,
    operationId,
    businessSlug,
    connectionRef: CONNECTION,
    capability: 'notifications.send',
    action: 'send-notification',
    targetRef: { kind: 'customer', ref: 'customer-001' },
    payload: { messageRef },
    requestedAt,
  };
}

function expectCode(error: unknown, code: string): boolean {
  assert.ok(error instanceof IntegrationOutboundLedgerError, `expected IntegrationOutboundLedgerError, got ${String(error)}`);
  assert.equal(error.code, code);
  return true;
}

async function run(): Promise<void> {
  const config = loadRuntimeConfig();
  const pool = new Pool({ connectionString: config.postgresUrl, max: 12 });
  const registry = new PostgresIntegrationRegistryRepository(pool);
  const ledger = new PostgresIntegrationOutboundLedger(pool);

  try {
    await pool.query(`DELETE FROM integration_outbound_attempts WHERE business_slug IN ($1,$2)`, [BUSINESS_A, BUSINESS_B]);
    await pool.query(`DELETE FROM integration_outbound_commands WHERE business_slug IN ($1,$2)`, [BUSINESS_A, BUSINESS_B]);
    await pool.query(`DELETE FROM integration_secret_references WHERE business_slug IN ($1,$2)`, [BUSINESS_A, BUSINESS_B]);
    await pool.query(`DELETE FROM integration_connections WHERE business_slug IN ($1,$2)`, [BUSINESS_A, BUSINESS_B]);
    await pool.query(`DELETE FROM integration_providers WHERE provider_kind = $1`, [PROVIDER]);

    await registry.registerProvider({
      providerKind: PROVIDER,
      displayName: 'G3 I2 Proof Provider',
      status: 'ENABLED',
      capabilities: ['notifications.send'],
      revision: 1,
    });

    for (const businessSlug of [BUSINESS_A, BUSINESS_B]) {
      await registry.registerConnection({
        connectionRef: CONNECTION,
        businessSlug,
        providerKind: PROVIDER,
        externalAccountRef: `acct-${businessSlug}`,
        status: 'ENABLED',
        capabilities: ['notifications.send'],
        secretRefs: [{
          secretRef: 'auth-primary',
          purpose: 'provider-auth',
          bindingKind: 'ENV',
          bindingRef: businessSlug === BUSINESS_A ? 'I2_BUSINESS_A_TOKEN' : 'I2_BUSINESS_B_TOKEN',
        }],
        revision: 1,
        createdAt: '2026-09-16T20:40:00.000Z',
        updatedAt: '2026-09-16T20:40:00.000Z',
      });
    }

    const initial = command(BUSINESS_A, 'op-retry-success', 'cmd-001', '2026-09-16T20:40:00.000Z', 'message-001');
    const queued = await ledger.enqueue(initial, 3);
    assert.equal(queued.status, 'READY');
    assert.equal(queued.attemptCount, 0);

    const replay = await ledger.enqueue(
      command(BUSINESS_A, 'op-retry-success', 'cmd-replay', '2026-09-16T20:41:00.000Z', 'message-001'),
      3,
    );
    assert.equal(replay.command.commandId, 'cmd-001');
    assert.equal(replay.status, 'READY');

    await assert.rejects(
      ledger.enqueue(command(BUSINESS_A, 'op-retry-success', 'cmd-mutated', '2026-09-16T20:41:00.000Z', 'message-MUTATED'), 3),
      (error: unknown) => expectCode(error, 'IDEMPOTENCY_CONFLICT'),
    );
    console.log('INTEGRATION_G3_I2_ENQUEUE_IDEMPOTENCY_PASS');

    const claims = await Promise.all([
      ledger.claim(BUSINESS_A, 'op-retry-success', '2026-09-16T20:42:00.000Z', 30),
      ledger.claim(BUSINESS_A, 'op-retry-success', '2026-09-16T20:42:00.000Z', 30),
    ]);
    const winners = claims.filter((entry) => entry !== undefined);
    assert.equal(winners.length, 1);
    const firstClaim = winners[0]!;
    assert.equal(firstClaim.attemptNumber, 1);
    console.log('INTEGRATION_G3_I2_ATOMIC_CLAIM_PASS');

    const retryWait = await ledger.complete(firstClaim, {
      kind: 'RETRYABLE',
      errorCode: 'TRANSIENT_PROVIDER_FAILURE',
      nextAttemptAt: '2026-09-16T20:43:00.000Z',
    }, '2026-09-16T20:42:05.000Z');
    assert.equal(retryWait.status, 'RETRY_WAIT');
    assert.equal(await ledger.claim(BUSINESS_A, 'op-retry-success', '2026-09-16T20:42:59.000Z', 30), undefined);

    const secondClaim = await ledger.claim(BUSINESS_A, 'op-retry-success', '2026-09-16T20:43:00.000Z', 30);
    assert.ok(secondClaim);
    assert.equal(secondClaim.attemptNumber, 2);
    const succeeded = await ledger.complete(secondClaim, {
      kind: 'SUCCEEDED',
      providerReceiptRef: 'provider-receipt-001',
    }, '2026-09-16T20:43:05.000Z');
    assert.equal(succeeded.status, 'SUCCEEDED');
    assert.equal(succeeded.providerReceiptRef, 'provider-receipt-001');
    assert.equal(succeeded.attemptCount, 2);
    assert.equal((await ledger.listAttempts(BUSINESS_A, 'op-retry-success')).length, 2);

    const terminalReplay = await ledger.enqueue(
      command(BUSINESS_A, 'op-retry-success', 'cmd-terminal-replay', '2026-09-16T20:44:00.000Z', 'message-001'),
      3,
    );
    assert.equal(terminalReplay.status, 'SUCCEEDED');
    assert.equal((await ledger.listAttempts(BUSINESS_A, 'op-retry-success')).length, 2);
    console.log('INTEGRATION_G3_I2_RETRY_SCHEDULE_PASS');

    await ledger.enqueue(command(BUSINESS_A, 'op-exhaust', 'cmd-exhaust', '2026-09-16T21:00:00.000Z', 'message-exhaust'), 2);
    const exhaust1 = await ledger.claim(BUSINESS_A, 'op-exhaust', '2026-09-16T21:00:01.000Z', 30);
    assert.ok(exhaust1);
    await ledger.complete(exhaust1, {
      kind: 'RETRYABLE',
      errorCode: 'RATE_LIMITED',
      nextAttemptAt: '2026-09-16T21:01:00.000Z',
    }, '2026-09-16T21:00:05.000Z');
    const exhaust2 = await ledger.claim(BUSINESS_A, 'op-exhaust', '2026-09-16T21:01:00.000Z', 30);
    assert.ok(exhaust2);
    const exhausted = await ledger.complete(exhaust2, {
      kind: 'RETRYABLE',
      errorCode: 'TRANSIENT_PROVIDER_FAILURE',
      nextAttemptAt: '2026-09-16T21:02:00.000Z',
    }, '2026-09-16T21:01:05.000Z');
    assert.equal(exhausted.status, 'FAILED_PERMANENT');
    assert.equal(exhausted.attemptCount, 2);
    assert.equal(await ledger.claim(BUSINESS_A, 'op-exhaust', '2026-09-16T21:03:00.000Z', 30), undefined);
    console.log('INTEGRATION_G3_I2_BOUNDED_RETRY_PASS');

    await ledger.enqueue(command(BUSINESS_A, 'op-lease', 'cmd-lease', '2026-09-16T22:00:00.000Z', 'message-lease'), 3);
    const lease1 = await ledger.claim(BUSINESS_A, 'op-lease', '2026-09-16T22:00:01.000Z', 10);
    assert.ok(lease1);
    assert.equal(await ledger.claim(BUSINESS_A, 'op-lease', '2026-09-16T22:00:10.000Z', 10), undefined);
    const lease2 = await ledger.claim(BUSINESS_A, 'op-lease', '2026-09-16T22:00:12.000Z', 10);
    assert.ok(lease2);
    assert.equal(lease2.attemptNumber, 2);
    await ledger.complete(lease2, { kind: 'SUCCEEDED' }, '2026-09-16T22:00:15.000Z');
    const leaseAttempts = await ledger.listAttempts(BUSINESS_A, 'op-lease');
    assert.equal(leaseAttempts[0]?.outcome, 'LEASE_EXPIRED');
    assert.equal(leaseAttempts[1]?.outcome, 'SUCCEEDED');
    console.log('INTEGRATION_G3_I2_LEASE_RECOVERY_PASS');

    const sameOperationOtherBusiness = await ledger.enqueue(
      command(BUSINESS_B, 'op-retry-success', 'cmd-business-b', '2026-09-16T23:00:00.000Z', 'message-business-b'),
      3,
    );
    assert.equal(sameOperationOtherBusiness.command.businessSlug, BUSINESS_B);
    assert.equal(sameOperationOtherBusiness.status, 'READY');
    assert.equal((await ledger.get(BUSINESS_A, 'op-retry-success'))?.status, 'SUCCEEDED');
    console.log('INTEGRATION_G3_I2_BUSINESS_ISOLATION_PASS');

    const schema = await pool.query<{ column_name: string }>(
      `SELECT column_name
         FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name IN ('integration_outbound_commands','integration_outbound_attempts')`,
    );
    const forbidden = new Set(['token','access_token','api_key','password','secret_value','credential','authorization','raw_response']);
    assert.equal(schema.rows.some((row) => forbidden.has(row.column_name)), false);
    console.log('INTEGRATION_G3_I2_SECRET_BOUNDARY_PASS');

    console.log('INTEGRATION_G3_I2_DURABLE_OUTBOUND_PASS');
    console.log('INTEGRATION_G3_I2_CERTIFICATION_PASS');
  } finally {
    await pool.end();
  }
}

run().catch((error: unknown) => {
  console.error(`INTEGRATION_G3_I2_CERTIFICATION_FAILED ${JSON.stringify({
    error: error instanceof Error ? error.message : String(error),
  })}`);
  process.exitCode = 1;
});
