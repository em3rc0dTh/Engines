import { assertAgentActionAllowed } from './capability-boundary.js';
import { validateResolvedAgentProfile } from './profile.js';
import type {
  AgentDecision,
  AgentJsonObject,
  AgentJsonValue,
  AgentModelInput,
} from './types.js';

const INPUT_KEYS = new Set(['schemaVersion', 'profile', 'conversation']);
const CONVERSATION_KEYS = new Set([
  'businessSlug',
  'conversationId',
  'locale',
  'recentTurns',
  'currentMessage',
  'engine',
]);
const ENGINE_KEYS = new Set(['phase', 'facts', 'allowedActions', 'hints']);
const TURN_KEYS = new Set(['role', 'text']);
const ACTION_KEYS = new Set(['action', 'arguments']);

const SECRET_KEYS = new Set([
  'token',
  'accesstoken',
  'refreshtoken',
  'apikey',
  'password',
  'secret',
  'clientsecret',
  'webhooksecret',
  'authorization',
  'privatekey',
  'bearertoken',
  'credential',
  'credentials',
]);

function fail(message: string): never {
  throw new Error(`Agent contract invalid: ${message}`);
}

function asRecord(value: unknown, path: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    fail(`${path} must be an object`);
  }
  return value as Record<string, unknown>;
}

function assertExactKeys(record: Record<string, unknown>, allowed: Set<string>, path: string): void {
  for (const key of Object.keys(record)) {
    if (!allowed.has(key)) fail(`${path}.${key} is not part of the Agent contract`);
  }
}

function assertString(value: unknown, path: string, maxLength: number): asserts value is string {
  if (typeof value !== 'string') fail(`${path} must be a string`);
  const trimmed = value.trim();
  if (trimmed.length === 0) fail(`${path} must not be empty`);
  if (trimmed.length > maxLength) fail(`${path} exceeds ${maxLength} characters`);
}

function assertBusinessSlug(value: unknown): asserts value is string {
  assertString(value, 'conversation.businessSlug', 63);
  if (!/^[a-z0-9][a-z0-9-]*$/.test(value)) {
    fail('conversation.businessSlug must be lowercase alphanumeric with optional hyphens');
  }
}

function normalizeKey(key: string): string {
  return key.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function assertSafeJson(value: unknown, path: string, depth = 0): asserts value is AgentJsonValue {
  if (depth > 8) fail(`${path} exceeds maximum JSON depth`);

  if (value === null || typeof value === 'string' || typeof value === 'boolean') return;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) fail(`${path} must contain only finite numbers`);
    return;
  }

  if (Array.isArray(value)) {
    if (value.length > 64) fail(`${path} exceeds maximum array length`);
    value.forEach((entry, index) => assertSafeJson(entry, `${path}[${index}]`, depth + 1));
    return;
  }

  if (typeof value !== 'object') fail(`${path} contains a non-JSON value`);

  const record = value as Record<string, unknown>;
  const keys = Object.keys(record);
  if (keys.length > 64) fail(`${path} exceeds maximum object key count`);

  for (const [key, entry] of Object.entries(record)) {
    if (SECRET_KEYS.has(normalizeKey(key))) {
      fail(`${path}.${key} is secret-like material and cannot enter Agent context`);
    }
    assertSafeJson(entry, `${path}.${key}`, depth + 1);
  }
}

function assertJsonObject(value: unknown, path: string): asserts value is AgentJsonObject {
  const record = asRecord(value, path);
  assertSafeJson(record, path);
}

function assertUniqueStrings(
  value: unknown,
  path: string,
  maxItems: number,
  maxLength: number,
): asserts value is readonly string[] {
  if (!Array.isArray(value)) fail(`${path} must be an array`);
  if (value.length > maxItems) fail(`${path} exceeds ${maxItems} entries`);

  const seen = new Set<string>();
  value.forEach((entry, index) => {
    assertString(entry, `${path}[${index}]`, maxLength);
    if (seen.has(entry)) fail(`${path} contains duplicate value ${entry}`);
    seen.add(entry);
  });
}

export function validateAgentModelInput(value: unknown): AgentModelInput {
  const record = asRecord(value, 'input');
  assertExactKeys(record, INPUT_KEYS, 'input');
  if (record.schemaVersion !== 1) fail('input.schemaVersion must be 1');

  validateResolvedAgentProfile(record.profile);

  const conversation = asRecord(record.conversation, 'conversation');
  assertExactKeys(conversation, CONVERSATION_KEYS, 'conversation');
  assertBusinessSlug(conversation.businessSlug);
  assertString(conversation.conversationId, 'conversation.conversationId', 256);
  assertString(conversation.locale, 'conversation.locale', 35);
  assertString(conversation.currentMessage, 'conversation.currentMessage', 2000);

  if (!Array.isArray(conversation.recentTurns)) fail('conversation.recentTurns must be an array');
  if (conversation.recentTurns.length > 8) fail('conversation.recentTurns exceeds 8 entries');
  conversation.recentTurns.forEach((turn, index) => {
    const turnRecord = asRecord(turn, `conversation.recentTurns[${index}]`);
    assertExactKeys(turnRecord, TURN_KEYS, `conversation.recentTurns[${index}]`);
    if (turnRecord.role !== 'USER' && turnRecord.role !== 'AGENT') {
      fail(`conversation.recentTurns[${index}].role must be USER or AGENT`);
    }
    assertString(turnRecord.text, `conversation.recentTurns[${index}].text`, 2000);
  });

  const engine = asRecord(conversation.engine, 'conversation.engine');
  assertExactKeys(engine, ENGINE_KEYS, 'conversation.engine');
  assertString(engine.phase, 'conversation.engine.phase', 128);
  assertJsonObject(engine.facts, 'conversation.engine.facts');
  assertUniqueStrings(engine.allowedActions, 'conversation.engine.allowedActions', 16, 128);

  if (engine.hints !== undefined) {
    assertUniqueStrings(engine.hints, 'conversation.engine.hints', 8, 256);
  }

  return record as unknown as AgentModelInput;
}

export function validateAgentDecision(value: unknown, input: AgentModelInput): AgentDecision {
  const record = asRecord(value, 'decision');
  if (record.schemaVersion !== 1) fail('decision.schemaVersion must be 1');
  assertString(record.reply, 'decision.reply', 1000);

  if (record.kind === 'RESPOND' || record.kind === 'CLARIFY') {
    assertExactKeys(record, new Set(['schemaVersion', 'kind', 'reply']), 'decision');
    return record as unknown as AgentDecision;
  }

  if (record.kind !== 'PROPOSE_ACTION') {
    fail('decision.kind must be RESPOND, CLARIFY, or PROPOSE_ACTION');
  }

  assertExactKeys(record, new Set(['schemaVersion', 'kind', 'reply', 'proposedAction']), 'decision');

  const proposedAction = asRecord(record.proposedAction, 'decision.proposedAction');
  assertExactKeys(proposedAction, ACTION_KEYS, 'decision.proposedAction');
  assertString(proposedAction.action, 'decision.proposedAction.action', 128);
  assertJsonObject(proposedAction.arguments, 'decision.proposedAction.arguments');

  assertAgentActionAllowed(proposedAction.action, input.conversation.engine.allowedActions);

  return record as unknown as AgentDecision;
}
