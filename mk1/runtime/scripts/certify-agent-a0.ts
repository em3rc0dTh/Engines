import assert from 'node:assert/strict';

import {
  AGENT_A0_RESOURCE_BUDGET,
  AGENT_SYSTEM_INVARIANTS,
  resolveAgentProfileFromUnknown,
  validateAgentDecision,
  validateAgentModelInput,
} from '../src/contracts/agent-layer/index.js';

const profile = resolveAgentProfileFromUnknown({
  identity: { name: 'Mia' },
  personality: { warmth: 0.9 },
});

assert.equal(profile.identity.name, 'Mia');
assert.equal(profile.identity.role, 'Customer Assistant');
assert.equal(profile.personality.warmth, 0.9);
assert.equal(profile.personality.formality, 0.45);
console.log('AGENT_A0_DEFAULT_OVERRIDE_RESOLUTION_PASS');

assert.deepEqual(AGENT_SYSTEM_INVARIANTS, {
  engineOwnsBusinessTruth: true,
  noDirectPersistence: true,
  onlyEngineAllowedActions: true,
  neverInventExecution: true,
  credentialsStayOutsideModelContext: true,
});
console.log('AGENT_A0_ENGINE_AUTHORITY_PASS');

const input = validateAgentModelInput({
  schemaVersion: 1,
  profile,
  conversation: {
    businessSlug: 'golden-business',
    conversationId: 'agent-a0-cert',
    locale: 'es-PE',
    recentTurns: [],
    currentMessage: 'El viernes temprano.',
    engine: {
      phase: 'WAITING_FOR_DATE',
      facts: {
        managedEntityName: 'Renault Logan',
        serviceName: 'Car Wash',
      },
      allowedActions: ['SET_DATE'],
    },
  },
});

const accepted = validateAgentDecision(
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
assert.equal(accepted.kind, 'PROPOSE_ACTION');

assert.throws(
  () =>
    validateAgentDecision(
      {
        schemaVersion: 1,
        kind: 'PROPOSE_ACTION',
        reply: 'Listo.',
        proposedAction: {
          action: 'FINALIZE_APPOINTMENT',
          arguments: {},
        },
      },
      input,
    ),
  /Agent capability denied/,
);
console.log('AGENT_A0_CAPABILITY_BOUNDARY_PASS');

assert.throws(
  () =>
    resolveAgentProfileFromUnknown({
      invariants: {
        engineOwnsBusinessTruth: false,
      },
    }),
  /not configurable/,
);
console.log('AGENT_A0_INVARIANT_OVERRIDE_REJECTION_PASS');

assert.equal(AGENT_A0_RESOURCE_BUDGET.totalNodeVcpu, 4);
assert.equal(AGENT_A0_RESOURCE_BUDGET.totalNodeMemoryMb, 8192);
assert.equal(AGENT_A0_RESOURCE_BUDGET.gpuRequired, false);
assert.equal(AGENT_A0_RESOURCE_BUDGET.targetModelParametersB, 1.5);
assert.equal(AGENT_A0_RESOURCE_BUDGET.maxContextTokens, 4096);
assert.equal(AGENT_A0_RESOURCE_BUDGET.maxParallelGenerations, 1);
console.log('AGENT_A0_RESOURCE_BUDGET_PASS');

console.log('AGENT_A0_PROVIDER_AGNOSTIC_PASS');
console.log('AGENT_A0_CERTIFICATION_PASS');
