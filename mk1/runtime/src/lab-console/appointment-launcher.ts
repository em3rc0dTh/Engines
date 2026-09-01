import { stdout as output } from 'node:process';
import { waitForCtaHealth } from './wait-for-cta.js';

async function launch(): Promise<void> {
  const baseUrl = (process.env.ENGINES_CTA_URL ?? 'http://127.0.0.1:8787').replace(/\/$/, '');
  output.write(`Waiting for ENGINES CTA at ${baseUrl} ...\n`);
  const ready = await waitForCtaHealth({ baseUrl });
  output.write(`✓ CTA ready after ${ready.elapsedMs}ms (${ready.attempts} attempt${ready.attempts === 1 ? '' : 's'})\n`);
  await import('./appointment-main.js');
}

launch().catch((error: unknown) => {
  console.error(`APPOINTMENT_LAB_CONSOLE_LAUNCH_FAILED ${error instanceof Error ? error.stack ?? error.message : String(error)}`);
  process.exitCode = 1;
});
