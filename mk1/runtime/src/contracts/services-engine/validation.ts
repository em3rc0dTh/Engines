import type {
  EligibilityPredicate,
  EligibilityRuleSet,
  PricingDescriptor,
  ServiceDependency,
  ServiceRequirement,
  ServicesValidationIssue,
} from './types.js';

const REQUIREMENT_KINDS = new Set([
  'CUSTOMER_DATA',
  'DOCUMENT',
  'CONSENT',
  'ENTITY_ATTRIBUTE',
  'RESOURCE_CAPABILITY',
  'PRECONDITION',
]);

const ELIGIBILITY_OPERATORS = new Set(['EXISTS', 'EQ', 'IN', 'GTE', 'LTE']);

function issue(
  code: ServicesValidationIssue['code'],
  path: string,
  message: string,
): ServicesValidationIssue {
  return { code, path, message };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function validateBusinessScope(value: unknown): readonly ServicesValidationIssue[] {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return [issue('INVALID_BUSINESS_SCOPE', 'businessSlug', 'businessSlug must be a non-empty string')];
  }
  return [];
}

export function validateIdentity(path: string, value: unknown): readonly ServicesValidationIssue[] {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return [issue('INVALID_IDENTITY', path, `${path} must be a non-empty string`)];
  }
  return [];
}

export function validateRevision(value: unknown, path = 'revision'): readonly ServicesValidationIssue[] {
  if (!Number.isSafeInteger(value) || Number(value) < 1) {
    return [issue('INVALID_REVISION', path, `${path} must be a positive safe integer`)];
  }
  return [];
}

export function validateTags(value: unknown, path = 'tags'): readonly ServicesValidationIssue[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string' || item.trim().length === 0)) {
    return [issue('INVALID_TAGS', path, `${path} must be an array of non-empty strings`)];
  }
  return [];
}

export function validateDurationMinutes(value: unknown): readonly ServicesValidationIssue[] {
  if (!Number.isSafeInteger(value) || Number(value) <= 0 || Number(value) > 1440) {
    return [issue('INVALID_DURATION', 'durationMinutes', 'durationMinutes must be an integer from 1 to 1440')];
  }
  return [];
}

export function validatePricingDescriptor(value: unknown): readonly ServicesValidationIssue[] {
  if (!isRecord(value) || typeof value.kind !== 'string') {
    return [issue('INVALID_PRICE', 'pricing', 'pricing must be a typed descriptor')];
  }

  if (value.kind === 'FREE' || value.kind === 'QUOTE_REQUIRED') {
    const extras = Object.keys(value).filter((key) => key !== 'kind');
    return extras.length === 0
      ? []
      : [issue('INVALID_PRICE', 'pricing', `${value.kind} must not carry an amount or currency`)];
  }

  if (value.kind !== 'FIXED' && value.kind !== 'FROM') {
    return [issue('INVALID_PRICE', 'pricing.kind', 'unsupported pricing kind')];
  }

  if (!Number.isSafeInteger(value.amountMinor) || Number(value.amountMinor) < 0) {
    return [issue('INVALID_PRICE', 'pricing.amountMinor', 'amountMinor must be a non-negative safe integer')];
  }

  if (typeof value.currency !== 'string' || !/^[A-Z]{3}$/.test(value.currency)) {
    return [issue('INVALID_PRICE', 'pricing.currency', 'currency must be an uppercase three-letter code')];
  }

  return [];
}

export function validateServiceRequirement(value: unknown): readonly ServicesValidationIssue[] {
  if (!isRecord(value)) {
    return [issue('INVALID_REQUIREMENT', 'requirement', 'requirement must be an object')];
  }
  if (typeof value.code !== 'string' || value.code.trim().length === 0) {
    return [issue('INVALID_REQUIREMENT', 'requirement.code', 'requirement code is required')];
  }
  if (typeof value.kind !== 'string' || !REQUIREMENT_KINDS.has(value.kind)) {
    return [issue('INVALID_REQUIREMENT', 'requirement.kind', 'unsupported requirement kind')];
  }
  if (typeof value.required !== 'boolean') {
    return [issue('INVALID_REQUIREMENT', 'requirement.required', 'required must be boolean')];
  }
  if (!isRecord(value.config)) {
    return [issue('INVALID_REQUIREMENT', 'requirement.config', 'config must be an object')];
  }
  return [];
}

