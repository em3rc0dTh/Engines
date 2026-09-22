export type IntegrationProviderStatus = 'ENABLED' | 'DISABLED';
export type IntegrationConnectionStatus = 'ENABLED' | 'DISABLED';
export type IntegrationSecretBindingKind = 'ENV' | 'EXTERNAL_SECRET_STORE';

export type IntegrationProviderDefinition = Readonly<{
  providerKind: string;
  displayName: string;
  status: IntegrationProviderStatus;
  capabilities: readonly string[];
  revision: number;
}>;

/**
 * Durable pointer to secret material. The secret value itself is intentionally
 * outside this model and MUST NOT be persisted in the Integration registry.
 */
export type IntegrationSecretReference = Readonly<{
  secretRef: string;
  purpose: string;
  bindingKind: IntegrationSecretBindingKind;
  bindingRef: string;
}>;

export type IntegrationConnection = Readonly<{
  connectionRef: string;
  businessSlug: string;
  providerKind: string;
  externalAccountRef?: string;
  status: IntegrationConnectionStatus;
  capabilities: readonly string[];
  secretRefs: readonly IntegrationSecretReference[];
  revision: number;
  createdAt: string;
  updatedAt: string;
}>;

export type RegistryValidationIssue = Readonly<{
  code: string;
  path: string;
}>;

const IDENTIFIER = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const BUSINESS_SLUG = /^[a-z0-9][a-z0-9-]{0,127}$/;
const ENV_BINDING = /^[A-Z_][A-Z0-9_]{0,127}$/;

function pushIdentifierIssue(
  issues: RegistryValidationIssue[],
  value: string,
  path: string,
  pattern: RegExp = IDENTIFIER,
): void {
  if (!pattern.test(value)) issues.push({ code: 'INVALID_IDENTIFIER', path });
}

function duplicateValues(values: readonly string[]): readonly string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) duplicates.add(value);
    seen.add(value);
  }
  return [...duplicates];
}

export function validateIntegrationProviderDefinition(
  value: IntegrationProviderDefinition,
): readonly RegistryValidationIssue[] {
  const issues: RegistryValidationIssue[] = [];
  pushIdentifierIssue(issues, value.providerKind, 'providerKind');
  if (value.displayName.trim().length === 0) issues.push({ code: 'REQUIRED', path: 'displayName' });
  if (value.capabilities.length === 0) issues.push({ code: 'REQUIRED', path: 'capabilities' });
  value.capabilities.forEach((capability, index) => pushIdentifierIssue(issues, capability, `capabilities[${index}]`));
  if (duplicateValues(value.capabilities).length > 0) issues.push({ code: 'DUPLICATE', path: 'capabilities' });
  if (!Number.isInteger(value.revision) || value.revision < 1) issues.push({ code: 'INVALID_REVISION', path: 'revision' });
  return issues;
}

export function validateIntegrationSecretReference(
  value: IntegrationSecretReference,
): readonly RegistryValidationIssue[] {
  const issues: RegistryValidationIssue[] = [];
  pushIdentifierIssue(issues, value.secretRef, 'secretRef');
  pushIdentifierIssue(issues, value.purpose, 'purpose');
  if (value.bindingRef.trim().length === 0) issues.push({ code: 'REQUIRED', path: 'bindingRef' });
  if (value.bindingKind === 'ENV' && !ENV_BINDING.test(value.bindingRef)) {
    issues.push({ code: 'INVALID_ENV_BINDING', path: 'bindingRef' });
  }
  return issues;
}

export function validateIntegrationConnection(
  value: IntegrationConnection,
): readonly RegistryValidationIssue[] {
  const issues: RegistryValidationIssue[] = [];
  pushIdentifierIssue(issues, value.connectionRef, 'connectionRef');
  pushIdentifierIssue(issues, value.businessSlug, 'businessSlug', BUSINESS_SLUG);
  pushIdentifierIssue(issues, value.providerKind, 'providerKind');
  if (value.externalAccountRef !== undefined && value.externalAccountRef.trim().length === 0) {
    issues.push({ code: 'INVALID_EXTERNAL_ACCOUNT_REF', path: 'externalAccountRef' });
  }
  if (value.capabilities.length === 0) issues.push({ code: 'REQUIRED', path: 'capabilities' });
  value.capabilities.forEach((capability, index) => pushIdentifierIssue(issues, capability, `capabilities[${index}]`));
  if (duplicateValues(value.capabilities).length > 0) issues.push({ code: 'DUPLICATE', path: 'capabilities' });
  if (!Number.isInteger(value.revision) || value.revision < 1) issues.push({ code: 'INVALID_REVISION', path: 'revision' });

  const secretRefs = value.secretRefs.map((entry) => entry.secretRef);
  const purposes = value.secretRefs.map((entry) => entry.purpose);
  if (duplicateValues(secretRefs).length > 0) issues.push({ code: 'DUPLICATE', path: 'secretRefs.secretRef' });
  if (duplicateValues(purposes).length > 0) issues.push({ code: 'DUPLICATE', path: 'secretRefs.purpose' });
  value.secretRefs.forEach((entry, index) => {
    for (const issue of validateIntegrationSecretReference(entry)) {
      issues.push({ code: issue.code, path: `secretRefs[${index}].${issue.path}` });
    }
  });

  if (Number.isNaN(Date.parse(value.createdAt))) issues.push({ code: 'INVALID_TIMESTAMP', path: 'createdAt' });
  if (Number.isNaN(Date.parse(value.updatedAt))) issues.push({ code: 'INVALID_TIMESTAMP', path: 'updatedAt' });
  return issues;
}

export function assertRegistryValid(kind: string, issues: readonly RegistryValidationIssue[]): void {
  if (issues.length === 0) return;
  throw new Error(`${kind}_VALIDATION_FAILED:${issues.map((issue) => `${issue.code}@${issue.path}`).join(',')}`);
}
