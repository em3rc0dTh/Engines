import type {
  AppointmentProduct,
  AppointmentService,
} from '../contracts/register-new-appointment/index.js';
import type {
  ServiceDefinition,
  ServiceOffering,
  ServiceOfferingSnapshot,
} from '../contracts/services-engine/index.js';

export function toAppointmentService(service: ServiceDefinition): AppointmentService {
  return {
    serviceId: service.serviceId,
    code: service.code,
    name: service.name,
    businessSlug: service.businessSlug,
    ...(service.description ? { description: service.description } : {}),
    status: service.status,
    revision: service.revision,
    tags: service.tags,
  };
}

export function toAppointmentProduct(offering: ServiceOffering): AppointmentProduct {
  return {
    productId: offering.offeringId,
    serviceId: offering.serviceId,
    code: offering.code,
    name: offering.name,
    ...(offering.description ? { description: offering.description } : {}),
    durationMinutes: offering.durationMinutes,
    businessSlug: offering.businessSlug,
    status: offering.status,
    revision: offering.revision,
    pricing: offering.pricing,
    priority: offering.priority,
    tags: offering.tags,
    requirements: offering.requirements,
    dependencies: offering.dependencies,
    ...(offering.eligibilityRuleSet
      ? { eligibilityRuleSet: offering.eligibilityRuleSet }
      : {}),
  };
}

export function snapshotOffering(
  service: ServiceDefinition,
  offering: ServiceOffering,
): ServiceOfferingSnapshot {
  if (service.businessSlug !== offering.businessSlug || service.serviceId !== offering.serviceId) {
    throw new Error('SERVICES_SNAPSHOT_SERVICE_OFFERING_MISMATCH');
  }
  return {
    offeringId: offering.offeringId,
    serviceId: offering.serviceId,
    businessSlug: offering.businessSlug,
    serviceRevision: service.revision,
    offeringRevision: offering.revision,
    code: offering.code,
    name: offering.name,
    durationMinutes: offering.durationMinutes,
    pricing: offering.pricing,
    requirements: offering.requirements,
  };
}
