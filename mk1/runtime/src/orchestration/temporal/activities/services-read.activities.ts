import { Pool } from 'pg';
import { loadRuntimeConfig } from '../../../config/runtime-config.js';
import { PostgresServicesRepository } from '../../../persistence/postgres/services.repository.js';
import type { ServicesReadActivities } from './services-read.types.js';

let pool: Pool | undefined;
let repository: PostgresServicesRepository | undefined;

function servicesReadRepository(): PostgresServicesRepository {
  pool ??= new Pool({ connectionString: loadRuntimeConfig().postgresUrl, max: 8 });
  repository ??= new PostgresServicesRepository(pool);
  return repository;
}

export const servicesReadActivities: ServicesReadActivities = {
  async listServices({ businessSlug }) {
    return servicesReadRepository().listServices(businessSlug);
  },

  async getService({ businessSlug, serviceIdOrCode }) {
    return servicesReadRepository().getService(businessSlug, serviceIdOrCode);
  },

  async listOfferings({ businessSlug, serviceId }) {
    return servicesReadRepository().listOfferings(businessSlug, serviceId);
  },

  async getOffering({ businessSlug, offeringIdOrCode }) {
    return servicesReadRepository().getOffering(businessSlug, offeringIdOrCode);
  },
};

export async function closeServicesReadActivities(): Promise<void> {
  const current = pool;
  pool = undefined;
  repository = undefined;
  if (current) await current.end();
}
