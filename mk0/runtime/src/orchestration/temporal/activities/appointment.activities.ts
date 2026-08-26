import {
  bookAppointment,
  closeAppointmentRepository,
  getAppointmentById,
  listAppointmentProducts,
  listAppointmentServices,
  listAppointmentSlots,
  reserveAppointmentCommand,
  resolveAppointmentCustomer,
} from '../../../persistence/postgres/appointment.repository.js';
import type { AppointmentActivities } from './appointment.types.js';

export const appointmentActivities: AppointmentActivities = {
  reserveAppointmentCommand: (input) => reserveAppointmentCommand(input.start, input.workflowId),
  resolveAppointmentCustomer: (input) =>
    resolveAppointmentCustomer(input.businessSlug, input.customerId, input.customer),
  listAppointmentServices: (input) => listAppointmentServices(input.businessSlug),
  listAppointmentProducts: (input) => listAppointmentProducts(input.businessSlug, input.serviceId),
  listAppointmentSlots: (input) =>
    listAppointmentSlots(input.businessSlug, input.productId, input.appointmentDate),
  bookAppointment: (input) => bookAppointment(input),
  getAppointment: (input) => getAppointmentById(input.appointmentId),
};

export async function closeAppointmentActivities(): Promise<void> {
  await closeAppointmentRepository();
}
