import type {
  ServicesMutationCommand,
  ServicesMutationOutcome,
  ServicesMutationRejected,
} from '../../../contracts/services-engine/index.js';

export type ApplyServicesMutationInput = Readonly<{
  workflowId: string;
  command: ServicesMutationCommand;
}>;

export type ValidateServicesMutationReferencesInput = Readonly<{
  command: ServicesMutationCommand;
}>;

export type ServicesManagementActivities = Readonly<{
  validateServicesMutationReferences(
    input: ValidateServicesMutationReferencesInput,
  ): Promise<ServicesMutationRejected | undefined>;
  applyServicesMutation(input: ApplyServicesMutationInput): Promise<ServicesMutationOutcome>;
}>;
