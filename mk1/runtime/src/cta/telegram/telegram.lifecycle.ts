import type { ChannelBindingStatus } from '../channel-core/types.js';

export class TelegramWorkflowMissingError extends Error {
  constructor(readonly workflowId: string) {
    super(`TELEGRAM_WORKFLOW_MISSING:${workflowId}`);
    this.name = 'TelegramWorkflowMissingError';
  }
}

export function isTemporalWorkflowNotFound(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const candidate = error as { name?: unknown; message?: unknown };
  const name = typeof candidate.name === 'string' ? candidate.name : '';
  const message = typeof candidate.message === 'string' ? candidate.message : '';
  if (name === 'WorkflowNotFoundError') return true;
  return /workflow[^\n]*not found/i.test(message) || /not found[^\n]*workflow/i.test(message);
}

export function channelBindingStatusForWorkflow(workflowStatus: string): ChannelBindingStatus {
  if (workflowStatus === 'COMPLETED') return 'COMPLETED';
  if (workflowStatus === 'FAILED') return 'FAILED';
  return 'ACTIVE';
}

export function isTerminalWorkflowStatus(workflowStatus: string): boolean {
  return workflowStatus === 'COMPLETED' || workflowStatus === 'FAILED';
}
