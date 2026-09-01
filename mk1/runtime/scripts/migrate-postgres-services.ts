import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { Pool } from 'pg';
import { loadRuntimeConfig } from '../src/config/runtime-config.js';

const MIGRATIONS = [
  '../migrations/005_services_engine_contracts.sql',
  '../migrations/006_services_management.sql',
] as const;

async function run(): Promise<void> {
  const config = loadRuntimeConfig();
  const pool = new Pool({ connectionString: config.postgresUrl, max: 1 });
  try {
    for (const relativePath of MIGRATIONS) {
      const migrationPath = fileURLToPath(new URL(relativePath, import.meta.url));
      const sql = await readFile(migrationPath, 'utf8');
      await pool.query(sql);
    }
    console.log('SERVICES_ENGINE_POSTGRES_MIGRATION_OK');
  } finally {
    await pool.end();
  }
}

run().catch((error: unknown) => {
  console.error(`SERVICES_ENGINE_POSTGRES_MIGRATION_FAILED ${JSON.stringify({
    error: error instanceof Error ? error.message : String(error),
  })}`);
  process.exitCode = 1;
});
