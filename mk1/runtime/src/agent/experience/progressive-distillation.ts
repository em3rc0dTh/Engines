import {
  validateAgentDecision,
  validateAgentModelInput,
  type AgentDecision,
  type AgentJsonObject,
  type AgentModelInput,
} from '../../contracts/agent-layer/index.js';
import {
  A5_DISTILLATION_FIELDS,
  type A5DistillationField,
  type A5DistilledFact,
  type A5ExperienceModelInput,
  type A5ExperienceModelOutput,
} from './types.js';

const FIELD_SET = new Set<string>(A5_DISTILLATION_FIELDS);

function fail(message: string): never {
  throw new Error('A5 experience invalid: ' + message);
}

function record(value: unknown, path: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    fail(path + ' must be an object');
  }
  return value as Record<string, unknown>;
}

function text(value: unknown, path: string, max: number): string {
  if (typeof value !== 'string' || !value.trim()) fail(path + ' must be a non-empty string');
  const clean = value.trim();
  if (clean.length > max) fail(path + ' exceeds ' + max + ' characters');
  return clean;
}

function facts(value: unknown, path: string): readonly A5DistilledFact[] {
  if (!Array.isArray(value)) fail(path + ' must be an array');
  if (value.length > 6) fail(path + ' exceeds 6 entries');

  return value.map((entry, index) => {
    const item = record(entry, path + '[' + index + ']');
    const keys = Object.keys(item);
    if (keys.some((key) => key !== 'field' && key !== 'value')) {
      fail(path + '[' + index + '] contains unsupported keys');
    }
    const field = text(item.field, path + '[' + index + '].field', 64);
    if (!FIELD_SET.has(field)) fail(path + '[' + index + '].field is unsupported');
    return {
      field: field as A5DistillationField,
      value: text(item.value, path + '[' + index + '].value', 240),
    };
  });
}

export function a5AgentModelInput(input: A5ExperienceModelInput): AgentModelInput {
  return validateAgentModelInput({
    schemaVersion: 1,
    profile: input.profile,
    conversation: input.conversation,
  });
}

export function validateA5ExperienceOutput(
  value: unknown,
  input: A5ExperienceModelInput,
): Readonly<{
  output: A5ExperienceModelOutput;
  decision: AgentDecision;
}> {
  const root = record(value, 'output');
  if (root.schemaVersion !== 1) fail('schemaVersion must be 1');

  const allowedRootKeys = new Set(['schemaVersion', 'reply', 'distillation', 'proposedAction']);
  for (const key of Object.keys(root)) {
    if (!allowedRootKeys.has(key)) fail('output.' + key + ' is unsupported');
  }

  const reply = text(root.reply, 'output.reply', 1000);
  const distillationRaw = record(root.distillation, 'output.distillation');
  for (const key of Object.keys(distillationRaw)) {
    if (key !== 'observed' && key !== 'inferred') fail('output.distillation.' + key + ' is unsupported');
  }
  const distillation = {
    observed: facts(distillationRaw.observed ?? [], 'output.distillation.observed'),
    inferred: facts(distillationRaw.inferred ?? [], 'output.distillation.inferred'),
  };

  const canonicalInput = a5AgentModelInput(input);

  if (root.proposedAction === undefined) {
    const decision = validateAgentDecision({
      schemaVersion: 1,
      kind: 'RESPOND',
      reply,
    }, canonicalInput);
    return {
      output: { schemaVersion: 1, reply, distillation },
      decision,
    };
  }

  const proposed = record(root.proposedAction, 'output.proposedAction');
  for (const key of Object.keys(proposed)) {
    if (key !== 'action' && key !== 'arguments') fail('output.proposedAction.' + key + ' is unsupported');
  }
  const action = text(proposed.action, 'output.proposedAction.action', 128);
  const args = record(proposed.arguments, 'output.proposedAction.arguments') as AgentJsonObject;

  const decision = validateAgentDecision({
    schemaVersion: 1,
    kind: 'PROPOSE_ACTION',
    reply,
    proposedAction: { action, arguments: args },
  }, canonicalInput);

  return {
    output: {
      schemaVersion: 1,
      reply,
      distillation,
      proposedAction: { action, arguments: args },
    },
    decision,
  };
}

