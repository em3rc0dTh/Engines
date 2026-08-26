import { executeCliInvocation } from '../../../cta/cli/command.js';
import { TemporalRegisterNewCustomerPort } from '../ports/register-new-customer.temporal-port.js';

function requiredPayload(): unknown {
  const raw = process.argv[2]?.trim();
  if (!raw) throw new Error('B4 start requires CLI payload JSON as argv[2]');
  return JSON.parse(raw) as unknown;
}

async function run(): Promise<void> {
  const payload = requiredPayload();
  const cli = executeCliInvocation('register-new-customer', payload);

  if (!cli.ok) {
    console.error(`B4_CTA_REJECTED ${JSON.stringify(cli)}`);
    process.exitCode = 2;
    return;
  }

  const port = await TemporalRegisterNewCustomerPort.connect();
  try {
    const receipt = await port.startRegisterNewCustomer(cli.envelope);
    console.log(
      `B4_WORKFLOW_ACCEPTED ${JSON.stringify({
        ok: true,
        ctaStatus: cli.status,
        workflowId: receipt.workflowId,
        runId: receipt.runId,
        businessSlug: cli.envelope.businessSlug,
        channel: cli.envelope.request.channel,
        correlationId: cli.envelope.request.correlationId,
      })}`,
    );
  } finally {
    await port.close();
  }
}

run().catch((error: unknown) => {
  const candidate = error as { code?: unknown };
  console.error(
    `B4_WORKFLOW_START_FAILED ${JSON.stringify({
      ok: false,
      ...(typeof candidate?.code === 'string' ? { code: candidate.code } : {}),
      error: error instanceof Error ? error.message : String(error),
    })}`,
  );
  process.exitCode = 1;
});
