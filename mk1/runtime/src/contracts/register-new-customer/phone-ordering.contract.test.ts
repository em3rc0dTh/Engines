import assert from 'node:assert/strict';
import test from 'node:test';
import { hasSameInitialStartFingerprintMaterial } from './idempotency.js';
import { normalizeCustomerDraft } from './normalization.js';
import {
  REGISTER_NEW_CUSTOMER_OPERATION,
  REGISTER_NEW_CUSTOMER_SCHEMA_VERSION,
  type RegisterNewCustomerStartEnvelope,
} from './types.js';

function startWithPhones(phones: readonly Readonly<{ normalized: string; primary?: boolean }>[]): RegisterNewCustomerStartEnvelope {
  return {
    operation: REGISTER_NEW_CUSTOMER_OPERATION,
    businessSlug: 'golden-business',
    draft: { customer: { contact: { phones } } },
    request: { idempotencyKey: 'phone-ordering-contract' },
    schemaVersion: REGISTER_NEW_CUSTOMER_SCHEMA_VERSION,
  };
}

test('durable Customer normalization preserves explicit phone slot order', () => {
  const normalized = normalizeCustomerDraft({
    contact: {
      phones: [
        { number: '933075200', normalized: '933075200', primary: true },
        { number: '2831400', normalized: '2831400' },
      ],
    },
  });

  assert.deepEqual(
    normalized.contact?.phones?.map((phone) => ({ normalized: phone.normalized, primary: phone.primary })),
    [
      { normalized: '933075200', primary: true },
      { normalized: '2831400', primary: undefined },
    ],
  );
});

test('fingerprint comparison remains phone-order independent without reordering durable drafts', () => {
  const first = startWithPhones([
    { normalized: '933075200', primary: true },
    { normalized: '2831400' },
  ]);
  const second = startWithPhones([
    { normalized: '2831400' },
    { normalized: '933075200', primary: true },
  ]);

  assert.equal(hasSameInitialStartFingerprintMaterial(first, second), true);

  const firstNormalized = normalizeCustomerDraft(first.draft?.customer);
  const secondNormalized = normalizeCustomerDraft(second.draft?.customer);
  assert.deepEqual(firstNormalized.contact?.phones?.map((phone) => phone.normalized), ['933075200', '2831400']);
  assert.deepEqual(secondNormalized.contact?.phones?.map((phone) => phone.normalized), ['2831400', '933075200']);
});
