import { servicesRepository } from '../../../persistence/postgres/services.repository.js';
import type { ServicesReadActivities } from './services-read.types.js';

export const servicesReadActivities: ServicesReadActivities = {
  async listServices({ businessSlug }) {
    return await servicesRepository().listServices(businessSlug);
  },

  async getService({ businessSlug, serviceIdOrCode }) {
    return await servicesRepository().getService(businessSlug, serviceIdOrCode);
  },

  async listOfferings({ businessSlug, serviceId }) {
    return await servicesRepository().listOfferings(businessSlug, serviceId);
  },

  async getOffering({ businessSlug, offeringIdOrCode }) {
    return await servicesRepository().getOffering(businessSlug, offeringIdOrCode);
  },
};
