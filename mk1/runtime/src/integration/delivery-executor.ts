import type { IntegrationErrorCode } from '../contracts/integration-engine/index.js';
import type {
  IntegrationDeliveryClaim,
  IntegrationDeliveryOutcome,
  IntegrationOutboundCommandRecord,
} from './outbound.js';
import {
  IntegrationProviderAdapterRegistry,
  IntegrationProviderError,
  type IntegrationProviderDeliveryResult,
} from './provider.js';
import type { IntegrationConnection } from './registry.js';
import { IntegrationSecretResolutionError } from './secret-resolution.js';

export interface IntegrationDeliveryConnectionResolver {
  resolveConnection(
    businessSlug: string,
    connectionRef: string,
    capability: string,
  ): Promise<IntegrationConnection>;
}

export interface IntegrationDeliveryLedger {
  get(businessSlug: string, operationId: string): Promise<IntegrationOutboundCommandRecord | undefined>;
  claim(
    businessSlug: string,
    operationId: string,
    now: string,
    leaseSeconds?: number,
  ): Promise<IntegrationDeliveryClaim | undefined>;
  complete(
    claim: IntegrationDeliveryClaim,
    outcome: IntegrationDeliveryOutcome,
    finishedAt: string,
  ): Promise<IntegrationOutboundCommandRecord>;
}

function retryDelayMs(attemptNumber: number): number {
  return Math.min(300_000, 5_000 * (2 ** Math.max(0, attemptNumber - 1)));
}

function retryable(code: IntegrationErrorCode): boolean {
  return code === 'RATE_LIMITED'
    || code === 'TRANSIENT_PROVIDER_FAILURE'
    || code === 'TIMEOUT';
}

function errorCode(error: unknown): IntegrationErrorCode {
  if (error instanceof IntegrationProviderError || error instanceof IntegrationSecretResolutionError) {
    return error.code;
  }
  return 'TRANSIENT_PROVIDER_FAILURE';
}

function ledgerOutcome(
  result: IntegrationProviderDeliveryResult,
  claim: IntegrationDeliveryClaim,
  finishedAt: string,
): IntegrationDeliveryOutcome {
  if (result.kind === 'SUCCEEDED') {
    return {
      kind: 'SUCCEEDED',
      ...(result.providerReceiptRef === undefined ? {} : { providerReceiptRef: result.providerReceiptRef }),
    };
  }
  if (result.kind === 'FAILED_PERMANENT') {
    return { kind: 'FAILED_PERMANENT', errorCode: result.errorCode };
  }
  return {
    kind: 'RETRYABLE',
    errorCode: result.errorCode,
    nextAttemptAt: new Date(Date.parse(finishedAt) + retryDelayMs(claim.attemptNumber)).toISOString(),
  };
}

/**
 * Claims one I2 durable operation and performs exactly one provider attempt.
 * Temporal may call this repeatedly; I2 remains the authority for idempotency,
 * lease recovery, retry timing and terminal replay.
 */
export async function executeIntegrationOutboundOperation(input: Readonly<{
  businessSlug: string;
  operationId: string;
  now: string;
  connections: IntegrationDeliveryConnectionResolver;
  ledger: IntegrationDeliveryLedger;
  adapters: IntegrationProviderAdapterRegistry;
  leaseSeconds?: number;
}>): Promise<IntegrationOutboundCommandRecord> {
  const existing = await input.ledger.get(input.businessSlug, input.operationId);
  if (!existing) throw new IntegrationProviderError('INVALID_COMMAND', 'OUTBOUND_COMMAND_NOT_FOUND');
  if (existing.status === 'SUCCEEDED' || existing.status === 'FAILED_PERMANENT') return existing;

  const claim = await input.ledger.claim(
    input.businessSlug,
    input.operationId,
    input.now,
    input.leaseSeconds,
  );
  if (!claim) {
    const current = await input.ledger.get(input.businessSlug, input.operationId);
    if (!current) throw new IntegrationProviderError('INVALID_COMMAND', 'OUTBOUND_COMMAND_NOT_FOUND');
    return current;
  }

  let result: IntegrationProviderDeliveryResult;
  try {
    const connection = await input.connections.resolveConnection(
      claim.command.businessSlug,
      claim.command.connectionRef,
      claim.command.capability,
    );
    const adapter = input.adapters.get(connection.providerKind);
    result = await adapter.deliver(claim.command, connection);
  } catch (error) {
    const code = errorCode(error);
    result = retryable(code)
      ? { kind: 'RETRYABLE', errorCode: code }
      : { kind: 'FAILED_PERMANENT', errorCode: code };
  }

  const finishedAt = input.now;
  return input.ledger.complete(claim, ledgerOutcome(result, claim, finishedAt), finishedAt);
}
