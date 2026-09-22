import assert from 'node:assert/strict';
import test from 'node:test';

import {
  AGENT_A0_RESOURCE_BUDGET,
  AGENT_SYSTEM_INVARIANTS,
  DEFAULT_AGENT_PROFILE,
  resolveAgentProfile,
  resolveAgentProfileFromUnknown,
  runAgentModelTurn,
  validateAgentDecision,
  validateAgentModelInput,
  type AgentModelInput,
  type AgentModelProvider,
} from './index.js';

function validInput(): AgentModelInput {
  return validateAgentModelInput({
    schemaVersion: 1,
    profile: resolveAgentProfile(),
    conversation: {
      businessSlug: 'golden-business',
      conversationId: 'conv_agent_a0_001',
      locale: 'es-PE',
      recentTurns: [
        { role: 'USER', text: 'Quiero lavar el Logan.' },
        { role: 'AGENT', text: 'Claro. ¿Para qué fecha?' },
      ],
      currentMessage: 'El viernes temprano.',
      engine: {
        phase: 'WAITING_FOR_DATE',
        facts: {
          managedEntityId: 'men_logan',
          managedEntityName: 'Renault Logan',
          serviceId: 'svc_car_wash',
        },
        allowedActions: ['SET_DATE', 'CANCEL'],
        hints: ['A date is still required before slot selection.'],
      },
    },
  });
}

test('A0 supplies a complete default Soul and Personality without customization', () => {
  assert.deepEqual(resolveAgentProfile(), DEFAULT_AGENT_PROFILE);
  assert.equal(resolveAgentProfile().soul.groundedness, 1);
  assert.equal(resolveAgentProfile().personality.verbosity, 'CONCISE');
});

test('A0 profile customization inherits every unspecified default field', () => {
  const profile = resolveAgentProfileFromUnknown({
    identity: { name: 'Mia' },
    soul: { empathy: 0.95 },
    personality: {
      warmth: 0.9,
      formality: 0.25,
    },
    voice: {
      emojiStyle: 'NONE',
    },
  });

  assert.equal(profile.identity.name, 'Mia');
  assert.equal(profile.identity.role, DEFAULT_AGENT_PROFILE.identity.role);
  assert.equal(profile.soul.empathy, 0.95);
  assert.equal(profile.soul.groundedness, DEFAULT_AGENT_PROFILE.soul.groundedness);
  assert.equal(profile.personality.warmth, 0.9);
  assert.equal(profile.personality.formality, 0.25);
  assert.equal(profile.personality.initiative, DEFAULT_AGENT_PROFILE.personality.initiative);
  assert.equal(profile.voice.locale, DEFAULT_AGENT_PROFILE.voice.locale);
  assert.equal(profile.voice.emojiStyle, 'NONE');
});

test('A0 rejects attempts to customize non-configurable Engine invariants', () => {
  assert.throws(
    () =>
      resolveAgentProfileFromUnknown({
        soul: { empathy: 0.9 },
        invariants: { engineOwnsBusinessTruth: false },
      }),
    /invariants is not configurable/,
  );

  assert.deepEqual(AGENT_SYSTEM_INVARIANTS, {
    engineOwnsBusinessTruth: true,
    noDirectPersistence: true,
    onlyEngineAllowedActions: true,
    neverInventExecution: true,
    credentialsStayOutsideModelContext: true,
  });
});

test('A0 hard resource budget is 4 vCPU / 8 GB total, no GPU, ~1.5B Q4', () => {
  assert.equal(AGENT_A0_RESOURCE_BUDGET.totalNodeVcpu, 4);
  assert.equal(AGENT_A0_RESOURCE_BUDGET.totalNodeMemoryMb, 8192);
  assert.equal(AGENT_A0_RESOURCE_BUDGET.gpuRequired, false);
  assert.equal(AGENT_A0_RESOURCE_BUDGET.targetModelParametersB, 1.5);
  assert.equal(AGENT_A0_RESOURCE_BUDGET.quantization, 'Q4');
  assert.equal(AGENT_A0_RESOURCE_BUDGET.normalContextTokens, 2048);
  assert.equal(AGENT_A0_RESOURCE_BUDGET.maxContextTokens, 4096);
  assert.equal(AGENT_A0_RESOURCE_BUDGET.maxParallelGenerations, 1);
});

