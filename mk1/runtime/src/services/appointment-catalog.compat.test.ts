import assert from 'node:assert/strict';
import test from 'node:test';
import type {
  ServiceDefinition,
  ServiceOffering,
} from '../contracts/services-engine/index.js';
import {
  snapshotOffering,
  toAppointmentProduct,
  toAppointmentService,
} from './appointment-catalog.compat.js';

const service: ServiceDefinition = {
  serviceId: 'svc_generic',
  businessSlug: 'golden-business',
  code: 'generic-service',
  name: 'Generic Service',
  status: 'ACTIVE',
  revision: 4,
  tags: ['generic'],
};

const offering: ServiceOffering = {
  offeringId: 'off_generic',
  serviceId: service.serviceId,
  businessSlug: service.businessSlug,
  code: 'generic-offering',
  name: 'Generic Offering',
  description: 'Compatibility fixture',
  status: 'ACTIVE',
  revision: 7,
  durationMinutes: 45,
  pricing: { kind: 'FIXED', amountMinor: 8000, currency: 'PEN' },
  priority: 10,
  tags: ['fixture'],
  requirements: [{
    code: 'contact-required',
    kind: 'CUSTOMER_DATA',
    required: true,
    config: { path: 'customer.contact' },
  }],
  dependencies: [],
};

test('CMP-001: generic Service projects to inherited AppointmentService without policy duplication', () => {
  assert.deepEqual(toAppointmentService(service), {
    serviceId: 'svc_generic',
    code: 'generic-service',
    name: 'Generic Service',
  });
});

test('CMP-002: generic Offering projects to inherited AppointmentProduct duration contract', () => {
  assert.deepEqual(toAppointmentProduct(offering), {
    productId: 'off_generic',
    serviceId: 'svc_generic',
    code: 'generic-offering',
    name: 'Generic Offering',
    description: 'Compatibility fixture',
    durationMinutes: 45,
  });
});

test('snapshot captures service/offering revisions and semantics durably', () => {
  assert.deepEqual(snapshotOffering(service, offering), {
    offeringId: 'off_generic',
    serviceId: 'svc_generic',
    businessSlug: 'golden-business',
    serviceRevision: 4,
    offeringRevision: 7,
    code: 'generic-offering',
    name: 'Generic Offering',
    durationMinutes: 45,
    pricing: { kind: 'FIXED', amountMinor: 8000, currency: 'PEN' },
    requirements: offering.requirements,
  });
});

test('snapshot rejects a Service/Offering scope mismatch', () => {
  assert.throws(
    () => snapshotOffering(service, { ...offering, businessSlug: 'other-business' }),
    /SERVICES_SNAPSHOT_SERVICE_OFFERING_MISMATCH/,
  );
});
