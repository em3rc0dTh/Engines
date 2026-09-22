export function isAgentActionAllowed(action: string, allowedActions: readonly string[]): boolean {
  return allowedActions.includes(action);
}

export function assertAgentActionAllowed(action: string, allowedActions: readonly string[]): void {
  if (!isAgentActionAllowed(action, allowedActions)) {
    throw new Error(`Agent capability denied: ${action} is not allowed by the current Engine projection`);
  }
}
