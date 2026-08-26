import assert from 'node:assert/strict';
import test from 'node:test';
import {
  validateProvideCustomerData,
  validateProvideCustomerDataIngress,
} from './validation.js';

function validate(customerPatch: Record<string, unknown>) {
  return validateProvideCustomerDataIngress({
    inputId: 'contact-validation-fixture',
    customerPatch,
  });
}

test('contact boundary accepts pragmatic valid email domains without requiring .com', () => {
  for (const email of [
    'user@gmail.com',
    'user@company.pe',
    'user@domain.io',
    'first.last+tag@example.org',
  ]) {
    const result = validate({ contact: { email } });
    assert.equal(result.ok, true, `${email} should be accepted`);
  }
});

test('contact boundary rejects malformed email before Workflow draft mutation', () => {
  for (const email of [
    'Zavaleta',
    'user@gmail',
    '@gmail.com',
    'user@.com',
    'user@@gmail.com',
    'user gmail@example.com',
  ]) {
    const result = validate({ contact: { email } });
    assert.equal(result.ok, false, `${email} should be rejected`);
    if (!result.ok) {
      assert(result.issues.some((issue) => issue.path === 'customerPatch.contact.email'));
    }
  }
});

test('contact boundary accepts common human phone formatting and local seven-digit numbers', () => {
  for (const number of [
    '933075200',
    '2831400',
    '+51 933 075 200',
    '+51 (933) 075-200',
    '+51.933.075.200',
  ]) {
    const digits = number.replace(/\D/g, '');
    const result = validate({
      contact: {
        phones: [{ number, normalized: digits, primary: true }],
      },
    });
    assert.equal(result.ok, true, `${number} should be accepted`);
  }
});

test('contact boundary rejects alphabetic, insufficient and empty phone material', () => {
  const fixtures = [
    { number: 'llslslsl', normalized: 'llslslsl' },
    { number: '933ABC200', normalized: '933ABC200' },
    { number: '123', normalized: '123' },
    { primary: true },
  ];

  for (const phone of fixtures) {
    const result = validate({ contact: { phones: [phone] } });
    assert.equal(result.ok, false, `${JSON.stringify(phone)} should be rejected`);
    if (!result.ok) {
      assert(result.issues.some((issue) => issue.path.startsWith('customerPatch.contact.phones[0]')));
    }
  }
});

test('contact boundary validates optional country code independently', () => {
  const valid = validate({
    contact: {
      phones: [{ countryCode: '+51', number: '933075200', normalized: '51933075200' }],
    },
  });
  assert.equal(valid.ok, true);

  const invalid = validate({
    contact: {
      phones: [{ countryCode: '+PERU', number: '933075200', normalized: '51933075200' }],
    },
  });
  assert.equal(invalid.ok, false);
});

test('CTA ingress rejects legacy bad phone material without changing durable V1 replay semantics', () => {
  const input = {
    inputId: 'legacy-replay-boundary',
    customerPatch: {
      contact: {
        phones: [{ number: 'llslslsl', normalized: 'llslslsl', primary: true }],
      },
    },
  };

  const ingress = validateProvideCustomerDataIngress(input);
  assert.equal(ingress.ok, false, 'new CTA ingress must reject alphabetic phone material');

  const durableV1 = validateProvideCustomerData(input);
  assert.equal(
    durableV1.ok,
    true,
    'durable V1 validator must stay replay-compatible with histories recorded before CTA ingress V2',
  );
});
