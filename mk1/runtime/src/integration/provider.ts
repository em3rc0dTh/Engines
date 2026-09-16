import type { IntegrationCommand, IntegrationErrorCode } from '../contracts/integration-engine/index.js';
import type { IntegrationConnection } from './registry.js';

export type IntegrationProviderDeliveryResult =
  | Readonly<{ kind: 'SUCCEEDED'; providerReceiptRef?: string }>
  | Readonly<{ kind: 'RETRYABLE'; errorCode: IntegrationErrorCode }>
  | Readonly<{ kind: 'FAILED_PERMANENT'; errorCode: IntegrationErrorCode }>;

export interface IntegrationProviderAdapter {
  readonly providerKind: string;
  deliver(
    command: IntegrationCommand,
    connection: IntegrationConnection,
  ): Promise<IntegrationProviderDeliveryResult>;
}

export class IntegrationProviderError extends Error {
  constructor(readonly code: IntegrationErrorCode, message: string = code) {
    super(message);
    this.name = 'IntegrationProviderError';
  }
}

export class IntegrationProviderAdapterRegistry {
  private readonly adapters = new Map<string, IntegrationProviderAdapter>();

  constructor(adapters: readonly IntegrationProviderAdapter[] = []) {
    for (const adapter of adapters) this.register(adapter);
  }

  register(adapter: IntegrationProviderAdapter): void {
    if (this.adapters.has(adapter.providerKind)) {
      throw new IntegrationProviderError(
        'PERMANENT_PROVIDER_FAILURE',
        `PROVIDER_ADAPTER_DUPLICATE:${adapter.providerKind}`,
      );
    }
    this.adapters.set(adapter.providerKind, adapter);
  }

  get(providerKind: string): IntegrationProviderAdapter {
    const adapter = this.adapters.get(providerKind);
    if (!adapter) {
      throw new IntegrationProviderError(
        'PERMANENT_PROVIDER_FAILURE',
        `PROVIDER_ADAPTER_NOT_FOUND:${providerKind}`,
      );
    }
    return adapter;
  }
}
