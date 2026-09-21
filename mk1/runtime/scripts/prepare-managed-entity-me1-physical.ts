import { Pool, type PoolClient } from 'pg';
import { loadRuntimeConfig } from '../src/config/runtime-config.js';

const BUSINESS_SLUG = 'golden-business';

const CASE_A = {
  customerId: 'cus_me1_phys_unique',
  name: 'ME1 Unique Customer',
  email: 'me1.unique@example.test',
  logan: {
    managedEntityId: 'men_me1_phys_logan',
    type: 'vehicle',
    displayName: 'Renault Logan 2018',
    summary: 'Renault Logan 2018 · ME1-LGN-2018',
    externalRef: 'ME1-LGN-2018',
    data: { plate: 'ME1-LGN-2018', brand: 'Renault', model: 'Logan', year: 2018 },
  },
  sentra: {
    managedEntityId: 'men_me1_phys_sentra',
    type: 'vehicle',
    displayName: 'Nissan Sentra 2020',
    summary: 'Nissan Sentra 2020 · ME1-SNT-2020',
    externalRef: 'ME1-SNT-2020',
    data: { plate: 'ME1-SNT-2020', brand: 'Nissan', model: 'Sentra', year: 2020 },
  },
} as const;

const CASE_B = {
  name: 'ME1 New Customer 20260914',
  email: 'me1.new.20260914@example.test',
} as const;

const CASE_C = {
  name: 'ME1 Duplicate Customer',
  a: {
    customerId: 'cus_me1_phys_duplicate_a',
    email: 'me1.duplicate.a@example.test',
  },
  b: {
    customerId: 'cus_me1_phys_duplicate_b',
    email: 'me1.duplicate.b@example.test',
  },
} as const;

function normalizedNameSql(column: string): string {
  return `regexp_replace(lower(btrim(${column})), '[[:space:]]+', ' ', 'g')`;
}

async function assertCaseBIsFresh(client: PoolClient): Promise<void> {
  const result = await client.query<{ customer_id: string; customer_name: string | null; email_normalized: string | null }>(
    `SELECT c.customer_id, c.customer_name, cc.email_normalized
       FROM customers c
       LEFT JOIN customer_contacts cc
         ON cc.customer_id = c.customer_id
        AND cc.business_slug = c.business_slug
      WHERE c.business_slug = $1
        AND c.status = 'ACTIVE'
        AND (
          ${normalizedNameSql('c.customer_name')} = ${normalizedNameSql('$2::text')}
          OR lower(btrim(COALESCE(cc.email_normalized, ''))) = lower(btrim($3))
        )
      ORDER BY c.customer_id`,
    [BUSINESS_SLUG, CASE_B.name, CASE_B.email],
  );

  if (result.rows.length > 0) {
    const ids = result.rows.map((row) => row.customer_id).join(', ');
    throw new Error(
      `ME1_PHYSICAL_CASE_B_DIRTY:${ids}. Case B must start with no matching Customer. ` +
      'Reset the local test stack/volumes before preparing the physical gate again.',
    );
  }
}

async function upsertCustomer(
  client: PoolClient,
  input: Readonly<{ customerId: string; name: string; email: string }>,
): Promise<void> {
  await client.query(
    `INSERT INTO customers (customer_id, business_slug, customer_type, customer_name, status)
     VALUES ($1, $2, 'PERSON', $3, 'ACTIVE')
     ON CONFLICT (customer_id) DO UPDATE
       SET business_slug = EXCLUDED.business_slug,
           customer_type = EXCLUDED.customer_type,
           customer_name = EXCLUDED.customer_name,
           status = 'ACTIVE',
           updated_at = NOW()`,
    [input.customerId, BUSINESS_SLUG, input.name],
  );

  await client.query(
    `INSERT INTO customer_contacts (customer_id, business_slug, email_normalized)
     VALUES ($1, $2, lower(btrim($3)))
     ON CONFLICT (customer_id) DO UPDATE
       SET business_slug = EXCLUDED.business_slug,
           email_normalized = EXCLUDED.email_normalized,
           updated_at = NOW()`,
    [input.customerId, BUSINESS_SLUG, input.email],
  );
}

