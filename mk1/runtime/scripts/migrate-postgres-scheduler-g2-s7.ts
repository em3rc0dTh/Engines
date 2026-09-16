import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { Pool } from 'pg';
import { loadRuntimeConfig } from '../src/config/runtime-config.js';

async function run(): Promise<void> {
  const config = loadRuntimeConfig();
  const pool = new Pool({ connectionString: config.postgresUrl, max: 1 });
  const migrationPath = fileURLToPath(
    new URL('../migrations/011_appointment_scheduler_reservation_link.sql', import.meta.url),
  );
  const sql = await readFile(migrationPath, 'utf8');
  try {
    await pool.query(sql);
    console.log('SCHEDULER_G2_S7_APPOINTMENT_MIGRATION_OK');
  } finally {
    await pool.end();
  }
}

run().catch((error: unknown) => {
  console.error(`SCHEDULER_G2_S7_APPOINTMENT_MIGRATION_FAILED ${JSON.stringify({
    error: error instanceof Error ? error.message : String(error),
  })}`);
  process.exitCode = 1;
});