test('A0 accepts a model proposal only when action is allowed by the Engine projection', () => {
  const input = validInput();

  const decision = validateAgentDecision(
    {
      schemaVersion: 1,
      kind: 'PROPOSE_ACTION',
      reply: 'Perfecto, revisemos el viernes temprano.',
      proposedAction: {
        action: 'SET_DATE',
        arguments: {
          naturalDate: 'viernes',
          timePreference: 'early',
        },
      },
    },
    input,
  );

  assert.equal(decision.kind, 'PROPOSE_ACTION');
  if (decision.kind === 'PROPOSE_ACTION') {
    assert.equal(decision.proposedAction.action, 'SET_DATE');
  }
});

test('A0 rejects model actions that the current Engine projection does not allow', () => {
  const input = validInput();

  assert.throws(
    () =>
      validateAgentDecision(
        {
          schemaVersion: 1,
          kind: 'PROPOSE_ACTION',
          reply: 'Listo, reservé el horario.',
          proposedAction: {
            action: 'FINALIZE_APPOINTMENT',
            arguments: {},
          },
        },
        input,
      ),
    /Agent capability denied/,
  );
});

test('A0 excludes secret-like material from Engine facts and model action arguments', () => {
  const base = validInput();

  assert.throws(
    () =>
      validateAgentModelInput({
        ...base,
        conversation: {
          ...base.conversation,
          engine: {
            ...base.conversation.engine,
            facts: {
              apiKey: 'must-never-enter-model-context',
            },
          },
        },
      }),
    /secret-like material/,
  );

  assert.throws(
    () =>
      validateAgentDecision(
        {
          schemaVersion: 1,
          kind: 'PROPOSE_ACTION',
          reply: 'Perfecto.',
          proposedAction: {
            action: 'SET_DATE',
            arguments: {
              nested: {
                accessToken: 'must-never-enter-engine-action',
              },
            },
          },
        },
        base,
      ),
    /secret-like material/,
  );
});

test('A0 bounds conversational history for a small local model', () => {
  const base = validInput();
  const tooManyTurns = Array.from({ length: 9 }, (_, index) => ({
    role: index % 2 === 0 ? 'USER' : 'AGENT',
    text: `turn-${index}`,
  }));

  assert.throws(
    () =>
      validateAgentModelInput({
        ...base,
        conversation: {
          ...base.conversation,
          recentTurns: tooManyTurns,
        },
      }),
    /recentTurns exceeds 8 entries/,
  );
});

test('A0 treats provider output as untrusted and validates it before returning a decision', async () => {
  const input = validInput();

  const goodProvider: AgentModelProvider = {
    providerId: 'fake-local-1.5b',
    async generateTurn() {
      return {
        schemaVersion: 1,
        kind: 'CLARIFY',
        reply: '¿Temprano significa antes de las siete?',
      };
    },
  };

  const good = await runAgentModelTurn(goodProvider, input);
  assert.equal(good.kind, 'CLARIFY');

  const badProvider: AgentModelProvider = {
    providerId: 'fake-local-1.5b',
    async generateTurn() {
      return {
        schemaVersion: 1,
        kind: 'PROPOSE_ACTION',
        reply: 'Ya quedó reservado.',
        proposedAction: {
          action: 'FINALIZE_APPOINTMENT',
          arguments: {},
        },
      };
    },
  };

  await assert.rejects(() => runAgentModelTurn(badProvider, input), /Agent capability denied/);
});
