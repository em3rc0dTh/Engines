import {
  closeServicesAuditRepository,
  persistServicesMutationAudit,
} from '../../../persistence/mongo/services-audit.repository.js';
import type { ServicesAuditActivities } from './services-audit.types.js';

export const servicesAuditActivities: ServicesAuditActivities = {
  persistServicesMutationAudit,
};

export async function closeServicesAuditActivities(): Promise<void> {
  await closeServicesAuditRepository();
}
