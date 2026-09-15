import { Context } from '@temporalio/activity';
import { todayInTimeZone } from '../../../contracts/register-new-appointment/index.js';
import {
  closeAppointmentRepository,
  reserveAppointmentCommand,
  resolveAppointmentCustomer,
} from '../../../persistence/postgres/appointment.repository.js';
import {
  closeAppointmentSchedulerCompensation,
  compensateFailedAppointmentSchedulerReservation,
} from '../../../persistence/postgres/appointment-scheduler-compensation.js';
import {
  bookAppointmentViaScheduler,
  closeAppointmentSchedulerRepository,
  freezeAppointmentSchedulingDemands,
  getSchedulerBackedAppointmentById,
  listAppointmentSlotsViaScheduler,
} from '../../../persistence/postgres/appointment-scheduler.repository.js';
import {
  toAppointmentProduct,
  toAppointmentService,
} from '../../../services/appointment-catalog.compat.js';
import type { AppointmentActivities } from './appointment.types.js';
import { servicesReadActivities } from './services-read.activities.js';

const APPOINTMENT_ACTIVITY_MAX_ATTEMPTS = 3;

function currentWorkflowId(): string {
  const workflowExecution = Context.current().info.workflowExecution;
  if (!workflowExecution) throw new Error('APPOINTMENT_ACTIVITY_WORKFLOW_EXECUTION_MISSING');
  return workflowExecution.workflowId;
}

export const appointmentActivities: AppointmentActivities = {
  reserveAppointmentCommand: (input) => reserveAppointmentCommand(input.start, input.workflowId),
  getBusinessToday: (input) => Promise.resolve(todayInTimeZone(input.timeZone)),
  resolveAppointmentCustomer: (input) =>
    resolveAppointmentCustomer(input.businessSlug, input.customerId, input.customer),

  // Canonical Services authority remains unchanged by G2-S7.
  async listAppointmentServices(input) {
    const services = await servicesReadActivities.listServices({
      businessSlug: input.businessSlug,
    });
    return services.map(toAppointmentService);
  },

  async listAppointmentProducts(input) {
    const [service, offerings] = await Promise.all([
      servicesReadActivities.getService({
        businessSlug: input.businessSlug,
        serviceIdOrCode: input.serviceId,
      }),
      servicesReadActivities.listOfferings({
        businessSlug: input.businessSlug,
        serviceId: input.serviceId,
      }),
    ]);
    if (!service || service.status !== 'ACTIVE') return [];

    // G2-S7 freezes the exact schedulable Services projections shown to this
    // durable Appointment workflow before a user can select one. The resulting
    // SchedulingDemand is immutable and survives catalog revision advances.
    const schedulable = await freezeAppointmentSchedulingDemands({
      businessSlug: input.businessSlug,
      workflowId: currentWorkflowId(),
      service,
      offerings,
    });
    return schedulable.map(toAppointmentProduct);
  },

  // Stable Appointment activity names are intentionally preserved for channel
  // compatibility. Their authority is now canonical G2 Scheduler: availability
  // is advisory and explicit Finalize commits through ConfirmReservation.
  listAppointmentSlots: (input) =>
    listAppointmentSlotsViaScheduler({
      businessSlug: input.businessSlug,
      workflowId: currentWorkflowId(),
      productId: input.productId,
      appointmentDate: input.appointmentDate,
    }),
  async bookAppointment(input) {
    try {
      return await bookAppointmentViaScheduler(input);
    } catch (error) {
      // Keep the durable Scheduler confirmation available for ordinary Temporal
      // Activity retries. Only when the configured retry budget is exhausted do
      // we compensate a reservation that never acquired an Appointment record.
      if (Context.current().info.attempt >= APPOINTMENT_ACTIVITY_MAX_ATTEMPTS) {
        try {
          await compensateFailedAppointmentSchedulerReservation({
            businessSlug: input.businessSlug,
            workflowId: input.workflowId,
          });
        } catch (compensationError) {
          const detail = compensationError instanceof Error
            ? compensationError.message
            : String(compensationError);
          throw new Error(`APPOINTMENT_SCHEDULER_COMPENSATION_FAILED:${detail}`);
        }
      }
      throw error;
    }
  },
  getAppointment: (input) => getSchedulerBackedAppointmentById(input.appointmentId),
};

export async function closeAppointmentActivities(): Promise<void> {
  await Promise.all([
    closeAppointmentRepository(),
    closeAppointmentSchedulerRepository(),
    closeAppointmentSchedulerCompensation(),
  ]);
}
