import { todayInTimeZone } from '../../../contracts/register-new-appointment/index.js';
import type { CustomerDraft } from '../../../contracts/register-new-customer/index.js';
import {
  closeAppointmentCustomerNameRepository,
  resolveAppointmentCustomerByName,
} from '../../../persistence/postgres/appointment-customer-name.repository.js';
import {
  bookAppointment,
  closeAppointmentRepository,
  getAppointmentById,
  listAppointmentSlots,
  reserveAppointmentCommand,
  resolveAppointmentCustomer,
} from '../../../persistence/postgres/appointment.repository.js';
import {
  closeManagedEntityRepository,
  createManagedEntityForCustomer,
  getManagedEntityForCustomer,
  listManagedEntitiesForCustomer,
} from '../../../persistence/postgres/managed-entity.repository.js';
import {
  toAppointmentProduct,
  toAppointmentService,
} from '../../../services/appointment-catalog.compat.js';
import type { AppointmentActivities } from './appointment.types.js';
import { servicesReadActivities } from './services-read.activities.js';

function hasStrongCustomerIdentity(customer: CustomerDraft | undefined): boolean {
  if (!customer) return false;
  if (customer.contact?.email?.trim()) return true;
  if ((customer.contact?.phones ?? []).some((phone) => Boolean(phone.normalized?.trim() || phone.number?.trim()))) {
    return true;
  }
  const document = customer.document;
  return Boolean(document?.type?.trim() && document.country?.trim() && document.value?.trim());
}

export const appointmentActivities: AppointmentActivities = {
  reserveAppointmentCommand: (input) => reserveAppointmentCommand(input.start, input.workflowId),
  getBusinessToday: (input) => Promise.resolve(todayInTimeZone(input.timeZone)),

  // ME1 customer-resolution rule:
  // - an explicit/trusted Customer id or strong identity (email/phone/document)
  //   goes directly through the canonical strong-identity resolver;
  // - otherwise a supplied name performs deterministic discovery first.
  // Name is not treated as globally unique: zero/multiple name matches return
  // control to Temporal so the CTA can request stronger identifying material.
  resolveAppointmentCustomer: (input) => {
    if (input.customerId || hasStrongCustomerIdentity(input.customer)) {
      return resolveAppointmentCustomer(input.businessSlug, input.customerId, input.customer);
    }
    if (input.customer?.name?.trim()) {
      return resolveAppointmentCustomerByName(input.businessSlug, input.customer.name);
    }
    return resolveAppointmentCustomer(input.businessSlug, input.customerId, input.customer);
  },

  listAppointmentManagedEntities: (input) =>
    listManagedEntitiesForCustomer(input.businessSlug, input.customerId, input.type),
  getAppointmentManagedEntity: (input) =>
    getManagedEntityForCustomer(input.businessSlug, input.customerId, input.managedEntityId),
  createAppointmentManagedEntity: (input) => createManagedEntityForCustomer(input),

  // S7 authority boundary: Appointment no longer performs its own Service/Product
  // catalog queries. The same canonical Services read activities used by the
  // standalone Services Engine supply the renderer-compatible projections.
  async listAppointmentServices(input) {
    const services = await servicesReadActivities.listServices({
      businessSlug: input.businessSlug,
    });
    return services.map(toAppointmentService);
  },

  async listAppointmentProducts(input) {
    const offerings = await servicesReadActivities.listOfferings({
      businessSlug: input.businessSlug,
      serviceId: input.serviceId,
    });
    return offerings.map(toAppointmentProduct);
  },

  // Slot generation/final persistence remains the inherited compatibility
  // boundary until G2 Scheduler. S7 changes catalog authority, not Scheduler
  // ownership.
  listAppointmentSlots: (input) =>
    listAppointmentSlots(input.businessSlug, input.productId, input.appointmentDate),
  bookAppointment: (input) => bookAppointment(input),
  getAppointment: (input) => getAppointmentById(input.appointmentId),
};

export async function closeAppointmentActivities(): Promise<void> {
  await Promise.all([
    closeAppointmentRepository(),
    closeAppointmentCustomerNameRepository(),
    closeManagedEntityRepository(),
  ]);
}
