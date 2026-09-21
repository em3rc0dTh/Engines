import {
  closeAppointmentAuditRepository,
  persistAppointmentAuditEvents,
  verifyAppointmentAuditEvents,
} from '../../../persistence/mongo/appointment-audit.repository.js';
import type { AppointmentAuditActivities } from './appointment-audit.types.js';

export const appointmentAuditActivities: AppointmentAuditActivities = {
  persistAppointmentAudit: (input) => persistAppointmentAuditEvents(input.events),
  verifyAppointmentAudit: (input) => verifyAppointmentAuditEvents(input.workflowId, input.required),
};

export async function closeAppointmentAuditActivities(): Promise<void> {
  await closeAppointmentAuditRepository();
}
