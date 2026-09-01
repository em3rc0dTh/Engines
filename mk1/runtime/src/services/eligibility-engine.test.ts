import assert from 'node:assert/strict';
import test from 'node:test';
import type { ServiceOffering } from '../contracts/services-engine/index.js';
import { evaluateOfferingEligibility, recommendOfferings } from './eligibility-engine.js';

function offering(overrides: Partial<ServiceOffering> & Pick<ServiceOffering, 'offeringId' | 'name'>): ServiceOffering {
  return {
    offeringId: overrides.offeringId,
    serviceId: overrides.serviceId ?? 'svc_1',
    businessSlug: overrides.businessSlug ?? 'business-a',
    code: overrides.code ?? overrides.offeringId,
    name: overrides.name,
    description: overrides.description,
    status: overrides.status ?? 'ACTIVE',
    revision: overrides.revision ?? 1,
    durationMinutes: overrides.durationMinutes ?? 30,
    pricing: overrides.pricing ?? { kind: 'FREE' },
    priority: overrides.priority ?? 0,
    tags: overrides.tags ?? [],
    requirements: overrides.requirements ?? [],
    dependencies: overrides.dependencies ?? [],
    eligibilityRuleSet: overrides.eligibilityRuleSet,
  };
}

test('ELG-001: same Offering + context produces same deterministic decision', () => {
  const target = offering({
    offeringId: 'offering-a',
    name: 'A',
    eligibilityRuleSet: {
      mode: 'ALL',
      failureCode: 'VEHICLE_NOT_ELIGIBLE',
      predicates: [
        { path: 'vehicle.year', operator: 'GTE', value: 2020 },
        { path: 'vehicle.type', operator: 'IN', value: ['car', 'truck'] },
      ],
    },
  });
  const context = { facts: { vehicle: { year: 2024, type: 'car' } } } as const;
  assert.deepEqual(evaluateOfferingEligibility(target, context), evaluateOfferingEligibility(target, context));
  assert.equal(evaluateOfferingEligibility(target, context).eligible, true);
});

test('ELG-002: failed predicate returns explicit configured reason code', () => {
  const target = offering({
    offeringId: 'offering-a',
    name: 'A',
    eligibilityRuleSet: {
      mode: 'ALL',
      failureCode: 'MINIMUM_SCORE_REQUIRED',
      predicates: [{ path: 'customer.score', operator: 'GTE', value: 80 }],
    },
  });
  const decision = evaluateOfferingEligibility(target, { facts: { customer: { score: 70 } } });
  assert.equal(decision.eligible, false);
  assert.deepEqual(decision.reasonCodes, ['MINIMUM_SCORE_REQUIRED']);
});

test('ELG-004: malformed rule fails closed instead of being ignored', () => {
  const target = offering({
    offeringId: 'offering-a',
    name: 'A',
    eligibilityRuleSet: {
      mode: 'ALL',
      failureCode: 'BAD',
      predicates: [{ path: 'x', operator: 'IN', value: 'not-an-array' as unknown as readonly unknown[] }],
    },
  });
  const decision = evaluateOfferingEligibility(target, { facts: { x: 'a' } });
  assert.equal(decision.eligible, false);
  assert.deepEqual(decision.reasonCodes, ['MALFORMED_ELIGIBILITY_RULE']);
});

test('REQ-004: required requirements and dependencies participate in eligibility', () => {
  const target = offering({
    offeringId: 'offering-a',
    name: 'A',
    requirements: [{ code: 'customer-contact', kind: 'CUSTOMER_DATA', required: true, config: {} }],
    dependencies: [
      { relation: 'REQUIRES', targetOfferingId: 'offering-base' },
      { relation: 'EXCLUDES', targetOfferingId: 'offering-blocker' },
    ],
  });
  const blocked = evaluateOfferingEligibility(target, {
    facts: {},
    satisfiedRequirementCodes: [],
    selectedOfferingIds: ['offering-blocker'],
  });
  assert.equal(blocked.eligible, false);
  assert.deepEqual(blocked.reasonCodes, [
    'REQUIREMENT_UNSATISFIED:customer-contact',
    'DEPENDENCY_REQUIRED:offering-base',
    'DEPENDENCY_EXCLUDES:offering-blocker',
  ]);

  const allowed = evaluateOfferingEligibility(target, {
    facts: {},
    satisfiedRequirementCodes: ['customer-contact'],
    selectedOfferingIds: ['offering-base'],
  });
  assert.equal(allowed.eligible, true);
});

test('REC-001: recommendation ranking is priority DESC, name ASC, id ASC', () => {
  const offerings = [
    offering({ offeringId: 'z-id', name: 'Beta', priority: 10 }),
    offering({ offeringId: 'b-id', name: 'Alpha', priority: 10 }),
    offering({ offeringId: 'a-id', name: 'Alpha', priority: 10 }),
    offering({ offeringId: 'low-id', name: 'First', priority: 1 }),
  ];
  const result = recommendOfferings(offerings, { facts: {} });
  assert.deepEqual(result.recommendations.map((item) => item.offering.offeringId), [
    'a-id', 'b-id', 'z-id', 'low-id',
  ]);
  assert.deepEqual(result.recommendations.map((item) => item.rank), [1, 2, 3, 4]);
});

test('REC-002: ineligible and inactive Offerings are excluded but retain evaluations', () => {
  const offerings = [
    offering({ offeringId: 'eligible', name: 'Eligible', priority: 1 }),
    offering({ offeringId: 'inactive', name: 'Inactive', status: 'INACTIVE', priority: 99 }),
    offering({
      offeringId: 'rule-fail',
      name: 'Rule Fail',
      priority: 50,
      eligibilityRuleSet: {
        mode: 'ALL',
        failureCode: 'COUNTRY_NOT_SUPPORTED',
        predicates: [{ path: 'customer.country', operator: 'EQ', value: 'PE' }],
      },
    }),
  ];
  const result = recommendOfferings(offerings, { facts: { customer: { country: 'CL' } } });
  assert.deepEqual(result.recommendations.map((item) => item.offering.offeringId), ['eligible']);
  assert.equal(result.evaluations.length, 3);
  assert.equal(result.evaluations.find((item) => item.offeringId === 'inactive')?.eligible, false);
  assert.deepEqual(
    result.evaluations.find((item) => item.offeringId === 'rule-fail')?.reasonCodes,
    ['COUNTRY_NOT_SUPPORTED'],
  );
});

test('REC-003: recommendation is independent of input ordering', () => {
  const a = offering({ offeringId: 'a', name: 'A', priority: 5 });
  const b = offering({ offeringId: 'b', name: 'B', priority: 8 });
  const first = recommendOfferings([a, b], { facts: {} });
  const second = recommendOfferings([b, a], { facts: {} });
  assert.deepEqual(first, second);
});
