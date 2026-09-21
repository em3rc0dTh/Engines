import { todayInTimeZone } from '../../../contracts/register-new-appointment/index.js';
import {
  bookAppointment,
  closeAppointmentRepository,
  getAppointmentById,
  listAppointmentSlots,
  reserveAppointmentCommand,
  resolveAppointmentCustomer,
} from '../../../persistence/postgres/appointment.repository.js';
import {
  toAppointmentProduct,
  toAppointmentService,
} from '../../../services/appointment-catalog.compat.js';
import type { AppointmentActivities } from './appointment.types.js';
import { servicesReadActivities } from './services-read.activities.js';

export const appointmentActivities: AppointmentActivities = {
  reserveAppointmentCommand: (input) => reserveAppointmentCommand(input.start, input.workflowId),
  getBusinessToday: (input) => Promise.resolve(todayInTimeZone(input.timeZone)),
  resolveAppointmentCustomer: (input) =>
    resolveAppointmentCustomer(input.businessSlug, input.customerId, input.customer),

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
  await closeAppointmentRepository();
}
