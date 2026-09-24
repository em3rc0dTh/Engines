import assert from 'node:assert/strict';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import {
  loadA5BusinessExperienceProfileResolver,
} from './business-experience-profile.js';

test('A5 resolves agent identity and business display name independently per businessSlug', async () => {
  const resolver = loadA5BusinessExperienceProfileResolver({
    ENGINES_AGENT_BUSINESS_PROFILES_JSON: JSON.stringify({
      'gallo-autos': {
        businessDisplayName: 'Gallo Autos',
        agentProfile: {
          identity: {
            name: 'Jett',
            role: 'Staff Assistant',
          },
        },
      },
      mypet: {
        businessDisplayName: 'Veterinaria MyPet',
        agentProfile: {
          identity: {
            name: 'Mia',
            role: 'Veterinary Assistant',
          },
          voice: {
            locale: 'es-PE',
          },
        },
      },
    }),
  });

  const gallo = await resolver.resolve('gallo-autos');
  const mypet = await resolver.resolve('mypet');

  assert.equal(gallo.businessDisplayName, 'Gallo Autos');
  assert.equal(gallo.agentProfile.identity.name, 'Jett');
  assert.equal(gallo.agentProfile.identity.role, 'Staff Assistant');

  assert.equal(mypet.businessDisplayName, 'Veterinaria MyPet');
  assert.equal(mypet.agentProfile.identity.name, 'Mia');
  assert.equal(mypet.agentProfile.identity.role, 'Veterinary Assistant');

  assert.notEqual(gallo.agentProfile.identity.name, mypet.agentProfile.identity.name);
});

test('A5 unknown business uses a tenant-isolated generic fallback, never another business profile', async () => {
  const resolver = loadA5BusinessExperienceProfileResolver({
    ENGINES_AGENT_BUSINESS_PROFILES_JSON: JSON.stringify({
      'gallo-autos': {
        businessDisplayName: 'Gallo Autos',
        agentProfile: {
          identity: { name: 'Jett', role: 'Staff Assistant' },
        },
      },
    }),
  });

  const unknown = await resolver.resolve('unconfigured-business');

  assert.equal(unknown.businessDisplayName, 'unconfigured-business');
  assert.equal(unknown.agentProfile.identity.name, 'Assistant');
  assert.equal(unknown.agentProfile.identity.role, 'Customer Assistant');
});

test('A5 profile file supports lab/onboarding configuration without process-global identity variables', async () => {
  const root = await mkdtemp(join(tmpdir(), 'engines-a5-profile-'));
  const path = join(root, 'profiles.json');
  await writeFile(path, JSON.stringify({
    'golden-business': {
      businessDisplayName: 'Gallo Autos',
      agentProfile: {
        identity: {
          name: 'Jett',
          role: 'Staff Assistant',
        },
      },
    },
  }));

  const resolver = loadA5BusinessExperienceProfileResolver({
    ENGINES_AGENT_BUSINESS_PROFILES_FILE: path,
  });

  const profile = await resolver.resolve('golden-business');
  assert.equal(profile.businessDisplayName, 'Gallo Autos');
  assert.equal(profile.agentProfile.identity.name, 'Jett');
});

test('A5 inline business profile overrides the same business from file configuration', async () => {
  const root = await mkdtemp(join(tmpdir(), 'engines-a5-profile-'));
  const path = join(root, 'profiles.json');
  await writeFile(path, JSON.stringify({
    tenant: {
      businessDisplayName: 'Original Business',
      agentProfile: {
        identity: { name: 'Original', role: 'Assistant' },
      },
    },
  }));

  const resolver = loadA5BusinessExperienceProfileResolver({
    ENGINES_AGENT_BUSINESS_PROFILES_FILE: path,
    ENGINES_AGENT_BUSINESS_PROFILES_JSON: JSON.stringify({
      tenant: {
        businessDisplayName: 'Override Business',
        agentProfile: {
          identity: { name: 'Override', role: 'Assistant' },
        },
      },
    }),
  });

  const profile = await resolver.resolve('tenant');
  assert.equal(profile.businessDisplayName, 'Override Business');
  assert.equal(profile.agentProfile.identity.name, 'Override');
});
