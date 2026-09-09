import assert from 'node:assert/strict';
import test from 'node:test';
import { decideManagedEntityResolution } from './resolution.js';
import type { ManagedEntityCandidate, ManagedEntityPolicy } from './types.js';

const reusableVehicle: ManagedEntityPolicy = {
  mode: 'REQUIRED_REUSABLE',
  entityType: 'vehicle',
  label: 'Vehículo',
  selectionMode: 'ALWAYS_CONFIRM',
  creationFields: [
    { key: 'plate', label: 'Placa', type: 'text', required: true },
  ],
};

const caseScopedDessert: ManagedEntityPolicy = {
  mode: 'REQUIRED_CASE_SCOPED',
  entityType: 'dessert_request',
  label: 'Solicitud de postre',
  creationFields: [
    { key: 'occasion', label: 'Ocasión', type: 'text', required: true },
    { key: 'servings', label: 'Porciones', type: 'number', required: true },
  ],
};

function candidate(
  managedEntityId: string,
  entityType: string,
  displayName: string,
  status: 'ACTIVE' | 'INACTIVE' = 'ACTIVE',
): ManagedEntityCandidate {
  return {
    managedEntityId,
    businessSlug: 'golden-business',
    entityType,
    displayName,
    status,
  };
}

test('ME0 reusable subject with zero candidates requires creation', () => {
  const decision = decideManagedEntityResolution({ policy: reusableVehicle, candidates: [] });
  assert.equal(decision.kind, 'NEEDS_CREATION');
});

test('ME0 reusable subject with one candidate still requires explicit confirmation when policy says ALWAYS_CONFIRM', () => {
  const vehicle = candidate('men_logan', 'vehicle', 'Renault Logan');
  const decision = decideManagedEntityResolution({ policy: reusableVehicle, candidates: [vehicle] });
  assert.equal(decision.kind, 'NEEDS_SELECTION');
  if (decision.kind === 'NEEDS_SELECTION') assert.deepEqual(decision.candidates.map((item) => item.managedEntityId), ['men_logan']);
});

test('ME0 reusable subject with multiple candidates requires selection', () => {
  const decision = decideManagedEntityResolution({
    policy: reusableVehicle,
    candidates: [
      candidate('men_logan', 'vehicle', 'Renault Logan'),
      candidate('men_yaris', 'vehicle', 'Toyota Yaris'),
    ],
  });
  assert.equal(decision.kind, 'NEEDS_SELECTION');
});

test('ME0 explicit managed entity id selects only an active matching candidate', () => {
  const decision = decideManagedEntityResolution({
    policy: reusableVehicle,
    candidates: [candidate('men_logan', 'vehicle', 'Renault Logan')],
    requestedManagedEntityId: 'men_logan',
  });
  assert.equal(decision.kind, 'SELECTED');
  if (decision.kind === 'SELECTED') {
    assert.equal(decision.managedEntity.managedEntityId, 'men_logan');
    assert.equal(decision.reason, 'EXPLICIT');
  }
});

test('ME0 inactive or wrong-type subject cannot be explicitly selected', () => {
  const decision = decideManagedEntityResolution({
    policy: reusableVehicle,
    candidates: [
      candidate('men_old', 'vehicle', 'Old vehicle', 'INACTIVE'),
      candidate('men_pet', 'pet', 'Luna'),
    ],
    requestedManagedEntityId: 'men_old',
  });
  assert.equal(decision.kind, 'INVALID_SELECTION');
});

test('ME0 BateYLate case-scoped dessert request never silently reuses an old dessert request', () => {
  const previousCake = candidate('men_cake_2025', 'dessert_request', 'Torta cumpleaños 2025');
  const decision = decideManagedEntityResolution({
    policy: caseScopedDessert,
    candidates: [previousCake],
  });
  assert.equal(decision.kind, 'NEEDS_CREATION');
});

test('ME0 BateYLate may explicitly reference an old dessert request for a future repeat/reorder intent', () => {
  const previousCake = candidate('men_cake_2025', 'dessert_request', 'Torta cumpleaños 2025');
  const decision = decideManagedEntityResolution({
    policy: caseScopedDessert,
    candidates: [previousCake],
    requestedManagedEntityId: 'men_cake_2025',
  });
  assert.equal(decision.kind, 'SELECTED');
});

test('ME0 not-applicable policy never invents a placeholder subject', () => {
  const decision = decideManagedEntityResolution({
    policy: { mode: 'NOT_APPLICABLE' },
    candidates: [candidate('men_noise', 'vehicle', 'Should be ignored')],
  });
  assert.equal(decision.kind, 'NOT_APPLICABLE');
});
