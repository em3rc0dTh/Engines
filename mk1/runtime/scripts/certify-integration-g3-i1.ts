import assert from 'node:assert/strict';
import { Pool } from 'pg';
import { loadRuntimeConfig } from '../src/config/runtime-config.js';
import { PostgresIntegrationRegistryRepository, IntegrationRegistryError } from '../src/persistence/postgres/integration-registry.repository.js';
import type { IntegrationConnection } from '../src/integration/registry.js';

const NOW = '2026-09-16T20:00:00.000Z';

function expectCode(error: unknown, code: string): void {
  assert.ok(error instanceof IntegrationRegistryError, `expected IntegrationRegistryError, got ${String(error)}`);
  assert.equal(error.code, code);
}

async function run(): Promise<void> {
  const config = loadRuntimeConfig();
  const pool = new Pool({ connectionString: config.postgresUrl, max: 4 });
  const repository = new PostgresIntegrationRegistryRepository(pool);

  try {
    await pool.query(`DELETE FROM integration_secret_references WHERE business_slug IN ('i1-business-a','i1-business-b')`);
    await pool.query(`DELETE FROM integration_connections WHERE business_slug IN ('i1-business-a','i1-business-b')`);
    await pool.query(`DELETE FROM integration_providers WHERE provider_kind = 'g3-i1-proof-provider'`);

    const provider = await repository.registerProvider({
      providerKind: 'g3-i1-proof-provider',
      displayName: 'G3 I1 Proof Provider',
      status: 'ENABLED',
      capabilities: ['calendar.create_event', 'calendar.cancel_event'],
      revision: 1,
    });
    assert.equal(provider.providerKind, 'g3-i1-proof-provider');
    assert.deepEqual(provider.capabilities, ['calendar.create_event', 'calendar.cancel_event']);
    console.log('INTEGRATION_G3_I1_PROVIDER_REGISTRY_PASS');

    const connectionA: IntegrationConnection = {
      connectionRef: 'calendar-primary',
      businessSlug: 'i1-business-a',
      providerKind: provider.providerKind,
      externalAccountRef: 'acct-a',
      status: 'ENABLED',
      capabilities: ['calendar.create_event'],
      secretRefs: [{
        secretRef: 'auth-primary',
        purpose: 'provider-auth',
        bindingKind: 'ENV',
        bindingRef: 'I1_BUSINESS_A_CALENDAR_TOKEN',
      }],
      revision: 1,
      createdAt: NOW,
      updatedAt: NOW,
    };

    const connectionB: IntegrationConnection = {
      ...connectionA,
      businessSlug: 'i1-business-b',
      externalAccountRef: 'acct-b',
      secretRefs: [{
        secretRef: 'auth-primary',
        purpose: 'provider-auth',
        bindingKind: 'EXTERNAL_SECRET_STORE',
        bindingRef: 'vault://i1-business-b/calendar-primary',
      }],
    };

    const storedA = await repository.registerConnection(connectionA);
    const storedB = await repository.registerConnection(connectionB);
    assert.equal(storedA.businessSlug, 'i1-business-a');
    assert.equal(storedB.businessSlug, 'i1-business-b');
    assert.equal(storedA.connectionRef, storedB.connectionRef);
    assert.notEqual(storedA.externalAccountRef, storedB.externalAccountRef);
    console.log('INTEGRATION_G3_I1_CONNECTION_REGISTRY_PASS');

    const schema = await pool.query<{ column_name: string }>(
      `SELECT column_name
         FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name IN ('integration_connections','integration_secret_references')`,
    );
    const forbiddenColumns = new Set([
      'secret_value', 'token', 'access_token', 'api_key', 'password',
      'credential', 'credential_value', 'authorization',
    ]);
    assert.equal(schema.rows.some((row) => forbiddenColumns.has(row.column_name)), false);

    const persistedRefs = await pool.query<{ secret_ref: string; binding_ref: string }>(
      `SELECT secret_ref, binding_ref
         FROM integration_secret_references
        WHERE business_slug = $1 AND connection_ref = $2`,
      ['i1-business-a', 'calendar-primary'],
    );
    assert.deepEqual(persistedRefs.rows, [{
      secret_ref: 'auth-primary',
      binding_ref: 'I1_BUSINESS_A_CALENDAR_TOKEN',
    }]);
    assert.equal(JSON.stringify(persistedRefs.rows).includes('literal-secret-value'), false);
    console.log('INTEGRATION_G3_I1_SECRET_REFERENCE_PASS');

    const resolvedA = await repository.resolveConnection(
      'i1-business-a',
      'calendar-primary',
      'calendar.create_event',
    );
    assert.equal(resolvedA.businessSlug, 'i1-business-a');

    await assert.rejects(
      repository.resolveConnection('i1-business-a', 'calendar-primary', 'calendar.cancel_event'),
      (error: unknown) => {
        expectCode(error, 'CAPABILITY_NOT_SUPPORTED');
        return true;
      },
    );
    console.log('INTEGRATION_G3_I1_CAPABILITY_GUARD_PASS');

    const disabledA = await repository.setConnectionStatus(
      'i1-business-a',
      'calendar-primary',
      1,
      'DISABLED',
    );
    assert.equal(disabledA.status, 'DISABLED');
    assert.equal(disabledA.revision, 2);

    await assert.rejects(
      repository.setConnectionStatus('i1-business-a', 'calendar-primary', 1, 'ENABLED'),
      (error: unknown) => {
        expectCode(error, 'CONNECTION_REVISION_CONFLICT');
        return true;
      },
    );
    const afterStaleWrite = await repository.getConnection('i1-business-a', 'calendar-primary');
    assert.equal(afterStaleWrite?.status, 'DISABLED');
    assert.equal(afterStaleWrite?.revision, 2);
    console.log('INTEGRATION_G3_I1_REVISION_GUARD_PASS');

    await assert.rejects(
      repository.resolveConnection('i1-business-a', 'calendar-primary', 'calendar.create_event'),
      (error: unknown) => {
        expectCode(error, 'CONNECTION_DISABLED');
        return true;
      },
    );

    const stillEnabledB = await repository.resolveConnection(
      'i1-business-b',
      'calendar-primary',
      'calendar.create_event',
    );
    assert.equal(stillEnabledB.status, 'ENABLED');

    await assert.rejects(
      repository.resolveConnection('i1-business-c', 'calendar-primary', 'calendar.create_event'),
      (error: unknown) => {
        expectCode(error, 'CONNECTION_NOT_FOUND');
        return true;
      },
    );
    console.log('INTEGRATION_G3_I1_BUSINESS_ISOLATION_PASS');

    await assert.rejects(
      repository.registerConnection({
        ...connectionA,
        connectionRef: 'unsupported-capability',
        businessSlug: 'i1-business-a',
        capabilities: ['payments.capture'],
        secretRefs: [],
      }),
      (error: unknown) => {
        expectCode(error, 'CAPABILITY_NOT_SUPPORTED');
        return true;
      },
    );

    console.log('INTEGRATION_G3_I1_REGISTRY_SEMANTICS_PASS');
    console.log('INTEGRATION_G3_I1_CERTIFICATION_PASS');
  } finally {
    await pool.end();
  }
}

run().catch((error: unknown) => {
  console.error(`INTEGRATION_G3_I1_CERTIFICATION_FAILED ${JSON.stringify({
    error: error instanceof Error ? error.message : String(error),
  })}`);
  process.exitCode = 1;
});
