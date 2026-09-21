import { executeCliInvocation } from './command.js';

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString('utf8').trim();
}

function invalidJson(message: string): void {
  console.error(
    `CTA_REJECTED ${JSON.stringify({
      ok: false,
      status: 'REJECTED',
      issues: [{ code: 'INVALID_ENVELOPE', path: '$', message }],
    })}`,
  );
  process.exitCode = 2;
}

async function run(): Promise<void> {
  const command = process.argv[2];
  const inlinePayload = process.argv[3];
  const rawPayload = inlinePayload ?? (await readStdin());

  if (!rawPayload) {
    invalidJson('CLI payload JSON is required as argv[3] or stdin');
    return;
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawPayload) as unknown;
  } catch (error: unknown) {
    invalidJson(`CLI payload must be valid JSON: ${error instanceof Error ? error.message : String(error)}`);
    return;
  }

  const result = executeCliInvocation(command, payload);
  if (result.ok) {
    console.log(`CTA_ACCEPTED ${JSON.stringify(result)}`);
    return;
  }

  console.error(`CTA_REJECTED ${JSON.stringify(result)}`);
  process.exitCode = 2;
}

run().catch((error: unknown) => {
  console.error(
    `CTA_FAILED ${JSON.stringify({
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    })}`,
  );
  process.exitCode = 1;
});
