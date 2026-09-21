import { Pool } from 'pg';
import { loadRuntimeConfig } from '../../config/runtime-config.js';
import type {
  ServiceDependency,
  ServicesMutationCommand,
  ServicesMutationRejected,
} from '../../contracts/services-engine/index.js';

function dependencyList(command: ServicesMutationCommand): readonly ServiceDependency[] {
  if (command.operation === 'CreateOffering') return command.offering.dependencies;
  if (command.operation === 'UpdateOffering') return command.patch.dependencies ?? [];
  return [];
}

function offeringId(command: ServicesMutationCommand): string | undefined {
  if (command.operation === 'CreateOffering') return command.offering.offeringId;
  if (command.operation === 'UpdateOffering') return command.offeringId;
  return undefined;
}

export class PostgresServicesManagementPreflightRepository {
  constructor(private readonly pool: Pool) {}

  async validateReferences(
    command: ServicesMutationCommand,
  ): Promise<ServicesMutationRejected | undefined> {
    const dependencies = dependencyList(command);
    if (dependencies.length === 0) return undefined;

    const targetIds = [...new Set(dependencies.map((item) => item.targetOfferingId))].sort();
    const result = await this.pool.query<{ product_id: string }>(
      `SELECT product_id
         FROM service_products
        WHERE business_slug = $1
          AND product_id = ANY($2::text[])`,
      [command.businessSlug, targetIds],
    );
    const found = new Set(result.rows.map((row) => row.product_id));
    const missing = targetIds.filter((targetId) => !found.has(targetId));
    if (missing.length === 0) return undefined;

    return {
      status: 'REJECTED',
      operation: command.operation,
      businessSlug: command.businessSlug,
      idempotencyKey: command.idempotencyKey,
      code: 'NOT_FOUND',
      message: `Offering dependency target(s) not found in business scope: ${missing.join(', ')}`,
      entityType: 'OFFERING',
      ...(offeringId(command) ? { entityId: offeringId(command)! } : {}),
    };
  }
}

let defaultPool: Pool | undefined;
let defaultRepository: PostgresServicesManagementPreflightRepository | undefined;

export function servicesManagementPreflightRepository(): PostgresServicesManagementPreflightRepository {
  defaultPool ??= new Pool({ connectionString: loadRuntimeConfig().postgresUrl, max: 4 });
  defaultRepository ??= new PostgresServicesManagementPreflightRepository(defaultPool);
  return defaultRepository;
}

export async function closeServicesManagementPreflightRepository(): Promise<void> {
  const current = defaultPool;
  defaultPool = undefined;
  defaultRepository = undefined;
  if (current) await current.end();
}
