import type {
  ServicesMutationCommand,
  ServicesMutationOutcome,
} from '../../../contracts/services-engine/index.js';

export type ApplyServicesMutationInput = Readonly<{
  workflowId: string;
  command: ServicesMutationCommand;
}>;

export type ServicesManagementActivities = Readonly<{
  applyServicesMutation(input: ApplyServicesMutationInput): Promise<ServicesMutationOutcome>;
}>;
