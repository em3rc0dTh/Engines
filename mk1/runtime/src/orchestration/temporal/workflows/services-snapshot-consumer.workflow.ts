import {
  condition,
  defineQuery,
  defineSignal,
  proxyActivities,
  setHandler,
} from '@temporalio/workflow';
import type {
  ServiceDefinition,
  ServiceOffering,
  ServicesSelectionSnapshot,
  ServicesSnapshotConsumerInput,
  ServicesSnapshotConsumerResult,
  ServicesSnapshotConsumerState,
} from '../../../contracts/services-engine/index.js';
import type { ServicesReadActivities } from '../activities/services-read.types.js';

const servicesRead = proxyActivities<ServicesReadActivities>({
  startToCloseTimeout: '15 seconds',
  retry: {
    initialInterval: '250 milliseconds',
    backoffCoefficient: 2,
    maximumInterval: '5 seconds',
    maximumAttempts: 8,
  },
});

export const getServicesSnapshotConsumerStateQuery =
  defineQuery<ServicesSnapshotConsumerState>('servicesSnapshotState');

export const continueServicesSnapshotSignal =
  defineSignal('continueServicesSnapshot');

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function captureSnapshot(
  service: ServiceDefinition,
  offering: ServiceOffering,
): ServicesSelectionSnapshot {
  if (service.businessSlug !== offering.businessSlug || service.serviceId !== offering.serviceId) {
    throw new Error('SERVICES_SNAPSHOT_SERVICE_OFFERING_MISMATCH');
  }
  return cloneJson({ service, offering });
}

export async function servicesSnapshotConsumerWorkflow(
  input: ServicesSnapshotConsumerInput,
): Promise<ServicesSnapshotConsumerResult> {
  let continueRequested = false;
  let snapshot: ServicesSelectionSnapshot | undefined;
  let phase: ServicesSnapshotConsumerState['phase'] = 'LOADING';

  const state = (): ServicesSnapshotConsumerState => ({
    phase,
    businessSlug: input.businessSlug,
    offeringIdOrCode: input.offeringIdOrCode,
    ...(snapshot ? { snapshot } : {}),
    continueRequested,
  });

  setHandler(getServicesSnapshotConsumerStateQuery, state);
  setHandler(continueServicesSnapshotSignal, () => {
    continueRequested = true;
  });

  const offering = await servicesRead.getOffering({
    businessSlug: input.businessSlug,
    offeringIdOrCode: input.offeringIdOrCode,
  });
  if (!offering) {
    throw new Error(`SERVICES_SNAPSHOT_OFFERING_NOT_FOUND:${input.businessSlug}:${input.offeringIdOrCode}`);
  }

  const service = await servicesRead.getService({
    businessSlug: input.businessSlug,
    serviceIdOrCode: offering.serviceId,
  });
  if (!service) {
    throw new Error(`SERVICES_SNAPSHOT_SERVICE_NOT_FOUND:${input.businessSlug}:${offering.serviceId}`);
  }

  snapshot = captureSnapshot(service, offering);
  phase = 'WAITING';

  await condition(() => continueRequested);

  phase = 'COMPLETED';
  return {
    status: 'COMPLETED',
    snapshot,
  };
}
