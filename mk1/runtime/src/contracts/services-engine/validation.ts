import type {
  EligibilityPredicate,
  EligibilityRuleSet,
  PricingDescriptor,
  ServiceDependency,
  ServiceRequirement,
  ServiceSchedulingProfile,
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
const SCHEDULING_CAPACITY_MAX = 1_000_000;
const SCHEDULING_BUFFER_MAX = 1440;

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

export function validateServiceSchedulingProfile(value: unknown): readonly ServicesValidationIssue[] {
  if (!isRecord(value)) {
    return [issue('INVALID_SCHEDULING_PROFILE', 'scheduling', 'scheduling profile must be an object')];
  }

  const issues: ServicesValidationIssue[] = [];
  if (!Number.isSafeInteger(value.capacityUnits)
      || Number(value.capacityUnits) <= 0
      || Number(value.capacityUnits) > SCHEDULING_CAPACITY_MAX) {
    issues.push(issue(
      'INVALID_SCHEDULING_PROFILE',
      'scheduling.capacityUnits',
      `capacityUnits must be an integer from 1 to ${SCHEDULING_CAPACITY_MAX}`,
    ));
  }

  if (!Array.isArray(value.requiredCapabilities)) {
    issues.push(issue(
      'INVALID_SCHEDULING_PROFILE',
      'scheduling.requiredCapabilities',
      'requiredCapabilities must be an array',
    ));
  } else {
    const codes = new Set<string>();
    value.requiredCapabilities.forEach((capability, index) => {
      const path = `scheduling.requiredCapabilities[${index}]`;
      if (!isRecord(capability)) {
        issues.push(issue('INVALID_SCHEDULING_PROFILE', path, 'capability demand must be an object'));
        return;
      }
      if (typeof capability.code !== 'string' || capability.code.trim().length === 0) {
        issues.push(issue('INVALID_SCHEDULING_PROFILE', `${path}.code`, 'capability code is required'));
      } else if (codes.has(capability.code)) {
        issues.push(issue('INVALID_SCHEDULING_PROFILE', `${path}.code`, 'capability codes must be unique'));
      } else {
        codes.add(capability.code);
      }
      if (!Number.isSafeInteger(capability.quantity)
          || Number(capability.quantity) <= 0
          || Number(capability.quantity) > SCHEDULING_CAPACITY_MAX) {
        issues.push(issue('INVALID_SCHEDULING_PROFILE', `${path}.quantity`, 'quantity must be a positive integer'));
      }
      if (capability.resourceKinds !== undefined) {
        if (!Array.isArray(capability.resourceKinds) || capability.resourceKinds.length === 0) {
          issues.push(issue('INVALID_SCHEDULING_PROFILE', `${path}.resourceKinds`, 'resourceKinds must be a non-empty array when provided'));
        } else {
          const kinds = new Set<string>();
          capability.resourceKinds.forEach((kind, kindIndex) => {
            if (typeof kind !== 'string' || kind.trim().length === 0 || kinds.has(kind)) {
              issues.push(issue(
                'INVALID_SCHEDULING_PROFILE',
                `${path}.resourceKinds[${kindIndex}]`,
                'resource kinds must be non-empty and unique',
              ));
            } else {
              kinds.add(kind);
            }
          });
        }
      }
    });
  }

  if (!isRecord(value.buffers)) {
    issues.push(issue('INVALID_SCHEDULING_PROFILE', 'scheduling.buffers', 'buffers must be an object'));
  } else {
    for (const key of ['beforeMinutes', 'afterMinutes'] as const) {
      const minutes = value.buffers[key];
      if (!Number.isSafeInteger(minutes) || Number(minutes) < 0 || Number(minutes) > SCHEDULING_BUFFER_MAX) {
        issues.push(issue(
          'INVALID_SCHEDULING_PROFILE',
          `scheduling.buffers.${key}`,
          `${key} must be an integer from 0 to ${SCHEDULING_BUFFER_MAX}`,
        ));
      }
    }
  }

  return issues;
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

export function assertServiceSchedulingProfile(value: unknown): asserts value is ServiceSchedulingProfile {
  const issues = validateServiceSchedulingProfile(value);
  if (issues.length > 0) throw new Error(`${issues[0]!.code}:${issues[0]!.path}:${issues[0]!.message}`);
}

export type { EligibilityPredicate };
