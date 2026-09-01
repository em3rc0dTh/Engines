import {
  closeServicesManagementRepository,
  servicesManagementRepository,
} from '../../../persistence/postgres/services-management.repository.js';
import {
  closeServicesManagementPreflightRepository,
  servicesManagementPreflightRepository,
} from '../../../persistence/postgres/services-management-preflight.repository.js';
import type { ServicesManagementActivities } from './services-management.types.js';

export const servicesManagementActivities: ServicesManagementActivities = {
  async validateServicesMutationReferences(input) {
    return servicesManagementPreflightRepository().validateReferences(input.command);
  },
  async applyServicesMutation(input) {
    return servicesManagementRepository().applyMutation(input.workflowId, input.command);
  },
};

export async function closeServicesManagementActivities(): Promise<void> {
  await Promise.all([
    closeServicesManagementRepository(),
    closeServicesManagementPreflightRepository(),
  ]);
}
