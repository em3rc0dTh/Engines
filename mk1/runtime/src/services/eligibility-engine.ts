import {
  validateEligibilityRuleSet,
  type EligibilityPredicate,
  type ServiceOffering,
} from '../contracts/services-engine/index.js';

export type EligibilityContext = Readonly<{
  facts: Readonly<Record<string, unknown>>;
  satisfiedRequirementCodes?: readonly string[];
  selectedOfferingIds?: readonly string[];
}>;

export type PredicateEvaluation = Readonly<{
  path: string;
  operator: EligibilityPredicate['operator'];
  matched: boolean;
}>;

export type OfferingEligibilityDecision = Readonly<{
  offeringId: string;
  eligible: boolean;
  reasonCodes: readonly string[];
  predicateEvaluations: readonly PredicateEvaluation[];
}>;

export type RecommendedOffering = Readonly<{
  rank: number;
  offering: ServiceOffering;
  reasonCodes: readonly string[];
}>;

export type OfferingRecommendationResult = Readonly<{
  recommendations: readonly RecommendedOffering[];
  evaluations: readonly OfferingEligibilityDecision[];
}>;

function readPath(root: Readonly<Record<string, unknown>>, path: string): unknown {
  let current: unknown = root;
  for (const segment of path.split('.')) {
    if (!current || typeof current !== 'object' || Array.isArray(current)) return undefined;
    current = (current as Record<string, unknown>)[segment];
  }
  return current;
}

function deterministicEqual(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) return true;
  if (Array.isArray(left) && Array.isArray(right)) {
    return left.length === right.length && left.every((item, index) => deterministicEqual(item, right[index]));
  }
  if (
    left && right && typeof left === 'object' && typeof right === 'object'
    && !Array.isArray(left) && !Array.isArray(right)
  ) {
    const leftRecord = left as Record<string, unknown>;
    const rightRecord = right as Record<string, unknown>;
    const leftKeys = Object.keys(leftRecord).sort();
    const rightKeys = Object.keys(rightRecord).sort();
    return deterministicEqual(leftKeys, rightKeys)
      && leftKeys.every((key) => deterministicEqual(leftRecord[key], rightRecord[key]));
  }
  return false;
}

function evaluatePredicate(
  predicate: EligibilityPredicate,
  facts: Readonly<Record<string, unknown>>,
): PredicateEvaluation {
  const actual = readPath(facts, predicate.path);
  let matched = false;

  switch (predicate.operator) {
    case 'EXISTS':
      matched = actual !== undefined && actual !== null;
      break;
    case 'EQ':
      matched = deterministicEqual(actual, predicate.value);
      break;
    case 'IN':
      matched = Array.isArray(predicate.value)
        && predicate.value.some((candidate) => deterministicEqual(actual, candidate));
      break;
    case 'GTE':
      matched = typeof actual === 'number' && typeof predicate.value === 'number' && actual >= predicate.value;
      break;
    case 'LTE':
      matched = typeof actual === 'number' && typeof predicate.value === 'number' && actual <= predicate.value;
      break;
  }

  return { path: predicate.path, operator: predicate.operator, matched };
}

function stableCompareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

export function evaluateOfferingEligibility(
  offering: ServiceOffering,
  context: EligibilityContext,
): OfferingEligibilityDecision {
  const reasons: string[] = [];
  const satisfiedRequirements = new Set(context.satisfiedRequirementCodes ?? []);
  const selectedOfferings = new Set(context.selectedOfferingIds ?? []);

  if (offering.status !== 'ACTIVE') reasons.push('OFFERING_INACTIVE');

  for (const requirement of offering.requirements) {
    if (requirement.required && !satisfiedRequirements.has(requirement.code)) {
      reasons.push(`REQUIREMENT_UNSATISFIED:${requirement.code}`);
    }
  }

  for (const dependency of offering.dependencies) {
    if (dependency.relation === 'REQUIRES' && !selectedOfferings.has(dependency.targetOfferingId)) {
      reasons.push(`DEPENDENCY_REQUIRED:${dependency.targetOfferingId}`);
    }
    if (dependency.relation === 'EXCLUDES' && selectedOfferings.has(dependency.targetOfferingId)) {
      reasons.push(`DEPENDENCY_EXCLUDES:${dependency.targetOfferingId}`);
    }
  }

  const predicateEvaluations: PredicateEvaluation[] = [];
  if (offering.eligibilityRuleSet) {
    const issues = validateEligibilityRuleSet(offering.eligibilityRuleSet);
    if (issues.length > 0) {
      reasons.push('MALFORMED_ELIGIBILITY_RULE');
    } else {
      for (const predicate of offering.eligibilityRuleSet.predicates) {
        predicateEvaluations.push(evaluatePredicate(predicate, context.facts));
      }
      if (predicateEvaluations.some((evaluation) => !evaluation.matched)) {
        reasons.push(offering.eligibilityRuleSet.failureCode);
      }
    }
  }

  return {
    offeringId: offering.offeringId,
    eligible: reasons.length === 0,
    reasonCodes: reasons.length === 0 ? ['ELIGIBLE'] : reasons,
    predicateEvaluations,
  };
}

export function recommendOfferings(
  offerings: readonly ServiceOffering[],
  context: EligibilityContext,
): OfferingRecommendationResult {
  const evaluations = offerings
    .map((offering) => evaluateOfferingEligibility(offering, context))
    .sort((left, right) => stableCompareText(left.offeringId, right.offeringId));
  const decisionsById = new Map(evaluations.map((decision) => [decision.offeringId, decision]));

  const eligibleOfferings = offerings
    .filter((offering) => decisionsById.get(offering.offeringId)?.eligible === true)
    .slice()
    .sort((left, right) => {
      if (left.priority !== right.priority) return right.priority - left.priority;
      const byName = stableCompareText(left.name, right.name);
      return byName !== 0 ? byName : stableCompareText(left.offeringId, right.offeringId);
    });

  return {
    recommendations: eligibleOfferings.map((offering, index) => ({
      rank: index + 1,
      offering,
      reasonCodes: ['ELIGIBLE'],
    })),
    evaluations,
  };
}
