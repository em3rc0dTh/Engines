import type { IntegrationErrorCode, IntegrationEvent } from '../../../contracts/integration-engine/index.js';
import type { IntegrationOutboundStatus } from '../../../integration/outbound.js';

export type IntegrationDeliveryActivityInput = Readonly<{
  businessSlug: string;
  operationId: string;
}>;

export type IntegrationDeliveryActivityResult = Readonly<{
  businessSlug: string;
  operationId: string;
  status: IntegrationOutboundStatus;
  attemptCount: number;
  maxAttempts: number;
  nextAttemptAt?: string;
  leaseExpiresAt?: string;
  lastErrorCode?: IntegrationErrorCode;
  providerReceiptRef?: string;
}>;

export type IntegrationEventHandoffInput = Readonly<{
  event: IntegrationEvent;
}>;

export type IntegrationEventHandoffResult = Readonly<{
  eventId: string;
  providerEventIdentity: string;
  businessSlug: string;
  connectionRef: string;
  capability: string;
  eventType: string;
  receivedAt: string;
}>;

export interface IntegrationTemporalActivities {
  executeIntegrationDelivery(input: IntegrationDeliveryActivityInput): Promise<IntegrationDeliveryActivityResult>;
}
