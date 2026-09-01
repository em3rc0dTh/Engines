import {
  closeServicesManagementRepository,
  servicesManagementRepository,
} from '../../../persistence/postgres/services-management.repository.js';
import type { ServicesManagementActivities } from './services-management.types.js';

export const servicesManagementActivities: ServicesManagementActivities = {
  async applyServicesMutation(input) {
    return servicesManagementRepository().applyMutation(input.workflowId, input.command);
  },
};

export async function closeServicesManagementActivities(): Promise<void> {
  await closeServicesManagementRepository();
}