export function buildA5ExperienceSystemPrompt(input: A5ExperienceModelInput): string {
  const firstTurn = input.conversation.recentTurns.length === 0;
  const allowed = input.conversation.engine.allowedActions;

  return [
    'You are the top conversational experience layer for Engines.',
    'You never own business truth. Engines remains the only authority for customers, managed entities, services, offerings, scheduling, persistence, and execution.',
    '',
    'CONVERSATION EXPERIENCE:',
    '- Speak natural Spanish for locale ' + input.conversation.locale + '.',
    '- Your name is ' + input.profile.identity.name + '.',
    '- You are part of the staff of ' + input.businessDisplayName + '.',
    '- Never expose workflow phases, fields, slots-to-fill, canonical ids, action names, or internal architecture.',
    '- Ask at most one useful follow-up question at a time.',
    '- Do not turn the conversation into a form.',
    '- Acknowledge the user concern before asking for operational identity.',
    '- Reuse facts the user already supplied in recentTurns; do not ask for the same fact twice.',
    firstTurn
      ? '- This is the first conversational turn. Introduce yourself once, mention the business naturally, acknowledge the request, and invite the user to explain more.'
      : '- Do not introduce yourself again unless the user asks who you are.',
    '',
    'PROGRESSIVE DISTILLATION:',
    '- observed = facts explicitly stated by the user in currentMessage or recentTurns.',
    '- inferred = useful interpretations that are not yet Engine-confirmed.',
    '- Distillation is conversational context only. Never call inferred data confirmed.',
    '- Keep values short. Do not invent vehicle data, diagnoses, services, prices, availability, customer records, or dates.',
    '',
    'ENGINE ACTION BOUNDARY:',
    allowed.length > 0
      ? '- You MAY propose exactly one action, but only from: ' + allowed.join(', ') + '.'
      : '- No Engine action is currently available. Do not output proposedAction.',
    '- Only propose an action when the conversation already contains enough explicit evidence for its arguments.',
    '- Copy canonical ids only from Engine facts.',
    '- If the Engine catalog does not support an inferred need, keep talking naturally and do not map it to an unrelated service.',
    '- A proposed action is only a proposal; never claim it already executed.',
    '',
    'CUSTOMER INTAKE:',
    '- PROVIDE_CUSTOMER accepts {"customerName":"<explicit name>"} and/or {"customerEmail":"<explicit email>"}.',
    '- Never guess a customer name or email from sender id, vehicle, or prior business data.',
    '- It is acceptable to spend early turns understanding the problem before asking for the name.',
    '',
    'OUTPUT:',
    '- reply: short natural user-facing response.',
    '- distillation.observed: 0-6 concise facts.',
    '- distillation.inferred: 0-6 concise interpretations.',
    '- proposedAction: omit unless justified and allowed.',
    '- Output JSON only.',
  ].join('\n');
}

export function buildA5ExperienceUserPrompt(input: A5ExperienceModelInput): string {
  return JSON.stringify({
    currentMessage: input.conversation.currentMessage,
    recentTurns: input.conversation.recentTurns,
    engine: input.conversation.engine,
  }, null, 2);
}

function factSchema(): Record<string, unknown> {
  return {
    type: 'object',
    additionalProperties: false,
    properties: {
      field: { type: 'string', enum: [...A5_DISTILLATION_FIELDS] },
      value: { type: 'string', minLength: 1, maxLength: 240 },
    },
    required: ['field', 'value'],
  };
}

function baseProperties(): Record<string, unknown> {
  return {
    reply: { type: 'string', minLength: 1, maxLength: 1000 },
    distillation: {
      type: 'object',
      additionalProperties: false,
      properties: {
        observed: { type: 'array', maxItems: 6, items: factSchema() },
        inferred: { type: 'array', maxItems: 6, items: factSchema() },
      },
      required: ['observed', 'inferred'],
    },
  };
}

export function buildA5ExperienceJsonSchema(input: A5ExperienceModelInput): Record<string, unknown> {
  const base = baseProperties();
  const responseOnly = {
    type: 'object',
    additionalProperties: false,
    properties: base,
    required: ['reply', 'distillation'],
  };

  if (input.conversation.engine.allowedActions.length === 0) {
    return {
      title: 'EnginesA5ProgressiveConversation',
      ...responseOnly,
    };
  }

  return {
    title: 'EnginesA5ProgressiveConversation',
    oneOf: [
      responseOnly,
      {
        type: 'object',
        additionalProperties: false,
        properties: {
          ...base,
          proposedAction: {
            type: 'object',
            additionalProperties: false,
            properties: {
              action: {
                type: 'string',
                enum: [...input.conversation.engine.allowedActions],
              },
              arguments: {
                type: 'object',
                additionalProperties: true,
              },
            },
            required: ['action', 'arguments'],
          },
        },
        required: ['reply', 'distillation', 'proposedAction'],
      },
    ],
  };
}
