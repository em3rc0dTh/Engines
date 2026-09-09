import assert from 'node:assert/strict';
import { Pool } from 'pg';
import { loadRuntimeConfig } from '../src/config/runtime-config.js';
import {
  closeManagedEntityRepository,
  createManagedEntityForCustomer,
  getManagedEntityForCustomer,
  listManagedEntitiesForCustomer,
} from '../src/persistence/postgres/managed-entity.repository.js';

async function run(): Promise<void> {
  const config = loadRuntimeConfig();
  const pool = new Pool({ connectionString: config.postgresUrl, max: 1 });
  const businessSlug = 'me1-cert-business';
  const customerId = 'cus_me1_cert';
  const otherCustomerId = 'cus_me1_other';

  try {
    await pool.query('BEGIN');
    await pool.query(`DELETE FROM managed_entities WHERE business_slug = $1`, [businessSlug]);
    await pool.query(`DELETE FROM customers WHERE business_slug = $1`, [businessSlug]);
    await pool.query(
      `INSERT INTO customers (customer_id,business_slug,customer_type,customer_name,status)
       VALUES ($1,$2,'PERSON','ME1 Cert Customer','ACTIVE'),
              ($3,$2,'PERSON','ME1 Other Customer','ACTIVE')`,
      [customerId, businessSlug, otherCustomerId],
    );
    await pool.query('COMMIT');

    assert.deepEqual(await listManagedEntitiesForCustomer(businessSlug, customerId, 'vehicle'), []);

    const first = await createManagedEntityForCustomer({
      businessSlug,
      customerId,
      type: 'vehicle',
      displayName: 'Renault Logan 2018',
      summary: 'Renault Logan · ABC-123',
      externalRef: 'ABC-123',
      data: { plate: 'ABC-123', brand: 'Renault', model: 'Logan', year: 2018 },
    });
    assert.equal(first.kind, 'CREATED');
    if (first.kind !== 'CREATED') throw new Error('ME1_CERT_FIRST_NOT_CREATED');

    const replay = await createManagedEntityForCustomer({
      businessSlug,
      customerId,
      type: 'vehicle',
      displayName: 'Renault Logan 2018',
      summary: 'Renault Logan · ABC-123',
      externalRef: 'abc-123',
      data: { plate: 'ABC-123', brand: 'Renault', model: 'Logan', year: 2018 },
    });
    assert.equal(replay.kind, 'EXISTING');
    if (replay.kind !== 'EXISTING') throw new Error('ME1_CERT_REPLAY_NOT_EXISTING');
    assert.equal(replay.managedEntity.managedEntityId, first.managedEntity.managedEntityId);

    const conflict = await createManagedEntityForCustomer({
      businessSlug,
      customerId,
      type: 'vehicle',
      displayName: 'Different vehicle material',
      externalRef: 'ABC-123',
      data: { plate: 'ABC-123' },
    });
    assert.deepEqual(conflict, {
      kind: 'CONFLICT',
      managedEntityId: first.managedEntity.managedEntityId,
    });

    const second = await createManagedEntityForCustomer({
      businessSlug,
      customerId,
      type: 'vehicle',
      displayName: 'Nissan Sentra 2020',
      externalRef: 'XYZ-789',
      data: { plate: 'XYZ-789', brand: 'Nissan', model: 'Sentra', year: 2020 },
    });
    assert.equal(second.kind, 'CREATED');

    const listed = await listManagedEntitiesForCustomer(businessSlug, customerId, 'vehicle');
    assert.equal(listed.length, 2);
    assert.deepEqual(listed.map((item) => item.displayName), ['Renault Logan 2018', 'Nissan Sentra 2020']);

    const owned = await getManagedEntityForCustomer(
      businessSlug,
      customerId,
      first.managedEntity.managedEntityId,
    );
    assert.equal(owned?.customerId, customerId);

    const foreignLookup = await getManagedEntityForCustomer(
      businessSlug,
      otherCustomerId,
      first.managedEntity.managedEntityId,
    );
    assert.equal(foreignLookup, undefined);

    console.log('MANAGED_ENTITY_ME1_PERSISTENCE_PASS');
    console.log(JSON.stringify({
      businessSlug,
      customerId,
      firstManagedEntityId: first.managedEntity.managedEntityId,
      candidateCount: listed.length,
      replaySameId: replay.managedEntity.managedEntityId === first.managedEntity.managedEntityId,
      conflictRejected: conflict.kind === 'CONFLICT',
      ownershipIsolation: foreignLookup === undefined,
    }));
  } finally {
    await closeManagedEntityRepository();
    await pool.end();
  }
}

run().catch((error: unknown) => {
  console.error(`MANAGED_ENTITY_ME1_PERSISTENCE_FAILED ${JSON.stringify({
    error: error instanceof Error ? error.message : String(error),
  })}`);
  process.exitCode = 1;
});
