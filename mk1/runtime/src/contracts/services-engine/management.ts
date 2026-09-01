import type {
  EligibilityRuleSet,
  PricingDescriptor,
  ServiceDefinition,
  ServiceDependency,
  ServiceOffering,
  ServiceRequirement,
  ServiceStatus,
  ServicesValidationIssue,
} from './types.js';
import {
  validateBusinessScope,
  validateDurationMinutes,
  validateEligibilityRuleSet,
  validateIdentity,
  validatePricingDescriptor,
  validateRevision,
  validateServiceDependency,
  validateServiceRequirement,
  validateTags,
} from './validation.js';

export type ServicesMutationOperation =
  | 'CreateService'
  | 'UpdateService'
  | 'SetServiceStatus'
  | 'CreateOffering'
  | 'UpdateOffering'
  | 'SetOfferingStatus';

export type CreateServiceCommand = Readonly<{
  operation: 'CreateService';
  businessSlug: string;
  idempotencyKey: string;
  service: Readonly<{
    serviceId: string;
    code: string;
    name: string;
    description?: string;
    tags: readonly string[];
  }>;
}>;

export type UpdateServiceCommand = Readonly<{
  operation: 'UpdateService';
  businessSlug: string;
  idempotencyKey: string;
  serviceId: string;
  expectedRevision: number;
  patch: Readonly<{
    code?: string;
    name?: string;
    description?: string | null;
    tags?: readonly string[];
  }>;
}>;

export type SetServiceStatusCommand = Readonly<{
  operation: 'SetServiceStatus';
  businessSlug: string;
  idempotencyKey: string;
  serviceId: string;
  expectedRevision: number;
  status: ServiceStatus;
}>;

export type CreateOfferingCommand = Readonly<{
  operation: 'CreateOffering';
  businessSlug: string;
  idempotencyKey: string;
  offering: Readonly<{
    offeringId: string;
    serviceId: string;
    code: string;
    name: string;
    description?: string;
    durationMinutes: number;
    pricing: PricingDescriptor;
    priority: number;
    tags: readonly string[];
    requirements: readonly ServiceRequirement[];
    dependencies: readonly ServiceDependency[];
    eligibilityRuleSet?: EligibilityRuleSet;
  }>;
}>;

export type UpdateOfferingCommand = Readonly<{
  operation: 'UpdateOffering';
  businessSlug: string;
  idempotencyKey: string;
  offeringId: string;
  expectedRevision: number;
  patch: Readonly<{
    serviceId?: string;
    code?: string;
    name?: string;
    description?: string | null;
    durationMinutes?: number;
    pricing?: PricingDescriptor;
    priority?: number;
    tags?: readonly string[];
    requirements?: readonly ServiceRequirement[];
    dependencies?: readonly ServiceDependency[];
    eligibilityRuleSet?: EligibilityRuleSet | null;
  }>;
}>;

export type SetOfferingStatusCommand = Readonly<{
  operation: 'SetOfferingStatus';
  businessSlug: string;
  idempotencyKey: string;
  offeringId: string;
  expectedRevision: number;
  status: ServiceStatus;
}>;

export type ServicesMutationCommand =
  | CreateServiceCommand
  | UpdateServiceCommand
  | SetServiceStatusCommand
  | CreateOfferingCommand
  | UpdateOfferingCommand
  | SetOfferingStatusCommand;

export type ServicesMutationRejectionCode =
  | 'VALIDATION_ERROR'
  | 'IDEMPOTENCY_CONFLICT'
  | 'REVISION_CONFLICT'
  | 'NOT_FOUND'
  | 'PARENT_NOT_FOUND'
  | 'IDENTITY_CONFLICT';

export type ServicesMutationSuccess = Readonly<{
  status: 'APPLIED' | 'REPLAYED';
  operation: ServicesMutationOperation;
  businessSlug: string;
  idempotencyKey: string;
  entityType: 'SERVICE' | 'OFFERING';
  entityId: string;
  revision: number;
  entity: ServiceDefinition | ServiceOffering;
}>;

export type ServicesMutationRejected = Readonly<{
  status: 'REJECTED';
  operation: ServicesMutationOperation;
  businessSlug: string;
  idempotencyKey: string;
  code: ServicesMutationRejectionCode;
  message: string;
  entityType?: 'SERVICE' | 'OFFERING';
  entityId?: string;
  expectedRevision?: number;
  currentRevision?: number;
  issues?: readonly ServicesValidationIssue[];
}>;

export type ServicesMutationOutcome = ServicesMutationSuccess | ServicesMutationRejected;

function issue(path: string, message: string): ServicesValidationIssue {
  return { code: 'INVALID_IDENTITY', path, message };
}

function validateText(path: string, value: unknown): readonly ServicesValidationIssue[] {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return [issue(path, `${path} must be a non-empty string`)];
  }
  return [];
}

