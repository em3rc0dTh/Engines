import type {
  ServicesMutationCommand,
  ServicesMutationOutcome,
} from '../../../contracts/services-engine/index.js';

export type ServicesMutationAuditInput = Readonly<{
  workflowId: string;
  occurredAt: string;
  command: ServicesMutationCommand;
  outcome: ServicesMutationOutcome;
}>;

export type ServicesAuditActivities = Readonly<{
  persistServicesMutationAudit(input: ServicesMutationAuditInput): Promise<Readonly<{
    persisted: boolean;
    reused: boolean;
  }>>;
}>;
