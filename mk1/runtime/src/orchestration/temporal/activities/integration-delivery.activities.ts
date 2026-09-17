import { Pool } from 'pg';
import { loadRuntimeConfig } from '../../../config/runtime-config.js';
import { executeIntegrationOutboundOperation } from '../../../integration/delivery-executor.js';
import { IntegrationProviderAdapterRegistry } from '../../../integration/provider.js';
import { KapsoWhatsAppIntegrationAdapter } from '../../../integration/providers/kapso-whatsapp.js';
import { EnvironmentIntegrationSecretResolver } from '../../../integration/secret-resolution.js';
import { PostgresIntegrationOutboundLedger } from '../../../persistence/postgres/integration-outbound-ledger.repository.js';
import { PostgresIntegrationRegistryRepository } from '../../../persistence/postgres/integration-registry.repository.js';
import type {
  IntegrationDeliveryActivityInput,
  IntegrationDeliveryActivityResult,
  IntegrationTemporalActivities,
} from './integration-delivery.types.js';

export type IntegrationDeliveryActivityDependencies = Readonly<{
  connections: PostgresIntegrationRegistryRepository;
  ledger: PostgresIntegrationOutboundLedger;
  adapters: IntegrationProviderAdapterRegistry;
  leaseSeconds?: number;
  now?: () => string;
}>;

function projection(record: Awaited<ReturnType<typeof executeIntegrationOutboundOperation>>): IntegrationDeliveryActivityResult {
  return {
    businessSlug: record.command.businessSlug,
    operationId: record.command.operationId,
    status: record.status,
    attemptCount: record.attemptCount,
    maxAttempts: record.maxAttempts,
    ...(record.nextAttemptAt === undefined ? {} : { nextAttemptAt: record.nextAttemptAt }),
    ...(record.leaseExpiresAt === undefined ? {} : { leaseExpiresAt: record.leaseExpiresAt }),
    ...(record.lastErrorCode === undefined ? {} : { lastErrorCode: record.lastErrorCode }),
    ...(record.providerReceiptRef === undefined ? {} : { providerReceiptRef: record.providerReceiptRef }),
  };
}

export function createIntegrationDeliveryActivities(
  dependencies: IntegrationDeliveryActivityDependencies,
): IntegrationTemporalActivities {
  const leaseSeconds = dependencies.leaseSeconds ?? 30;
  const now = dependencies.now ?? (() => new Date().toISOString());

  return {
    async executeIntegrationDelivery(input: IntegrationDeliveryActivityInput): Promise<IntegrationDeliveryActivityResult> {
      const record = await executeIntegrationOutboundOperation({
        businessSlug: input.businessSlug,
        operationId: input.operationId,
        now: now(),
        connections: dependencies.connections,
        ledger: dependencies.ledger,
        adapters: dependencies.adapters,
        leaseSeconds,
      });
      return projection(record);
    },
  };
}

export function createRuntimeIntegrationDeliveryActivities(): Readonly<{
  activities: IntegrationTemporalActivities;
  close: () => Promise<void>;
}> {
  const config = loadRuntimeConfig();
  const pool = new Pool({ connectionString: config.postgresUrl, max: 6 });
  const connections = new PostgresIntegrationRegistryRepository(pool);
  const ledger = new PostgresIntegrationOutboundLedger(pool);
  const secrets = new EnvironmentIntegrationSecretResolver(process.env);
  const adapters = new IntegrationProviderAdapterRegistry([
    new KapsoWhatsAppIntegrationAdapter(secrets),
  ]);

  return {
    activities: createIntegrationDeliveryActivities({ connections, ledger, adapters }),
    close: async () => pool.end(),
  };
}
