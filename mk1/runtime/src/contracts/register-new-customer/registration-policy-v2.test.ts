import assert from 'node:assert/strict';
import test from 'node:test';
import {
  evaluateRegistrationCompleteness,
  GOLDEN_REGISTRATION_POLICY_V1,
  GOLDEN_REGISTRATION_POLICY_V2,
  validateRegistrationPolicy,
} from './registration-policy.js';

const complete = {
  customer: {
    name: 'Eduardo',
    contact: {
      email: 'eduardo@example.com',
      phones: [{ normalized: '+51999111222' }],
    },
  },
} as const;

test('V1 compatibility still accepts name plus either contact', () => {
  assert.equal(evaluateRegistrationCompleteness(GOLDEN_REGISTRATION_POLICY_V1, {
    customer: { name: 'Eduardo', contact: { email: 'eduardo@example.com' } },
  }).complete, true);
  assert.equal(evaluateRegistrationCompleteness(GOLDEN_REGISTRATION_POLICY_V1, {
    customer: { name: 'Eduardo', contact: { phones: [{ number: '999111222' }] } },
  }).complete, true);
});

test('V2 requires name independently', () => {
  const state = evaluateRegistrationCompleteness(GOLDEN_REGISTRATION_POLICY_V2, {
    customer: { contact: complete.customer.contact },
  });
  assert.equal(state.complete, false);
  assert.deepEqual(state.missingFields, ['customer.name']);
});

test('V2 requires phone independently', () => {
  const state = evaluateRegistrationCompleteness(GOLDEN_REGISTRATION_POLICY_V2, {
    customer: { name: 'Eduardo', contact: { email: 'eduardo@example.com' } },
  });
  assert.deepEqual(state.missingFields, ['customer.contact.phone']);
});

test('V2 requires email independently', () => {
  const state = evaluateRegistrationCompleteness(GOLDEN_REGISTRATION_POLICY_V2, {
    customer: { name: 'Eduardo', contact: { phones: [{ normalized: '+51999111222' }] } },
  });
  assert.deepEqual(state.missingFields, ['customer.contact.email']);
});

test('V2 is complete only with name, phone and email', () => {
  assert.equal(validateRegistrationPolicy(GOLDEN_REGISTRATION_POLICY_V2).length, 0);
  assert.deepEqual(evaluateRegistrationCompleteness(GOLDEN_REGISTRATION_POLICY_V2, complete), {
    complete: true,
    knownFields: ['customer.name', 'customer.contact.phone', 'customer.contact.email'],
    missingFields: [],
  });
});
