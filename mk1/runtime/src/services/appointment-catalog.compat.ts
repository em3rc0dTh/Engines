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
