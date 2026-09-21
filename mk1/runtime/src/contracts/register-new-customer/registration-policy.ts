import { normalizeCustomerDraft } from './normalization.js';
import type {
  CustomerDraft,
  DuplicateClassification,
  RegisterNewCustomerDraft,
} from './types.js';

export type RequiredRegistrationField =
  | 'customer.type'
  | 'customer.name'
  | 'customer.contact.phone'
  | 'customer.contact.email'
  | 'customer.contact.phoneOrEmail'
  | 'customer.document'
  | 'customer.document.type'
  | 'customer.document.country'
  | 'customer.document.value'
  | 'draft.attachments';

export type DuplicateFieldSelector =
  | 'customer.document.type+customer.document.country+customer.document.value'
  | 'customer.contact.phones[].normalized'
  | 'customer.contact.email'
  | 'customer.name';

export type DuplicatePolicy = Readonly<{
  hardUnique: readonly DuplicateFieldSelector[];
  softMatch: readonly DuplicateFieldSelector[];
  nonUnique: readonly DuplicateFieldSelector[];
}>;

export type RegistrationPolicy = Readonly<{
  policyId: string;
  policyVersion: string;
  businessSlug: string;
  required: readonly RequiredRegistrationField[];
  duplicatePolicy: DuplicatePolicy;
  documentRequired: boolean;
  attachmentsRequired: boolean;
  normalizationProfile: 'mk0.customer-normalization.v1';
}>;

export type RegistrationCompleteness = Readonly<{
  complete: boolean;
  knownFields: readonly string[];
  missingFields: readonly RequiredRegistrationField[];
}>;

const SUPPORTED_REQUIRED_FIELDS: ReadonlySet<RequiredRegistrationField> = new Set([
  'customer.type',
  'customer.name',
  'customer.contact.phone',
  'customer.contact.email',
  'customer.contact.phoneOrEmail',
  'customer.document',
  'customer.document.type',
  'customer.document.country',
  'customer.document.value',
  'draft.attachments',
]);

const SUPPORTED_DUPLICATE_SELECTORS: ReadonlySet<DuplicateFieldSelector> = new Set([
  'customer.document.type+customer.document.country+customer.document.value',
  'customer.contact.phones[].normalized',
  'customer.contact.email',
  'customer.name',
]);

function nonEmpty(value: string | undefined): boolean {
  return Boolean(value?.trim());
}

function hasDocument(customer: CustomerDraft): boolean {
  return Boolean(
    nonEmpty(customer.document?.type) &&
      nonEmpty(customer.document?.country) &&
      nonEmpty(customer.document?.value),
  );
}

function hasPhoneOrEmail(customer: CustomerDraft): boolean {
  const hasEmail = nonEmpty(customer.contact?.email);
  const hasPhone = (customer.contact?.phones ?? []).some((phone) =>
    nonEmpty(phone.normalized ?? phone.number),
  );
  return hasEmail || hasPhone;
}

function hasPhone(customer: CustomerDraft): boolean {
  return (customer.contact?.phones ?? []).some((phone) =>
    nonEmpty(phone.normalized ?? phone.number),
  );
}

function requirementSatisfied(
  requirement: RequiredRegistrationField,
  draft: RegisterNewCustomerDraft,
): boolean {
  const customer = normalizeCustomerDraft(draft.customer);

  switch (requirement) {
    case 'customer.type':
      return nonEmpty(customer.type);
    case 'customer.name':
      return nonEmpty(customer.name);
    case 'customer.contact.phone':
      return hasPhone(customer);
    case 'customer.contact.email':
      return nonEmpty(customer.contact?.email);
    case 'customer.contact.phoneOrEmail':
      return hasPhoneOrEmail(customer);
    case 'customer.document':
      return hasDocument(customer);
    case 'customer.document.type':
      return nonEmpty(customer.document?.type);
    case 'customer.document.country':
      return nonEmpty(customer.document?.country);
    case 'customer.document.value':
      return nonEmpty(customer.document?.value);
    case 'draft.attachments':
      return (draft.attachments ?? []).length > 0;
  }
}

