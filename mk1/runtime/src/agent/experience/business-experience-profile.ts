import { readFileSync } from 'node:fs';

import {
  resolveAgentProfile,
  resolveAgentProfileFromUnknown,
  type AgentResolvedProfile,
} from '../../contracts/agent-layer/index.js';

export type A5BusinessExperienceProfile = Readonly<{
  businessSlug: string;
  businessDisplayName: string;
  agentProfile: AgentResolvedProfile;
}>;

export interface A5BusinessExperienceProfileResolver {
  resolve(businessSlug: string): Promise<A5BusinessExperienceProfile>;
}

type ConfigEntry = Readonly<{
  businessDisplayName: string;
  agentProfile: AgentResolvedProfile;
}>;

function fail(message: string): never {
  throw new Error('A5 business experience profile invalid: ' + message);
}

function record(value: unknown, path: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    fail(path + ' must be an object');
  }
  return value as Record<string, unknown>;
}

function cleanSlug(value: string): string {
  const slug = value.trim().toLowerCase();
  if (!slug) fail('businessSlug must not be empty');
  return slug;
}

function cleanDisplayName(value: unknown, path: string): string {
  if (typeof value !== 'string' || !value.trim()) fail(path + ' must be a non-empty string');
  const clean = value.trim();
  if (clean.length > 160) fail(path + ' exceeds 160 characters');
  return clean;
}

function parseConfig(value: unknown, source: string): Map<string, ConfigEntry> {
  const root = record(value, source);
  const result = new Map<string, ConfigEntry>();

  for (const [rawSlug, rawEntry] of Object.entries(root)) {
    const slug = cleanSlug(rawSlug);
    const entry = record(rawEntry, source + '.' + slug);
    for (const key of Object.keys(entry)) {
      if (key !== 'businessDisplayName' && key !== 'agentProfile') {
        fail(source + '.' + slug + '.' + key + ' is unsupported');
      }
    }

    result.set(slug, {
      businessDisplayName: cleanDisplayName(
        entry.businessDisplayName,
        source + '.' + slug + '.businessDisplayName',
      ),
      agentProfile: resolveAgentProfileFromUnknown(entry.agentProfile ?? {}),
    });
  }

  return result;
}

function parseJson(raw: string, source: string): unknown {
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    fail(source + ' must contain valid JSON');
  }
}

export class ConfiguredA5BusinessExperienceProfileResolver
implements A5BusinessExperienceProfileResolver {
  readonly #profiles: ReadonlyMap<string, ConfigEntry>;

  constructor(profiles: ReadonlyMap<string, ConfigEntry>) {
    this.#profiles = profiles;
  }

  async resolve(businessSlug: string): Promise<A5BusinessExperienceProfile> {
    const slug = cleanSlug(businessSlug);
    const configured = this.#profiles.get(slug);

    if (configured) {
      return {
        businessSlug: slug,
        businessDisplayName: configured.businessDisplayName,
        agentProfile: configured.agentProfile,
      };
    }

    // Safe tenant-isolated fallback: never reuse another business' branding.
    return {
      businessSlug: slug,
      businessDisplayName: slug,
      agentProfile: resolveAgentProfile(),
    };
  }
}

export function loadA5BusinessExperienceProfileResolver(
  env: NodeJS.ProcessEnv = process.env,
): A5BusinessExperienceProfileResolver {
  const profiles = new Map<string, ConfigEntry>();

  const filePath = env.ENGINES_AGENT_BUSINESS_PROFILES_FILE?.trim();
  if (filePath) {
    const fileProfiles = parseConfig(
      parseJson(readFileSync(filePath, 'utf8'), 'ENGINES_AGENT_BUSINESS_PROFILES_FILE'),
      'ENGINES_AGENT_BUSINESS_PROFILES_FILE',
    );
    for (const [slug, entry] of fileProfiles) profiles.set(slug, entry);
  }

  const inline = env.ENGINES_AGENT_BUSINESS_PROFILES_JSON?.trim();
  if (inline) {
    const inlineProfiles = parseConfig(
      parseJson(inline, 'ENGINES_AGENT_BUSINESS_PROFILES_JSON'),
      'ENGINES_AGENT_BUSINESS_PROFILES_JSON',
    );
    for (const [slug, entry] of inlineProfiles) profiles.set(slug, entry);
  }

  return new ConfiguredA5BusinessExperienceProfileResolver(profiles);
}
