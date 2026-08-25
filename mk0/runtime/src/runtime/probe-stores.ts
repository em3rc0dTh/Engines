import { MongoClient } from 'mongodb';
import pg from 'pg';
import { loadRuntimeConfig } from '../config/runtime-config.js';

async function probePostgres(postgresUrl: string): Promise<void> {
  const client = new pg.Client({ connectionString: postgresUrl });
  await client.connect();

  try {
    const result = await client.query<{ ok: number }>('select 1 as ok');
    if (result.rows[0]?.ok !== 1) {
      throw new Error('PostgreSQL probe returned an unexpected result');
    }

    console.log(JSON.stringify({ event: 'B0_POSTGRES_OK' }));
  } finally {
    await client.end();
  }
}

async function probeMongo(mongoUrl: string, mongoDb: string): Promise<void> {
  const client = new MongoClient(mongoUrl);
  await client.connect();

  try {
    const result = await client.db(mongoDb).command({ ping: 1 });
    if (result.ok !== 1) {
      throw new Error('MongoDB probe returned an unexpected result');
    }

    console.log(JSON.stringify({ event: 'B0_MONGO_OK', database: mongoDb }));
  } finally {
    await client.close();
  }
}

async function run(): Promise<void> {
  const config = loadRuntimeConfig();
  await probePostgres(config.postgresUrl);
  await probeMongo(config.mongoUrl, config.mongoDb);
  console.log(JSON.stringify({ event: 'B0_STORES_SMOKE_OK' }));
}

run().catch((error: unknown) => {
  console.error(
    JSON.stringify({
      event: 'B0_STORES_SMOKE_FAILED',
      error: error instanceof Error ? error.message : String(error),
    }),
  );
  process.exitCode = 1;
});
