import assert from 'node:assert/strict';

import { resolveAgentProfile } from '../src/contracts/agent-layer/index.js';
import {
  LlamaCppA5ExperienceProvider,
  validateA5ExperienceOutput,
  type A5ExperienceModelInput,
} from '../src/agent/experience/index.js';

const FIRST_MESSAGE = 'Tengo un problema con la suspensión de mi carro.';

async function run(): Promise<void> {
  const provider = new LlamaCppA5ExperienceProvider({
    baseUrl: process.env.AGENT_LLAMA_BASE_URL?.trim() || 'http://127.0.0.1:8080',
    model: process.env.AGENT_LLAMA_MODEL?.trim() || 'engines-agent-local',
    timeoutMs: Number.parseInt(process.env.AGENT_MODEL_TIMEOUT_MS ?? '30000', 10),
  });

  const profile = resolveAgentProfile({
    identity: {
      name: 'Jett',
      role: 'Staff Assistant',
    },
  });

  const input: A5ExperienceModelInput = {
    schemaVersion: 1,
    profile,
    businessDisplayName: 'Gallo Autos',
    conversation: {
      businessSlug: 'golden-business',
      conversationId: 'cert-a5-first-turn',
      locale: profile.voice.locale,
      recentTurns: [],
      currentMessage: FIRST_MESSAGE,
      engine: {
        phase: 'WAITING_FOR_CUSTOMER',
        facts: {
          workflowStatus: 'RUNNING',
          phase: 'WAITING_FOR_CUSTOMER',
          nextAction: 'PROVIDE_CUSTOMER',
          customer: { status: 'EMPTY' },
          managedEntity: {
            status: 'PENDING',
            label: 'Vehículo',
            candidates: [],
          },
          services: [],
          offerings: [],
          availableSlots: [],
          issues: [],
        },
        allowedActions: [],
        hints: [
          'No customer identity action is available yet. Continue the conversation naturally until the user explicitly supplies identity.',
        ],
      },
    },
  };

  const raw = await provider.generateTurn(input);
  const validated = validateA5ExperienceOutput(raw, input);
  const output = validated.output;

  assert.equal(validated.decision.kind, 'RESPOND');
  assert.equal(output.proposedAction, undefined);

  const normalizedReply = output.reply.toLowerCase();
  assert.match(normalizedReply, /jett/);
  assert.match(normalizedReply, /gallo autos/);
  assert.ok(
    /cu[eé]ntame|dime|expl[ií]came|qu[eé] pasa|qu[eé] sucede/.test(normalizedReply),
    'first reply must invite the human to continue naturally',
  );

  const problem = output.distillation.observed.find((fact) => fact.field === 'problem_statement');
  assert.ok(problem, 'problem_statement must be observed on the first turn');
  assert.match(problem.value.toLowerCase(), /suspensi[oó]n/);

  assert.equal(
    output.distillation.observed.some((fact) => fact.field === 'customer_name' || fact.field === 'customer_email'),
    false,
    'customer identity must not be fabricated',
  );

  console.log('A5_REAL_FIRST_TURN_OUTPUT ' + JSON.stringify(output));
  console.log('A5_REAL_FIRST_TURN_PASS');
}

run().catch((error: unknown) => {
  console.error('A5_REAL_FIRST_TURN_FAILED ' + JSON.stringify({
    error: error instanceof Error ? error.message : String(error),
  }));
  process.exitCode = 1;
});