export function validateServiceDependency(
  sourceOfferingId: string,
  value: unknown,
): readonly ServicesValidationIssue[] {
  if (!isRecord(value)) {
    return [issue('INVALID_DEPENDENCY', 'dependency', 'dependency must be an object')];
  }
  if (value.relation !== 'REQUIRES' && value.relation !== 'EXCLUDES') {
    return [issue('INVALID_DEPENDENCY', 'dependency.relation', 'relation must be REQUIRES or EXCLUDES')];
  }
  if (typeof value.targetOfferingId !== 'string' || value.targetOfferingId.trim().length === 0) {
    return [issue('INVALID_DEPENDENCY', 'dependency.targetOfferingId', 'targetOfferingId is required')];
  }
  if (value.targetOfferingId === sourceOfferingId) {
    return [issue('INVALID_DEPENDENCY', 'dependency.targetOfferingId', 'an Offering cannot depend on itself')];
  }
  return [];
}

function validatePredicate(value: unknown, index: number): readonly ServicesValidationIssue[] {
  if (!isRecord(value)) {
    return [issue('INVALID_ELIGIBILITY_RULE', `eligibility.predicates[${index}]`, 'predicate must be an object')];
  }
  if (typeof value.path !== 'string' || !/^[A-Za-z0-9_.-]+$/.test(value.path)) {
    return [issue('INVALID_ELIGIBILITY_RULE', `eligibility.predicates[${index}].path`, 'predicate path is invalid')];
  }
  if (typeof value.operator !== 'string' || !ELIGIBILITY_OPERATORS.has(value.operator)) {
    return [issue('INVALID_ELIGIBILITY_RULE', `eligibility.predicates[${index}].operator`, 'unsupported eligibility operator')];
  }
  if (value.operator !== 'EXISTS' && !Object.hasOwn(value, 'value')) {
    return [issue('INVALID_ELIGIBILITY_RULE', `eligibility.predicates[${index}].value`, 'predicate value is required')];
  }
  if (value.operator === 'IN' && !Array.isArray(value.value)) {
    return [issue('INVALID_ELIGIBILITY_RULE', `eligibility.predicates[${index}].value`, 'IN requires an array value')];
  }
  return [];
}

export function validateEligibilityRuleSet(value: unknown): readonly ServicesValidationIssue[] {
  if (!isRecord(value)) {
    return [issue('INVALID_ELIGIBILITY_RULE', 'eligibility', 'eligibility rule set must be an object')];
  }
  if (value.mode !== 'ALL') {
    return [issue('INVALID_ELIGIBILITY_RULE', 'eligibility.mode', 'G1 supports only deterministic ALL mode')];
  }
  if (!Array.isArray(value.predicates) || value.predicates.length === 0) {
    return [issue('INVALID_ELIGIBILITY_RULE', 'eligibility.predicates', 'at least one predicate is required')];
  }
  if (typeof value.failureCode !== 'string' || value.failureCode.trim().length === 0) {
    return [issue('INVALID_ELIGIBILITY_RULE', 'eligibility.failureCode', 'failureCode is required')];
  }
  return value.predicates.flatMap((predicate, index) => validatePredicate(predicate, index));
}

export function assertPricingDescriptor(value: unknown): asserts value is PricingDescriptor {
  const issues = validatePricingDescriptor(value);
  if (issues.length > 0) throw new Error(`${issues[0]!.code}:${issues[0]!.path}:${issues[0]!.message}`);
}

export function assertServiceRequirement(value: unknown): asserts value is ServiceRequirement {
  const issues = validateServiceRequirement(value);
  if (issues.length > 0) throw new Error(`${issues[0]!.code}:${issues[0]!.path}:${issues[0]!.message}`);
}

export function assertServiceDependency(
  sourceOfferingId: string,
  value: unknown,
): asserts value is ServiceDependency {
  const issues = validateServiceDependency(sourceOfferingId, value);
  if (issues.length > 0) throw new Error(`${issues[0]!.code}:${issues[0]!.path}:${issues[0]!.message}`);
}

export function assertEligibilityRuleSet(value: unknown): asserts value is EligibilityRuleSet {
  const issues = validateEligibilityRuleSet(value);
  if (issues.length > 0) throw new Error(`${issues[0]!.code}:${issues[0]!.path}:${issues[0]!.message}`);
}

export type { EligibilityPredicate };