function validateStatus(path: string, value: unknown): readonly ServicesValidationIssue[] {
  if (value !== 'ACTIVE' && value !== 'INACTIVE') {
    return [issue(path, `${path} must be ACTIVE or INACTIVE`)];
  }
  return [];
}

function validatePriority(value: unknown): readonly ServicesValidationIssue[] {
  if (!Number.isSafeInteger(value) || Number(value) < -1_000_000 || Number(value) > 1_000_000) {
    return [issue('priority', 'priority must be an integer from -1000000 to 1000000')];
  }
  return [];
}

function validateRequirements(values: readonly ServiceRequirement[]): readonly ServicesValidationIssue[] {
  return values.flatMap((value) => validateServiceRequirement(value));
}

function validateDependencies(
  offeringId: string,
  values: readonly ServiceDependency[],
): readonly ServicesValidationIssue[] {
  return values.flatMap((value) => validateServiceDependency(offeringId, value));
}

function validateOfferingBody(
  offering: CreateOfferingCommand['offering'],
): readonly ServicesValidationIssue[] {
  return [
    ...validateIdentity('offering.offeringId', offering.offeringId),
    ...validateIdentity('offering.serviceId', offering.serviceId),
    ...validateText('offering.code', offering.code),
    ...validateText('offering.name', offering.name),
    ...validateDurationMinutes(offering.durationMinutes),
    ...validatePricingDescriptor(offering.pricing),
    ...validatePriority(offering.priority),
    ...validateTags(offering.tags, 'offering.tags'),
    ...validateRequirements(offering.requirements),
    ...validateDependencies(offering.offeringId, offering.dependencies),
    ...(offering.eligibilityRuleSet
      ? validateEligibilityRuleSet(offering.eligibilityRuleSet)
      : []),
  ];
}

export function validateServicesMutationCommand(
  command: ServicesMutationCommand,
): readonly ServicesValidationIssue[] {
  const common = [
    ...validateBusinessScope(command.businessSlug),
    ...validateText('idempotencyKey', command.idempotencyKey),
  ];

  switch (command.operation) {
    case 'CreateService':
      return [
        ...common,
        ...validateIdentity('service.serviceId', command.service.serviceId),
        ...validateText('service.code', command.service.code),
        ...validateText('service.name', command.service.name),
        ...validateTags(command.service.tags, 'service.tags'),
      ];
    case 'UpdateService': {
      const patchKeys = Object.keys(command.patch);
      return [
        ...common,
        ...validateIdentity('serviceId', command.serviceId),
        ...validateRevision(command.expectedRevision, 'expectedRevision'),
        ...(patchKeys.length === 0 ? [issue('patch', 'service patch must not be empty')] : []),
        ...(command.patch.code !== undefined ? validateText('patch.code', command.patch.code) : []),
        ...(command.patch.name !== undefined ? validateText('patch.name', command.patch.name) : []),
        ...(command.patch.tags !== undefined ? validateTags(command.patch.tags, 'patch.tags') : []),
      ];
    }
    case 'SetServiceStatus':
      return [
        ...common,
        ...validateIdentity('serviceId', command.serviceId),
        ...validateRevision(command.expectedRevision, 'expectedRevision'),
        ...validateStatus('status', command.status),
      ];
    case 'CreateOffering':
      return [...common, ...validateOfferingBody(command.offering)];
    case 'UpdateOffering': {
      const patchKeys = Object.keys(command.patch);
      return [
        ...common,
        ...validateIdentity('offeringId', command.offeringId),
        ...validateRevision(command.expectedRevision, 'expectedRevision'),
        ...(patchKeys.length === 0 ? [issue('patch', 'offering patch must not be empty')] : []),
        ...(command.patch.serviceId !== undefined ? validateIdentity('patch.serviceId', command.patch.serviceId) : []),
        ...(command.patch.code !== undefined ? validateText('patch.code', command.patch.code) : []),
        ...(command.patch.name !== undefined ? validateText('patch.name', command.patch.name) : []),
        ...(command.patch.durationMinutes !== undefined ? validateDurationMinutes(command.patch.durationMinutes) : []),
        ...(command.patch.pricing !== undefined ? validatePricingDescriptor(command.patch.pricing) : []),
        ...(command.patch.priority !== undefined ? validatePriority(command.patch.priority) : []),
        ...(command.patch.tags !== undefined ? validateTags(command.patch.tags, 'patch.tags') : []),
        ...(command.patch.requirements !== undefined ? validateRequirements(command.patch.requirements) : []),
        ...(command.patch.dependencies !== undefined
          ? validateDependencies(command.offeringId, command.patch.dependencies)
          : []),
        ...(command.patch.eligibilityRuleSet
          ? validateEligibilityRuleSet(command.patch.eligibilityRuleSet)
          : []),
      ];
    }
    case 'SetOfferingStatus':
      return [
        ...common,
        ...validateIdentity('offeringId', command.offeringId),
        ...validateRevision(command.expectedRevision, 'expectedRevision'),
        ...validateStatus('status', command.status),
      ];
  }
}
