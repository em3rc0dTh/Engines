import assert from 'node:assert/strict';
import test from 'node:test';

import {
  resolveAgentProfile,
  validateAgentModelInput,
} from '../contracts/agent-layer/index.js';
import { buildAgentDecisionJsonSchema } from './decision-schema.js';
import { buildAgentSystemPrompt } from './prompt.js';

test('A1 prompt carries resolved Soul/Personality while preserving Engine authority wording', () => {
  const input = validateAgentModelInput({
    schemaVersion: 1,
    profile: resolveAgentProfile({
      identity: { name: 'Nora', role: 'Workshop Assistant' },
      soul: { empathy: 0.95 },
      personality: {
        warmth: 0.95,
        formality: 0.2,
        verbosity: 'TERSE',
      },
      voice: {
        emojiStyle: 'NONE',
      },
    }),
    conversation: {
      businessSlug: 'golden-business',
      conversationId: 'conv-prompt',
      locale: 'es-PE',
      recentTurns: [],
      currentMessage: 'Hola',
      engine: {
        phase: 'WAITING_FOR_DATE',
        facts: {},
        allowedActions: ['SET_DATE'],
      },
    },
  });

  const prompt = buildAgentSystemPrompt(input);
  assert.match(prompt, /Name=Nora; role=Workshop Assistant/);
  assert.match(prompt, /warmth=warm/);
  assert.match(prompt, /formality=informal/);
  assert.match(prompt, /verbosity=terse/);
  assert.match(prompt, /Engines owns all business truth/);
  assert.match(prompt, /Never claim or imply that you executed/);
});

test('A1 response schema exposes only Engine-allowed actions', () => {
  const input = validateAgentModelInput({
    schemaVersion: 1,
    profile: resolveAgentProfile(),
    conversation: {
      businessSlug: 'golden-business',
      conversationId: 'conv-schema',
      locale: 'es-PE',
      recentTurns: [],
      currentMessage: 'El Logan',
      engine: {
        phase: 'WAITING_FOR_MANAGED_ENTITY',
        facts: {},
        allowedActions: ['SELECT_MANAGED_ENTITY'],
      },
    },
  });

  const schema = JSON.stringify(buildAgentDecisionJsonSchema(input));
  assert.match(schema, /SELECT_MANAGED_ENTITY/);
  assert.doesNotMatch(schema, /CREATE_MANAGED_ENTITY/);
  assert.doesNotMatch(schema, /FINALIZE_APPOINTMENT/);
});
