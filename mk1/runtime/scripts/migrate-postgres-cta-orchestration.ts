import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { Pool } from 'pg';
import { loadRuntimeConfig } from '../src/config/runtime-config.js';

async function run(): Promise<void> {
  const pool = new Pool({ connectionString: loadRuntimeConfig().postgresUrl, max: 1 });
  try {
    const path = fileURLToPath(new URL('../migrations/008_cta_orchestration_persistence.sql', import.meta.url));
    await pool.query(await readFile(path, 'utf8'));
    console.log('CTA_ORCHESTRATION_POSTGRES_MIGRATION_OK');
  } finally { await pool.end(); }
}

run().catch((error: unknown) => {
  console.error(`CTA_ORCHESTRATION_POSTGRES_MIGRATION_FAILED ${JSON.stringify({
    error: error instanceof Error ? error.message : String(error),
  })}`);
  process.exitCode = 1;
});
