import { proxyActivities, sleep } from '@temporalio/workflow';
import { validateIntegrationEvent } from '../../../contracts/integration-engine/index.js';
import type {
  IntegrationDeliveryActivityResult,
  IntegrationDeliveryActivityInput,
  IntegrationEventHandoffInput,
  IntegrationEventHandoffResult,
  IntegrationTemporalActivities,
} from '../activities/integration-delivery.types.js';

const { executeIntegrationDelivery } = proxyActivities<IntegrationTemporalActivities>({
  startToCloseTimeout: '30s',
  retry: {
    initialInterval: '1s',
    backoffCoefficient: 2,
    maximumAttempts: 3,
  },
});

function waitUntil(iso: string): number {
  const target = Date.parse(iso);
  if (!Number.isFinite(target)) throw new Error('INTEGRATION_G3_I5_INVALID_WAKE_AT');
  return Math.max(1, target - Date.now());
}

export async function integrationDeliveryWorkflow(
  input: IntegrationDeliveryActivityInput,
): Promise<IntegrationDeliveryActivityResult> {
  // Temporal may retry an activity execution, but every call carries the same
  // businessSlug + operationId. I2 remains the only provider-attempt authority.
  for (let cycle = 0; cycle < 25; cycle += 1) {
    const result = await executeIntegrationDelivery(input);
    if (result.status === 'SUCCEEDED' || result.status === 'FAILED_PERMANENT') return result;

    if (result.status === 'RETRY_WAIT') {
      if (!result.nextAttemptAt) throw new Error('INTEGRATION_G3_I5_RETRY_WAIT_WITHOUT_NEXT_ATTEMPT');
      await sleep(waitUntil(result.nextAttemptAt));
      continue;
    }

    if (result.status === 'IN_FLIGHT') {
      if (!result.leaseExpiresAt) throw new Error('INTEGRATION_G3_I5_IN_FLIGHT_WITHOUT_LEASE');
      await sleep(waitUntil(result.leaseExpiresAt));
      continue;
    }

    // READY can occur if a prior activity execution observed state before a
    // claim; yield briefly rather than creating workflow-owned retry semantics.
    await sleep(1);
  }

  throw new Error('INTEGRATION_G3_I5_ORCHESTRATION_CYCLE_LIMIT');
}

export async function integrationEventHandoffWorkflow(
  input: IntegrationEventHandoffInput,
): Promise<IntegrationEventHandoffResult> {
  const event = validateIntegrationEvent(input.event);
  return {
    eventId: event.eventId,
    providerEventIdentity: event.providerEventIdentity,
    businessSlug: event.businessSlug,
    connectionRef: event.connectionRef,
    capability: event.capability,
    eventType: event.eventType,
    receivedAt: event.receivedAt,
  };
}
