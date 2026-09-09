import assert from 'node:assert/strict';
import test from 'node:test';
import {
  BATEYLATE_DESSERT_REQUEST_MANAGED_ENTITY_POLICY,
  GALLO_VEHICLE_MANAGED_ENTITY_POLICY,
  decideManagedEntityResolution,
  type ManagedEntityCandidate,
} from './managed-entity-policy.js';

const logan: ManagedEntityCandidate = {
  managedEntityId: 'me_logan',
  type: 'vehicle',
  displayName: 'Renault Logan',
};

const sentra: ManagedEntityCandidate = {
  managedEntityId: 'me_sentra',
  type: 'vehicle',
  displayName: 'Nissan Sentra',
};

test('ME1 Gallo requires managed entity creation when customer has no vehicle', () => {
  assert.deepEqual(decideManagedEntityResolution(GALLO_VEHICLE_MANAGED_ENTITY_POLICY, []), {
    kind: 'CREATE_NEW',
    reason: 'NONE_FOUND',
  });
});

test('ME1 Gallo keeps even one durable vehicle an explicit CTA selection', () => {
  assert.deepEqual(decideManagedEntityResolution(GALLO_VEHICLE_MANAGED_ENTITY_POLICY, [logan]), {
    kind: 'SELECT',
    candidates: [logan],
  });
});

test('ME1 Gallo returns every compatible vehicle when customer owns many', () => {
  assert.deepEqual(decideManagedEntityResolution(GALLO_VEHICLE_MANAGED_ENTITY_POLICY, [logan, sentra]), {
    kind: 'SELECT',
    candidates: [logan, sentra],
  });
});

test('ME1 Gallo does not offer incompatible managed entity types', () => {
  const dessert: ManagedEntityCandidate = {
    managedEntityId: 'me_cake',
    type: 'dessert_request',
    displayName: 'Birthday cake',
  };
  assert.deepEqual(decideManagedEntityResolution(GALLO_VEHICLE_MANAGED_ENTITY_POLICY, [dessert]), {
    kind: 'CREATE_NEW',
    reason: 'NONE_FOUND',
  });
});

test('ME1 BateYLate creates a new request-scoped dessert subject by default', () => {
  const historicalCake: ManagedEntityCandidate = {
    managedEntityId: 'me_old_cake',
    type: 'dessert_request',
    displayName: 'Previous birthday cake',
  };
  assert.deepEqual(
    decideManagedEntityResolution(BATEYLATE_DESSERT_REQUEST_MANAGED_ENTITY_POLICY, [historicalCake]),
    { kind: 'CREATE_NEW', reason: 'REQUEST_SCOPED_DEFAULT' },
  );
});
