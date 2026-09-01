import assert from 'node:assert/strict';
import test from 'node:test';
import {
  validateServicesMutationCommand,
  type CreateServiceCommand,
  type CreateOfferingCommand,
  type UpdateServiceCommand,
  type UpdateOfferingCommand,
} from './management.js';

const createService: CreateServiceCommand = {
  operation: 'CreateService',
  businessSlug: 'golden-business',
  idempotencyKey: 'svc-create-001',
  service: {
    serviceId: 'svc_s4_demo',
    code: 's4-demo',
    name: 'S4 Demo Service',
    tags: ['demo'],
  },
};

const createOffering: CreateOfferingCommand = {
  operation: 'CreateOffering',
  businessSlug: 'golden-business',
  idempotencyKey: 'off-create-001',
  offering: {
    offeringId: 'off_s4_demo',
    serviceId: 'svc_s4_demo',
    code: 's4-offering',
    name: 'S4 Demo Offering',
    durationMinutes: 45,
    pricing: { kind: 'FIXED', amountMinor: 2500, currency: 'PEN' },
    priority: 10,
    tags: ['demo'],
    requirements: [],
    dependencies: [],
  },
};

test('S4 accepts canonical CreateService and CreateOffering commands', () => {
  assert.deepEqual(validateServicesMutationCommand(createService), []);
  assert.deepEqual(validateServicesMutationCommand(createOffering), []);
});

test('S4 rejects empty update patches and stale revision shapes before persistence', () => {
  const serviceUpdate: UpdateServiceCommand = {
    operation: 'UpdateService',
    businessSlug: 'golden-business',
    idempotencyKey: 'svc-update-empty',
    serviceId: 'svc_s4_demo',
    expectedRevision: 0,
    patch: {},
  };
  const issues = validateServicesMutationCommand(serviceUpdate);
  assert.ok(issues.some((item) => item.path === 'expectedRevision'));
  assert.ok(issues.some((item) => item.path === 'patch'));
});

test('S4 validates Offering patch commercial semantics', () => {
  const update: UpdateOfferingCommand = {
    operation: 'UpdateOffering',
    businessSlug: 'golden-business',
    idempotencyKey: 'off-update-invalid-price',
    offeringId: 'off_s4_demo',
    expectedRevision: 1,
    patch: {
      pricing: { kind: 'FIXED', amountMinor: -1, currency: 'PEN' },
    },
  };
  const issues = validateServicesMutationCommand(update);
  assert.ok(issues.some((item) => item.code === 'INVALID_PRICE'));
});

test('S4 keeps business scope and idempotency identity mandatory', () => {
  const invalid: CreateServiceCommand = {
    ...createService,
    businessSlug: '',
    idempotencyKey: '',
  };
  const issues = validateServicesMutationCommand(invalid);
  assert.ok(issues.some((item) => item.code === 'INVALID_BUSINESS_SCOPE'));
  assert.ok(issues.some((item) => item.path === 'idempotencyKey'));
});