function unique<T>(values: readonly T[]): readonly T[] {
  return [...new Set(values)];
}

export function expandPolicyRequirements(policy: RegistrationPolicy): readonly RequiredRegistrationField[] {
  return unique([
    ...policy.required,
    ...(policy.documentRequired ? (['customer.document'] as const) : []),
    ...(policy.attachmentsRequired ? (['draft.attachments'] as const) : []),
  ]);
}

export function evaluateRegistrationCompleteness(
  policy: RegistrationPolicy,
  draft: RegisterNewCustomerDraft = {},
): RegistrationCompleteness {
  const requirements = expandPolicyRequirements(policy);
  const missingFields = requirements.filter((requirement) => !requirementSatisfied(requirement, draft));
  const knownFields = requirements.filter((requirement) => !missingFields.includes(requirement));

  return {
    complete: missingFields.length === 0,
    knownFields,
    missingFields,
  };
}

export function validateRegistrationPolicy(policy: RegistrationPolicy): readonly string[] {
  const issues: string[] = [];

  if (!nonEmpty(policy.policyId)) issues.push('policyId is required');
  if (!nonEmpty(policy.policyVersion)) issues.push('policyVersion is required');
  if (!nonEmpty(policy.businessSlug)) issues.push('businessSlug is required');
  if (policy.normalizationProfile !== 'mk0.customer-normalization.v1') {
    issues.push('normalizationProfile is unsupported');
  }

  for (const requirement of policy.required) {
    if (!SUPPORTED_REQUIRED_FIELDS.has(requirement)) {
      issues.push(`unsupported required field: ${String(requirement)}`);
    }
  }

  const duplicateGroups: readonly [DuplicateClassification, readonly DuplicateFieldSelector[]][] = [
    ['HARD_UNIQUE', policy.duplicatePolicy.hardUnique],
    ['SOFT_MATCH', policy.duplicatePolicy.softMatch],
    ['NON_UNIQUE', policy.duplicatePolicy.nonUnique],
  ];

  const seen = new Map<DuplicateFieldSelector, DuplicateClassification>();
  for (const [classification, selectors] of duplicateGroups) {
    for (const selector of selectors) {
      if (!SUPPORTED_DUPLICATE_SELECTORS.has(selector)) {
        issues.push(`unsupported duplicate selector: ${String(selector)}`);
        continue;
      }

      const previous = seen.get(selector);
      if (previous && previous !== classification) {
        issues.push(`duplicate selector ${selector} cannot be both ${previous} and ${classification}`);
      } else {
        seen.set(selector, classification);
      }
    }
  }

  if (policy.duplicatePolicy.nonUnique.includes('customer.name') === false) {
    issues.push('customer.name must remain NON_UNIQUE in mk0');
  }

  return issues;
}

export const GOLDEN_REGISTRATION_POLICY_V1 = {
  policyId: 'golden-registration-v1',
  policyVersion: '1',
  businessSlug: 'golden-business',
  required: ['customer.name', 'customer.contact.phoneOrEmail'],
  duplicatePolicy: {
    hardUnique: ['customer.document.type+customer.document.country+customer.document.value'],
    softMatch: ['customer.contact.phones[].normalized', 'customer.contact.email'],
    nonUnique: ['customer.name'],
  },
  documentRequired: false,
  attachmentsRequired: false,
  normalizationProfile: 'mk0.customer-normalization.v1',
} as const satisfies RegistrationPolicy;

/** MK1 policy revision. V1 remains immutable for existing callers. */
export const GOLDEN_REGISTRATION_POLICY_V2 = {
  ...GOLDEN_REGISTRATION_POLICY_V1,
  policyId: 'golden-registration-v2',
  policyVersion: '2',
  required: [
    'customer.name',
    'customer.contact.phone',
    'customer.contact.email',
  ],
} as const satisfies RegistrationPolicy;
