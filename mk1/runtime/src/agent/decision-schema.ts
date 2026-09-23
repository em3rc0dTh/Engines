import type { AgentModelInput } from '../contracts/agent-layer/index.js';

function responseBranch(kind: 'RESPOND' | 'CLARIFY'): Record<string, unknown> {
  return {
    type: 'object',
    additionalProperties: false,
    properties: {
      kind: { type: 'string', const: kind },
      reply: { type: 'string', minLength: 1, maxLength: 1000 },
    },
    required: ['kind', 'reply'],
  };
}

function actionBranch(allowedActions: readonly string[]): Record<string, unknown> {
  return {
    type: 'object',
    additionalProperties: false,
    properties: {
      kind: { type: 'string', const: 'PROPOSE_ACTION' },
      reply: { type: 'string', minLength: 1, maxLength: 1000 },
      proposedAction: {
        type: 'object',
        additionalProperties: false,
        properties: {
          action: {
            type: 'string',
            enum: [...allowedActions],
          },
          arguments: {
            type: 'object',
            additionalProperties: true,
          },
        },
        required: ['action', 'arguments'],
      },
    },
    required: ['kind', 'reply', 'proposedAction'],
  };
}

export function buildAgentDecisionJsonSchema(input: AgentModelInput): Record<string, unknown> {
  const branches: Record<string, unknown>[] = [
    responseBranch('RESPOND'),
    responseBranch('CLARIFY'),
  ];

  if (input.conversation.engine.allowedActions.length > 0) {
    branches.push(actionBranch(input.conversation.engine.allowedActions));
  }

  return {
    title: 'EnginesAgentDecision',
    oneOf: branches,
  };
}
