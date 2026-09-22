import type { IntegrationErrorCode } from '../contracts/integration-engine/index.js';
import type { IntegrationSecretReference } from './registry.js';

export class IntegrationSecretResolutionError extends Error {
  constructor(readonly code: IntegrationErrorCode, message: string = code) {
    super(message);
    this.name = 'IntegrationSecretResolutionError';
  }
}

/**
 * Runtime-only secret resolution boundary.
 *
 * Secret values cross this interface transiently and MUST NOT be persisted in
 * Integration commands, events, registry rows or delivery ledgers.
 */
export interface IntegrationSecretValueResolver {
  resolve(reference: IntegrationSecretReference): Promise<string>;
}

export class EnvironmentIntegrationSecretResolver implements IntegrationSecretValueResolver {
  constructor(private readonly environment: Readonly<Record<string, string | undefined>> = process.env) {}

  async resolve(reference: IntegrationSecretReference): Promise<string> {
    if (reference.bindingKind !== 'ENV') {
      throw new IntegrationSecretResolutionError(
        'PERMANENT_PROVIDER_FAILURE',
        `SECRET_BINDING_KIND_UNSUPPORTED:${reference.bindingKind}`,
      );
    }

    const value = this.environment[reference.bindingRef];
    if (value === undefined || value.trim().length === 0) {
      throw new IntegrationSecretResolutionError(
        'AUTHENTICATION_FAILED',
        `SECRET_BINDING_UNAVAILABLE:${reference.bindingRef}`,
      );
    }
    return value;
  }
}

export function secretReferenceForPurpose(
  references: readonly IntegrationSecretReference[],
  purpose: string,
): IntegrationSecretReference {
  const reference = references.find((entry) => entry.purpose === purpose);
  if (!reference) {
    throw new IntegrationSecretResolutionError(
      'AUTHENTICATION_FAILED',
      `SECRET_PURPOSE_NOT_CONFIGURED:${purpose}`,
    );
  }
  return reference;
}
