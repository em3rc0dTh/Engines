import { DEFAULT_AGENT_PROFILE } from './defaults.js';
import type {
  AgentIdentity,
  AgentPersonality,
  AgentProfileOverrides,
  AgentResolvedProfile,
  AgentSoul,
  AgentVoice,
} from './types.js';

const PROFILE_KEYS = new Set(['identity', 'soul', 'personality', 'voice']);
const IDENTITY_KEYS = new Set(['name', 'role']);
const SOUL_KEYS = new Set(['helpfulness', 'patience', 'empathy', 'userAgency', 'groundedness']);
const PERSONALITY_KEYS = new Set(['warmth', 'formality', 'initiative', 'humor', 'verbosity']);
const VOICE_KEYS = new Set(['locale', 'emojiStyle']);

function fail(message: string): never {
  throw new Error(`Agent profile invalid: ${message}`);
}

function asRecord(value: unknown, path: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    fail(`${path} must be an object`);
  }
  return value as Record<string, unknown>;
}

function assertExactKeys(record: Record<string, unknown>, allowed: Set<string>, path: string): void {
  for (const key of Object.keys(record)) {
    if (!allowed.has(key)) fail(`${path}.${key} is not configurable`);
  }
}

function assertString(value: unknown, path: string, maxLength: number): asserts value is string {
  if (typeof value !== 'string') fail(`${path} must be a string`);
  const trimmed = value.trim();
  if (trimmed.length === 0) fail(`${path} must not be empty`);
  if (trimmed.length > maxLength) fail(`${path} exceeds ${maxLength} characters`);
}

function assertUnit(value: unknown, path: string): asserts value is number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 1) {
    fail(`${path} must be a finite number between 0 and 1`);
  }
}

function assertIdentity(value: unknown, path: string, partial: boolean): void {
  const record = asRecord(value, path);
  assertExactKeys(record, IDENTITY_KEYS, path);
  if (!partial || 'name' in record) assertString(record.name, `${path}.name`, 80);
  if (!partial || 'role' in record) assertString(record.role, `${path}.role`, 120);
}

function assertSoul(value: unknown, path: string, partial: boolean): void {
  const record = asRecord(value, path);
  assertExactKeys(record, SOUL_KEYS, path);
  for (const key of SOUL_KEYS) {
    if (!partial || key in record) assertUnit(record[key], `${path}.${key}`);
  }
}

function assertPersonality(value: unknown, path: string, partial: boolean): void {
  const record = asRecord(value, path);
  assertExactKeys(record, PERSONALITY_KEYS, path);
  for (const key of ['warmth', 'formality', 'initiative', 'humor'] as const) {
    if (!partial || key in record) assertUnit(record[key], `${path}.${key}`);
  }
  if (!partial || 'verbosity' in record) {
    if (!['TERSE', 'CONCISE', 'NATURAL'].includes(String(record.verbosity))) {
      fail(`${path}.verbosity must be TERSE, CONCISE, or NATURAL`);
    }
  }
}

function assertVoice(value: unknown, path: string, partial: boolean): void {
  const record = asRecord(value, path);
  assertExactKeys(record, VOICE_KEYS, path);
  if (!partial || 'locale' in record) assertString(record.locale, `${path}.locale`, 35);
  if (!partial || 'emojiStyle' in record) {
    if (!['NONE', 'LIGHT', 'MODERATE'].includes(String(record.emojiStyle))) {
      fail(`${path}.emojiStyle must be NONE, LIGHT, or MODERATE`);
    }
  }
}

export function validateAgentProfileOverrides(value: unknown): AgentProfileOverrides {
  const record = asRecord(value, 'overrides');
  assertExactKeys(record, PROFILE_KEYS, 'overrides');

  if (record.identity !== undefined) assertIdentity(record.identity, 'overrides.identity', true);
  if (record.soul !== undefined) assertSoul(record.soul, 'overrides.soul', true);
  if (record.personality !== undefined) assertPersonality(record.personality, 'overrides.personality', true);
  if (record.voice !== undefined) assertVoice(record.voice, 'overrides.voice', true);

  return record as unknown as AgentProfileOverrides;
}

export function validateResolvedAgentProfile(value: unknown): AgentResolvedProfile {
  const record = asRecord(value, 'profile');
  assertExactKeys(record, PROFILE_KEYS, 'profile');
  assertIdentity(record.identity, 'profile.identity', false);
  assertSoul(record.soul, 'profile.soul', false);
  assertPersonality(record.personality, 'profile.personality', false);
  assertVoice(record.voice, 'profile.voice', false);
  return record as unknown as AgentResolvedProfile;
}

export function resolveAgentProfile(overrides: AgentProfileOverrides = {}): AgentResolvedProfile {
  const resolved: AgentResolvedProfile = {
    identity: {
      ...DEFAULT_AGENT_PROFILE.identity,
      ...(overrides.identity ?? {}),
    } as AgentIdentity,
    soul: {
      ...DEFAULT_AGENT_PROFILE.soul,
      ...(overrides.soul ?? {}),
    } as AgentSoul,
    personality: {
      ...DEFAULT_AGENT_PROFILE.personality,
      ...(overrides.personality ?? {}),
    } as AgentPersonality,
    voice: {
      ...DEFAULT_AGENT_PROFILE.voice,
      ...(overrides.voice ?? {}),
    } as AgentVoice,
  };

  return validateResolvedAgentProfile(resolved);
}

export function resolveAgentProfileFromUnknown(value: unknown): AgentResolvedProfile {
  return resolveAgentProfile(validateAgentProfileOverrides(value));
}
