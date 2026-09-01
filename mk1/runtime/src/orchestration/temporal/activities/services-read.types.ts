import type {
  ServiceDefinition,
  ServiceOffering,
} from '../../../contracts/services-engine/index.js';

export type ServicesReadActivities = Readonly<{
  listServices(input: Readonly<{ businessSlug: string }>): Promise<readonly ServiceDefinition[]>;
  getService(input: Readonly<{ businessSlug: string; serviceIdOrCode: string }>): Promise<ServiceDefinition | undefined>;
  listOfferings(input: Readonly<{ businessSlug: string; serviceId: string }>): Promise<readonly ServiceOffering[]>;
  getOffering(input: Readonly<{ businessSlug: string; offeringIdOrCode: string }>): Promise<ServiceOffering | undefined>;
}>;
