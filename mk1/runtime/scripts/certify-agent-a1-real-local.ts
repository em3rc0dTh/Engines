import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';

import {
  resolveAgentProfile,
  validateAgentDecision,
  validateAgentModelInput,
  type AgentModelInput,
} from '../src/contracts/agent-layer/index.js';
import {
  AGENT_A1_LOCAL_MODEL,
  LlamaCppAgentModelProvider,
} from '../src/agent/index.js';

const baseUrl = process.env.AGENT_LLAMA_BASE_URL ?? 'http://127.0.0.1:8080';
const model = process.env.AGENT_LLAMA_MODEL ?? AGENT_A1_LOCAL_MODEL.modelAlias;

const provider = new LlamaCppAgentModelProvider({
  baseUrl,
  model,
  timeoutMs: 30_000,
  seed: 42,
});

type GoldenCase = Readonly<{
  id: string;
  message: string;
  phase: string;
  facts: Readonly<Record<string, unknown>>;
  allowedActions: readonly string[];
  hints?: readonly string[];
  expectedKind: 'RESPOND' | 'CLARIFY' | 'PROPOSE_ACTION';
  expectedAction?: string;
  expectedArgumentContains?: string;
}>;

const cases: readonly GoldenCase[] = [
  {
    id: 'A1-GOLDEN-DATE',
    message: 'Mejor el viernes.',
    phase: 'WAITING_FOR_DATE',
    facts: {
      managedEntityName: 'Renault Logan',
      serviceName: 'Car Wash',
    },
    allowedActions: ['SET_DATE'],
    hints: ['For SET_DATE use arguments {"naturalDate":"<date words from user>"}.'],
    expectedKind: 'PROPOSE_ACTION',
    expectedAction: 'SET_DATE',
    expectedArgumentContains: 'viernes',
  },
  {
    id: 'A1-GOLDEN-ENTITY',
    message: 'El Logan.',
    phase: 'WAITING_FOR_MANAGED_ENTITY',
    facts: {
      managedEntityCandidates: [
        { managedEntityId: 'men_logan', displayName: 'Renault Logan' },
        { managedEntityId: 'men_sentra', displayName: 'Nissan Sentra' },
      ],
    },
    allowedActions: ['SELECT_MANAGED_ENTITY'],
    hints: [
      'For SELECT_MANAGED_ENTITY use arguments {"managedEntityId":"<exact candidate id>"} and copy the id from facts.',
    ],
    expectedKind: 'PROPOSE_ACTION',
    expectedAction: 'SELECT_MANAGED_ENTITY',
    expectedArgumentContains: 'men_logan',
  },
  {
    id: 'A1-GOLDEN-OFFERING',
    message: 'La ejecutiva.',
    phase: 'WAITING_FOR_OFFERING',
    facts: {
      offerings: [
        { offeringId: 'off_basic', name: 'Basic Clean' },
        { offeringId: 'off_executive', name: 'Executive Clean' },
      ],
    },
    allowedActions: ['SELECT_OFFERING'],
    hints: [
      'For SELECT_OFFERING use arguments {"offeringId":"<exact offering id>"} and copy the id from facts.',
    ],
    expectedKind: 'PROPOSE_ACTION',
    expectedAction: 'SELECT_OFFERING',
    expectedArgumentContains: 'off_executive',
  },
  {
    id: 'A1-GOLDEN-FINALIZE',
    message: 'Sí, confirma.',
    phase: 'WAITING_FOR_FINALIZATION',
    facts: {
      summary: {
        managedEntityName: 'Renault Logan',
        serviceName: 'Car Wash',
        offeringName: 'Executive Clean',
        date: '2026-09-25',
        slot: '06:30-07:00',
      },
    },
    allowedActions: ['FINALIZE_APPOINTMENT'],
    hints: ['For FINALIZE_APPOINTMENT use empty arguments {}.'],
    expectedKind: 'PROPOSE_ACTION',
    expectedAction: 'FINALIZE_APPOINTMENT',
  },
  {
    id: 'A1-GOLDEN-CONVERSATION',
    message: 'Gracias!',
    phase: 'APPOINTMENT_COMPLETE',
    facts: {
      completion: 'The Engine has completed the appointment successfully.',
    },
    allowedActions: [],
    expectedKind: 'RESPOND',
  },
];

function buildInput(testCase: GoldenCase): AgentModelInput {
  const engine: Record<string, unknown> = {
    phase: testCase.phase,
    facts: testCase.facts,
    allowedActions: testCase.allowedActions,
  };
  if (testCase.hints) engine.hints = testCase.hints;

  return validateAgentModelInput({
    schemaVersion: 1,
    profile: resolveAgentProfile({
      identity: {
        name: 'Mia',
        role: 'Customer Assistant',
      },
      personality: {
        warmth: 0.85,
        formality: 0.3,
        verbosity: 'CONCISE',
      },
    }),
    conversation: {
      businessSlug: 'golden-business',
      conversationId: 'a1-golden-' + testCase.id.toLowerCase(),
      locale: 'es-PE',
      recentTurns: [],
      currentMessage: testCase.message,
      engine,
    },
  });
}

const latencies: number[] = [];

for (const testCase of cases) {
  const input = buildInput(testCase);
  const started = performance.now();
  const rawDecision = await provider.generateTurn(input);
  console.log(JSON.stringify({ case: testCase.id, rawDecision }));
  const decision = validateAgentDecision(rawDecision, input);
  const elapsedMs = performance.now() - started;
  latencies.push(elapsedMs);

  assert.equal(decision.kind, testCase.expectedKind, testCase.id + ' kind mismatch');

  if (testCase.expectedAction) {
    assert.equal(decision.kind, 'PROPOSE_ACTION', testCase.id + ' must propose an action');
    if (decision.kind === 'PROPOSE_ACTION') {
      assert.equal(decision.proposedAction.action, testCase.expectedAction);
      if (testCase.expectedArgumentContains) {
        assert.match(
          JSON.stringify(decision.proposedAction.arguments).toLowerCase(),
          new RegExp(testCase.expectedArgumentContains.toLowerCase()),
          testCase.id + ' must preserve expected canonical/user value',
        );
      }
    }
  }

  assert.ok(decision.reply.trim().length > 0, testCase.id + ' reply must not be empty');
  assert.ok(decision.reply.length <= 1000, testCase.id + ' reply exceeded A0 bound');
  assert.ok(elapsedMs < 30_000, testCase.id + ' exceeded 30s latency guard');

  console.log(
    JSON.stringify({
      case: testCase.id,
      elapsedMs: Math.round(elapsedMs),
      kind: decision.kind,
      action: decision.kind === 'PROPOSE_ACTION' ? decision.proposedAction.action : null,
      reply: decision.reply,
    }),
  );
}

const sorted = [...latencies].sort((a, b) => a - b);
const median = sorted[Math.floor(sorted.length / 2)]!;
const max = sorted[sorted.length - 1]!;

console.log(
  JSON.stringify({
    model,
    cases: cases.length,
    medianLatencyMs: Math.round(median),
    maxLatencyMs: Math.round(max),
  }),
);

console.log('AGENT_A1_REAL_LOCAL_MODEL_PASS');
console.log('AGENT_A1_SCHEMA_CONSTRAINED_OUTPUT_PASS');
console.log('AGENT_A1_GOLDEN_CONVERSATION_PASS');
console.log('AGENT_A1_ENGINE_ACTION_MAPPING_PASS');
console.log('AGENT_A1_LATENCY_MEASURED_PASS');
console.log('AGENT_A1_CERTIFICATION_PASS');