async function upsertManagedEntity(
  client: PoolClient,
  customerId: string,
  input: Readonly<{
    managedEntityId: string;
    type: string;
    displayName: string;
    summary: string;
    externalRef: string;
    data: Readonly<Record<string, unknown>>;
  }>,
): Promise<void> {
  await client.query(
    `INSERT INTO managed_entities (
       managed_entity_id, business_slug, customer_id, entity_type, external_ref,
       status, display_name, summary, data_json
     ) VALUES ($1,$2,$3,$4,$5,'ACTIVE',$6,$7,$8::jsonb)
     ON CONFLICT (managed_entity_id) DO UPDATE
       SET business_slug = EXCLUDED.business_slug,
           customer_id = EXCLUDED.customer_id,
           entity_type = EXCLUDED.entity_type,
           external_ref = EXCLUDED.external_ref,
           status = 'ACTIVE',
           display_name = EXCLUDED.display_name,
           summary = EXCLUDED.summary,
           data_json = EXCLUDED.data_json,
           updated_at = NOW()`,
    [
      input.managedEntityId,
      BUSINESS_SLUG,
      customerId,
      input.type,
      input.externalRef,
      input.displayName,
      input.summary,
      JSON.stringify(input.data),
    ],
  );
}

async function verifyPreparedState(client: PoolClient): Promise<void> {
  const unique = await client.query<{ customer_id: string }>(
    `SELECT customer_id
       FROM customers
      WHERE business_slug = $1
        AND status = 'ACTIVE'
        AND ${normalizedNameSql('customer_name')} = ${normalizedNameSql('$2::text')}
      ORDER BY customer_id`,
    [BUSINESS_SLUG, CASE_A.name],
  );
  if (unique.rows.length !== 1 || unique.rows[0]!.customer_id !== CASE_A.customerId) {
    throw new Error('ME1_PHYSICAL_CASE_A_NOT_UNIQUE');
  }

  const vehicles = await client.query<{ managed_entity_id: string }>(
    `SELECT managed_entity_id
       FROM managed_entities
      WHERE business_slug = $1
        AND customer_id = $2
        AND entity_type = 'vehicle'
        AND status = 'ACTIVE'
      ORDER BY managed_entity_id`,
    [BUSINESS_SLUG, CASE_A.customerId],
  );
  const vehicleIds = new Set(vehicles.rows.map((row) => row.managed_entity_id));
  if (!vehicleIds.has(CASE_A.logan.managedEntityId) || !vehicleIds.has(CASE_A.sentra.managedEntityId)) {
    throw new Error('ME1_PHYSICAL_CASE_A_VEHICLES_MISSING');
  }

  const duplicate = await client.query<{ customer_id: string }>(
    `SELECT customer_id
       FROM customers
      WHERE business_slug = $1
        AND status = 'ACTIVE'
        AND ${normalizedNameSql('customer_name')} = ${normalizedNameSql('$2::text')}
      ORDER BY customer_id`,
    [BUSINESS_SLUG, CASE_C.name],
  );
  if (duplicate.rows.length !== 2) throw new Error(`ME1_PHYSICAL_CASE_C_EXPECTED_TWO:${duplicate.rows.length}`);
}

async function run(): Promise<void> {
  const config = loadRuntimeConfig();
  const pool = new Pool({ connectionString: config.postgresUrl, max: 1 });
  const client = await pool.connect();

  try {
    await assertCaseBIsFresh(client);
    await client.query('BEGIN');

    await upsertCustomer(client, {
      customerId: CASE_A.customerId,
      name: CASE_A.name,
      email: CASE_A.email,
    });
    await upsertManagedEntity(client, CASE_A.customerId, CASE_A.logan);
    await upsertManagedEntity(client, CASE_A.customerId, CASE_A.sentra);

    await upsertCustomer(client, {
      customerId: CASE_C.a.customerId,
      name: CASE_C.name,
      email: CASE_C.a.email,
    });
    await upsertCustomer(client, {
      customerId: CASE_C.b.customerId,
      name: CASE_C.name,
      email: CASE_C.b.email,
    });

    await client.query('COMMIT');
    await verifyPreparedState(client);

    console.log('ME1_PHYSICAL_FIXTURES_READY');
    console.log(JSON.stringify({
      businessSlug: BUSINESS_SLUG,
      caseA: {
        name: CASE_A.name,
        expectedCustomerId: CASE_A.customerId,
        vehicles: [CASE_A.logan.displayName, CASE_A.sentra.displayName],
        selectForCarWash: CASE_A.logan.displayName,
      },
      caseB: {
        name: CASE_B.name,
        email: CASE_B.email,
        expected: 'name miss -> email -> deterministic Customer creation -> ManagedEntity creation',
      },
      caseC: {
        name: CASE_C.name,
        emailToUse: CASE_C.b.email,
        expectedCustomerId: CASE_C.b.customerId,
      },
    }, null, 2));
  } catch (error) {
    try { await client.query('ROLLBACK'); } catch { /* transaction may already be closed */ }
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch((error: unknown) => {
  console.error(`ME1_PHYSICAL_FIXTURES_FAILED ${JSON.stringify({
    error: error instanceof Error ? error.message : String(error),
  })}`);
  process.exitCode = 1;
});
