import type { ContractIssue, RegisterNewCustomerStartEnvelope } from '../../contracts/register-new-customer/index.js';
import { adaptRegisterNewCustomerCtaInput } from '../register-new-customer.adapter.js';

export type CliCommandResult =
  | Readonly<{
      ok: true;
      status: 'READY_FOR_ORCHESTRATION';
      envelope: RegisterNewCustomerStartEnvelope;
    }>
  | Readonly<{
      ok: false;
      status: 'REJECTED';
      issues: readonly ContractIssue[];
    }>;

function invalidCommand(command: string | undefined): CliCommandResult {
  return {
    ok: false,
    status: 'REJECTED',
    issues: [
      {
        code: 'UNKNOWN_OPERATION',
        path: 'command',
        message: command
          ? `unknown CLI command: ${command}`
          : 'CLI command is required; expected register-new-customer',
      },
    ],
  };
}

export function executeCliInvocation(command: string | undefined, payload: unknown): CliCommandResult {
  if (command !== 'register-new-customer') return invalidCommand(command);

  const adapted = adaptRegisterNewCustomerCtaInput(payload, { channel: 'cli' });
  if (!adapted.ok) {
    return { ok: false, status: 'REJECTED', issues: adapted.issues };
  }

  return {
    ok: true,
    status: 'READY_FOR_ORCHESTRATION',
    envelope: adapted.value,
  };
}
