import type { IntegrationCommand, IntegrationErrorCode } from '../contracts/integration-engine/index.js';

export type IntegrationOutboundStatus =
  | 'READY'
  | 'IN_FLIGHT'
  | 'RETRY_WAIT'
  | 'SUCCEEDED'
  | 'FAILED_PERMANENT';

export type IntegrationAttemptOutcome =
  | 'SUCCEEDED'
  | 'RETRYABLE'
  | 'FAILED_PERMANENT'
  | 'LEASE_EXPIRED';

export type IntegrationOutboundCommandRecord = Readonly<{
  command: IntegrationCommand;
  status: IntegrationOutboundStatus;
  attemptCount: number;
  maxAttempts: number;
  nextAttemptAt?: string;
  leaseExpiresAt?: string;
  currentAttemptId?: string;
  lastErrorCode?: IntegrationErrorCode;
  providerReceiptRef?: string;
  createdAt: string;
  updatedAt: string;
}>;

export type IntegrationDeliveryClaim = Readonly<{
  command: IntegrationCommand;
  attemptId: string;
  attemptNumber: number;
  leaseExpiresAt: string;
}>;

export type IntegrationDeliveryOutcome =
  | Readonly<{
      kind: 'SUCCEEDED';
      providerReceiptRef?: string;
    }>
  | Readonly<{
      kind: 'RETRYABLE';
      errorCode: IntegrationErrorCode;
      nextAttemptAt: string;
    }>
  | Readonly<{
      kind: 'FAILED_PERMANENT';
      errorCode: IntegrationErrorCode;
    }>;

export type IntegrationOutboundAttemptRecord = Readonly<{
  businessSlug: string;
  operationId: string;
  attemptNumber: number;
  attemptId: string;
  startedAt: string;
  finishedAt?: string;
  outcome?: IntegrationAttemptOutcome | undefined;
  errorCode?: IntegrationErrorCode;
  providerReceiptRef?: string;
  nextAttemptAt?: string;
}>;
