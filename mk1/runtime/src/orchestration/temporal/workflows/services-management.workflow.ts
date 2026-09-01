import { proxyActivities, workflowInfo } from '@temporalio/workflow';
import {
  validateServicesMutationCommand,
  type ServicesMutationCommand,
  type ServicesMutationOutcome,
} from '../../../contracts/services-engine/index.js';
import type { ServicesManagementActivities } from '../activities/services-management.types.js';
import type { ServicesAuditActivities } from '../activities/services-audit.types.js';

const management = proxyActivities<ServicesManagementActivities>({
  startToCloseTimeout: '15 seconds',
  retry: {
    initialInterval: '250 milliseconds',
    backoffCoefficient: 2,
    maximumInterval: '5 seconds',
    maximumAttempts: 8,
  },
});

const audit = proxyActivities<ServicesAuditActivities>({
  startToCloseTimeout: '15 seconds',
  retry: {
    initialInterval: '250 milliseconds',
    backoffCoefficient: 2,
    maximumInterval: '5 seconds',
    maximumAttempts: 8,
  },
});

function validationRejection(
  command: ServicesMutationCommand,
): ServicesMutationOutcome | undefined {
  const issues = validateServicesMutationCommand(command);
  if (issues.length === 0) return undefined;
  return {
    status: 'REJECTED',
    operation: command.operation,
    businessSlug: command.businessSlug,
    idempotencyKey: command.idempotencyKey,
    code: 'VALIDATION_ERROR',
    message: 'Services mutation command failed deterministic validation',
    issues,
  };
}

export async function servicesManagementWorkflow(
  command: ServicesMutationCommand,
): Promise<ServicesMutationOutcome> {
  const workflowId = workflowInfo().workflowId;
  const validation = validationRejection(command);
  const referenceValidation = validation
    ? undefined
    : await management.validateServicesMutationReferences({ command });
  const outcome = validation
    ?? referenceValidation
    ?? await management.applyServicesMutation({ workflowId, command });

  await audit.persistServicesMutationAudit({
    workflowId,
    occurredAt: new Date().toISOString(),
    command,
    outcome,
  });

  return outcome;
}
