import assert from 'node:assert/strict';
import test from 'node:test';
import {
  validateBusinessScope,
  validateDurationMinutes,
  validateEligibilityRuleSet,
  validatePricingDescriptor,
  validateRevision,
  validateServiceDependency,
  validateServiceRequirement,
  validateTags,
} from './index.js';

function codes(issues: readonly { code: string }[]): string[] {
  return issues.map((item) => item.code);
}

test('PRC-001: FIXED price accepts integer minor units and uppercase currency', () => {
  assert.deepEqual(validatePricingDescriptor({ kind: 'FIXED', amountMinor: 3500, currency: 'PEN' }), []);
});

test('PRC-002/003: FREE and QUOTE_REQUIRED do not fabricate money', () => {
  assert.deepEqual(validatePricingDescriptor({ kind: 'FREE' }), []);
  assert.deepEqual(validatePricingDescriptor({ kind: 'QUOTE_REQUIRED' }), []);
  assert.deepEqual(codes(validatePricingDescriptor({ kind: 'FREE', amountMinor: 0 })), ['INVALID_PRICE']);
});

test('PRC-004: negative price is rejected', () => {
  assert.deepEqual(codes(validatePricingDescriptor({ kind: 'FIXED', amountMinor: -1, currency: 'PEN' })), ['INVALID_PRICE']);
});

test('PRC-005: malformed currency is rejected', () => {
  assert.deepEqual(codes(validatePricingDescriptor({ kind: 'FROM', amountMinor: 100, currency: 'pen' })), ['INVALID_PRICE']);
  assert.deepEqual(codes(validatePricingDescriptor({ kind: 'FROM', amountMinor: 100, currency: 'PENN' })), ['INVALID_PRICE']);
});

test('PRC-006: duration must be a positive bounded integer', () => {
  assert.deepEqual(validateDurationMinutes(30), []);
  assert.deepEqual(codes(validateDurationMinutes(0)), ['INVALID_DURATION']);
  assert.deepEqual(codes(validateDurationMinutes(1441)), ['INVALID_DURATION']);
  assert.deepEqual(codes(validateDurationMinutes(30.5)), ['INVALID_DURATION']);
});

test('REQ-001: canonical requirement accepts domain config without channel form metadata', () => {
  assert.deepEqual(validateServiceRequirement({
    code: 'species-required',
    kind: 'ENTITY_ATTRIBUTE',
    required: true,
    config: { path: 'managedEntity.species' },
  }), []);
});

test('REQ-003: self dependency is rejected', () => {
  assert.deepEqual(codes(validateServiceDependency('offering-a', {
    relation: 'REQUIRES',
    targetOfferingId: 'offering-a',
  })), ['INVALID_DEPENDENCY']);
});

test('eligibility rules accept deterministic ALL predicates', () => {
  assert.deepEqual(validateEligibilityRuleSet({
    mode: 'ALL',
    failureCode: 'SPECIES_REQUIRED',
    predicates: [
      { path: 'managedEntity.species', operator: 'EXISTS' },
      { path: 'customer.age', operator: 'GTE', value: 18 },
      { path: 'managedEntity.species', operator: 'IN', value: ['dog', 'cat'] },
    ],
  }), []);
});

test('ELG-004: malformed eligibility rules fail closed', () => {
  assert.deepEqual(codes(validateEligibilityRuleSet({
    mode: 'ANY',
    failureCode: 'BAD',
    predicates: [{ path: 'x', operator: 'EQ', value: 1 }],
  })), ['INVALID_ELIGIBILITY_RULE']);

  assert.deepEqual(codes(validateEligibilityRuleSet({
    mode: 'ALL',
    failureCode: 'BAD',
    predicates: [{ path: 'x;DROP TABLE', operator: 'EQ', value: 1 }],
  })), ['INVALID_ELIGIBILITY_RULE']);

  assert.deepEqual(codes(validateEligibilityRuleSet({
    mode: 'ALL',
    failureCode: 'BAD',
    predicates: [{ path: 'x', operator: 'IN', value: 'not-array' }],
  })), ['INVALID_ELIGIBILITY_RULE']);
});

test('revision/tags/business scope invariants are explicit', () => {
  assert.deepEqual(validateBusinessScope('golden-auto'), []);
  assert.deepEqual(codes(validateBusinessScope('')), ['INVALID_BUSINESS_SCOPE']);
  assert.deepEqual(validateRevision(1), []);
  assert.deepEqual(codes(validateRevision(0)), ['INVALID_REVISION']);
  assert.deepEqual(validateTags(['vehicle-care', 'wash']), []);
  assert.deepEqual(codes(validateTags(['ok', ''])), ['INVALID_TAGS']);
});
