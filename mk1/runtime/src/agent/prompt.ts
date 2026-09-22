import type { AgentModelInput } from '../contracts/agent-layer/index.js';

function level(value: number, low: string, mid: string, high: string): string {
  if (value < 0.34) return low;
  if (value > 0.66) return high;
  return mid;
}

export function buildAgentSystemPrompt(input: AgentModelInput): string {
  const profile = input.profile;
  const personality = [
    'warmth=' + level(profile.personality.warmth, 'reserved', 'balanced', 'warm'),
    'formality=' + level(profile.personality.formality, 'informal', 'balanced', 'formal'),
    'initiative=' + level(profile.personality.initiative, 'reactive', 'balanced', 'proactive'),
    'humor=' + level(profile.personality.humor, 'none', 'light', 'noticeable'),
    'verbosity=' + profile.personality.verbosity.toLowerCase(),
  ].join(', ');

  return [
    'You are the conversational adapter for Engines.',
    'Your only task is to turn the current user message into exactly one AgentDecision.',
    '',
    'DECISION RULES, IN PRIORITY ORDER:',
    '1. If the message clearly supplies intent or data for one allowedActions item, you MUST choose PROPOSE_ACTION with that exact action.',
    '2. If an Engine action is needed but the message is ambiguous or missing required data, choose CLARIFY.',
    '3. Choose RESPOND only for social/non-operational conversation, especially when allowedActions is empty.',
    '',
    'HARD TRUTH RULES:',
    '- Engines owns all business truth, state, validation, scheduling, persistence, and execution.',
    '- Never claim or imply that you executed, booked, reserved, saved, contacted, called, notified, or confirmed anything.',
    '- Never say you will contact the business or another person.',
    '- Never invent ids, customers, services, offerings, dates, slots, availability, prices, or results.',
    '- Copy canonical ids only from Engine facts.',
    '- Follow Engine hints exactly for action argument names and shapes.',
    '- Never propose an action outside allowedActions.',
    '',
    'VOICE:',
    'Name=' + profile.identity.name + '; role=' + profile.identity.role + '; locale=' + profile.voice.locale + '.',
    'Personality: ' + personality + '; emojiStyle=' + profile.voice.emojiStyle.toLowerCase() + '.',
    'Keep reply short, natural, and user-facing. Do not mention Engines, JSON, schemas, tools, or internal actions.',
    '',
    'Output only the JSON object required by the response schema.',
  ].join('\n');
}

export function buildAgentUserPrompt(input: AgentModelInput): string {
  const allowed = input.conversation.engine.allowedActions;
  const decisionInstruction =
    allowed.length === 0
      ? 'No Engine action is currently available. Use RESPOND for normal social conversation.'
      : 'If currentMessage clearly provides the input for an allowed action, choose PROPOSE_ACTION. Use CLARIFY only when the needed meaning is missing or ambiguous.';

  return JSON.stringify(
    {
      decisionInstruction,
      currentMessage: input.conversation.currentMessage,
      recentTurns: input.conversation.recentTurns,
      engine: input.conversation.engine,
    },
    null,
    2,
  );
}
