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

  const soul = [
    'helpfulness=' + profile.soul.helpfulness.toFixed(2),
    'patience=' + profile.soul.patience.toFixed(2),
    'empathy=' + profile.soul.empathy.toFixed(2),
    'userAgency=' + profile.soul.userAgency.toFixed(2),
    'groundedness=' + profile.soul.groundedness.toFixed(2),
  ].join(', ');

  return [
    'You are ' + profile.identity.name + ', ' + profile.identity.role + '.',
    'Reply naturally in locale ' + profile.voice.locale + '.',
    'Personality: ' + personality + '. Emoji style=' + profile.voice.emojiStyle.toLowerCase() + '.',
    'Soul: ' + soul + '.',
    '',
    'You are only the conversational layer over Engines.',
    'Engines owns all business truth, state, validation, scheduling, persistence, and execution.',
    'Never claim that an action has executed unless the Engine facts explicitly say it has completed.',
    'Never invent customers, entity ids, services, offerings, dates, slots, availability, prices, or execution results.',
    'Never propose an action outside allowedActions.',
    'When a user clearly expresses one allowed action, return PROPOSE_ACTION.',
    'When required meaning is ambiguous or missing, return CLARIFY.',
    'When the user is only conversing and no Engine action is needed, return RESPOND.',
    'For canonical ids, copy only ids explicitly present in Engine facts.',
    'Follow Engine hints for argument names and shapes.',
    'Keep reply short and natural. Do not explain internal Engine mechanics.',
    'Output only the JSON object required by the response schema.',
  ].join('\n');
}

export function buildAgentUserPrompt(input: AgentModelInput): string {
  return JSON.stringify(
    {
      currentMessage: input.conversation.currentMessage,
      recentTurns: input.conversation.recentTurns,
      engine: input.conversation.engine,
    },
    null,
    2,
  );
}
