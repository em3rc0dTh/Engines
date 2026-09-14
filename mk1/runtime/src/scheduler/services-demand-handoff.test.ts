import assert from 'node:assert/strict';
import test from 'node:test';
import type { ServicesSelectionSnapshot } from '../contracts/services-engine/index.js';
import {
  materializeSchedulingDemandFromServicesSnapshot,
  ServicesDemandHandoffError,
} from './services-demand-handoff.js';

function snapshot(): ServicesSelectionSnapshot {
  return {
    service: {
      serviceId: 'svc_handoff',
      businessSlug: 'handoff-business',
      code: 'service',
      name: 'Service',
      status: 'ACTIVE',
      revision: 4,
      tags: [],
    },
    offering: {
      offeringId: 'off_handoff',
      serviceId: 'svc_handoff',
      businessSlug: 'handoff-business',
      code: 'offering',
      name: 'Offering',
      status: 'ACTIVE',
      revision: 7,
      durationMinutes: 55,
      pricing: { kind: 'QUOTE_REQUIRED' },
      priority: 0,
      tags: [],
      requirements: [],
      dependencies: [],
      scheduling: {
        capacityUnits: 2,
        requiredCapabilities: [
          { code: 'CAP_A', quantity: 1, resourceKinds: ['ROOM'] },
          { code: 'CAP_B', quantity: 2 },
        ],
        buffers: { beforeMinutes: 10, afterMinutes: 15 },
      },
    },
  };
}

test('materializes exactly the frozen Services revisions and scheduling profile', () => {
  const source = snapshot();
  const demand = materializeSchedulingDemandFromServicesSnapshot(source, 'demand_handoff');

  assert.deepEqual(demand, {
    schemaVersion: 1,
    businessSlug: 'handoff-business',
    demandId: 'demand_handoff',
    service: { serviceId: 'svc_handoff', revision: 4 },
    offering: { offeringId: 'off_handoff', revision: 7, durationMinutes: 55 },
    capacityUnits: 2,
    requiredCapabilities: [
      { code: 'CAP_A', quantity: 1, resourceKinds: ['ROOM'] },
      { code: 'CAP_B', quantity: 2 },
    ],
    buffers: { beforeMinutes: 10, afterMinutes: 15 },
  });

  assert.notEqual(demand.requiredCapabilities, source.offering.scheduling?.requiredCapabilities);
  assert.notEqual(demand.buffers, source.offering.scheduling?.buffers);
});

test('fails closed when the frozen selection has no scheduling profile', () => {
  const source = snapshot();
  const { scheduling: _scheduling, ...offeringWithoutScheduling } = source.offering;
  const withoutScheduling: ServicesSelectionSnapshot = {
    service: source.service,
    offering: offeringWithoutScheduling,
  };

  assert.throws(
    () => materializeSchedulingDemandFromServicesSnapshot(withoutScheduling, 'demand_missing'),
    (error: unknown) => error instanceof ServicesDemandHandoffError
      && error.code === 'SCHEDULING_PROFILE_MISSING',
  );
});

test('fails closed on cross-scope/mismatched Service and Offering identities', () => {
  const source = snapshot();
  const mismatched: ServicesSelectionSnapshot = {
    service: source.service,
    offering: { ...source.offering, serviceId: 'svc_other' },
  };

  assert.throws(
    () => materializeSchedulingDemandFromServicesSnapshot(mismatched, 'demand_mismatch'),
    (error: unknown) => error instanceof ServicesDemandHandoffError
      && error.code === 'SNAPSHOT_SCOPE_MISMATCH',
  );
});

test('does not create a new demand from an inactive frozen selection', () => {
  const source = snapshot();
  const inactive: ServicesSelectionSnapshot = {
    service: source.service,
    offering: { ...source.offering, status: 'INACTIVE' },
  };

  assert.throws(
    () => materializeSchedulingDemandFromServicesSnapshot(inactive, 'demand_inactive'),
    (error: unknown) => error instanceof ServicesDemandHandoffError
      && error.code === 'SNAPSHOT_INACTIVE',
  );
});
