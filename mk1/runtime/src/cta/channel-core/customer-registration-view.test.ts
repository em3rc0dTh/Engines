import assert from 'node:assert/strict';
import test from 'node:test';
import type { RegistrationStateProjection } from '../../contracts/register-new-customer/index.js';
import { projectCustomerRegistration } from './customer-registration-view.js';

function state(overrides: Partial<RegistrationStateProjection>): RegistrationStateProjection {
  return {
    workflowId: 'register-customer:golden:1',
    workflowStatus: 'RUNNING',
    phase: 'WAITING_FOR_REQUIRED_DATA',
    knownFields: [],
    missingFields: [],
    validationErrors: [],
    nextAction: 'PROVIDE_CUSTOMER_DATA',
    ...overrides,
  };
}

test('missingFields, not the CTA, select the next registration question', () => {
  assert.equal(projectCustomerRegistration(state({ missingFields: ['customer.name'] })).renderIntent, 'ASK_CUSTOMER_NAME');
  assert.equal(projectCustomerRegistration(state({ missingFields: ['customer.contact.phone'] })).renderIntent, 'ASK_CUSTOMER_PHONE');
  assert.equal(projectCustomerRegistration(state({ missingFields: ['customer.contact.email'] })).renderIntent, 'ASK_CUSTOMER_EMAIL');
});

test('created registration projects a provider-independent completion intent', () => {
  assert.equal(projectCustomerRegistration(state({
    workflowStatus: 'COMPLETED', phase: 'CREATED', created: true, nextAction: 'NONE',
  })).renderIntent, 'REGISTRATION_COMPLETE');
});
