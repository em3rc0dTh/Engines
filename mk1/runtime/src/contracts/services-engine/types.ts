export type ServiceStatus = 'ACTIVE' | 'INACTIVE';

export type PricingDescriptor =
  | Readonly<{ kind: 'FREE' }>
  | Readonly<{ kind: 'FIXED'; amountMinor: number; currency: string }>
  | Readonly<{ kind: 'FROM'; amountMinor: number; currency: string }>
  | Readonly<{ kind: 'QUOTE_REQUIRED' }>;

export type ServiceRequirementKind =
  | 'CUSTOMER_DATA'
  | 'DOCUMENT'
  | 'CONSENT'
  | 'ENTITY_ATTRIBUTE'
  | 'RESOURCE_CAPABILITY'
  | 'PRECONDITION';

export type ServiceRequirement = Readonly<{
  code: string;
  kind: ServiceRequirementKind;
  required: boolean;
  config: Readonly<Record<string, unknown>>;
}>;

export type ServiceDependencyRelation = 'REQUIRES' | 'EXCLUDES';

export type ServiceDependency = Readonly<{
  relation: ServiceDependencyRelation;
  targetOfferingId: string;
}>;

export type EligibilityOperator = 'EXISTS' | 'EQ' | 'IN' | 'GTE' | 'LTE';

export type EligibilityPredicate = Readonly<{
  path: string;
  operator: EligibilityOperator;
  value?: unknown;
}>;

export type EligibilityRuleSet = Readonly<{
  mode: 'ALL';
  predicates: readonly EligibilityPredicate[];
  failureCode: string;
}>;

export type ServiceDefinition = Readonly<{
  serviceId: string;
  businessSlug: string;
  code: string;
  name: string;
  description?: string;
  status: ServiceStatus;
  revision: number;
  tags: readonly string[];
}>;

export type ServiceOffering = Readonly<{
  offeringId: string;
  serviceId: string;
  businessSlug: string;
  code: string;
  name: string;
  description?: string;
  status: ServiceStatus;
  revision: number;
  durationMinutes: number;
  pricing: PricingDescriptor;
  priority: number;
  tags: readonly string[];
  requirements: readonly ServiceRequirement[];
  dependencies: readonly ServiceDependency[];
  eligibilityRuleSet?: EligibilityRuleSet;
}>;

export type ServiceOfferingSnapshot = Readonly<{
  offeringId: string;
  serviceId: string;
  businessSlug: string;
  serviceRevision: number;
  offeringRevision: number;
  code: string;
  name: string;
  durationMinutes: number;
  pricing: PricingDescriptor;
  requirements: readonly ServiceRequirement[];
}>;

export type ServicesValidationIssueCode =
  | 'INVALID_BUSINESS_SCOPE'
  | 'INVALID_IDENTITY'
  | 'INVALID_REVISION'
  | 'INVALID_TAGS'
  | 'INVALID_DURATION'
  | 'INVALID_PRICE'
  | 'INVALID_REQUIREMENT'
  | 'INVALID_DEPENDENCY'
  | 'INVALID_ELIGIBILITY_RULE';

export type ServicesValidationIssue = Readonly<{
  code: ServicesValidationIssueCode;
  path: string;
  message: string;
}>;
