import assert from 'node:assert/strict';
import { createServer, type Server } from 'node:http';
import test from 'node:test';

import {
  resolveAgentProfile,
  runAgentModelTurn,
  validateAgentModelInput,
} from '../../contracts/agent-layer/index.js';
import { LlamaCppAgentModelProvider } from './llama-cpp.provider.js';

function input() {
  return validateAgentModelInput({
    schemaVersion: 1,
    profile: resolveAgentProfile({
      identity: { name: 'Mia' },
      personality: { warmth: 0.9 },
    }),
    conversation: {
      businessSlug: 'golden-business',
      conversationId: 'conv-a1-test',
      locale: 'es-PE',
      recentTurns: [],
      currentMessage: 'Mejor el viernes.',
      engine: {
        phase: 'WAITING_FOR_DATE',
        facts: {
          managedEntityName: 'Renault Logan',
          serviceName: 'Car Wash',
        },
        allowedActions: ['SET_DATE'],
        hints: ['For SET_DATE use arguments {"naturalDate":"<user words>"}.'],
      },
    },
  });
}

async function withServer(
  handler: Parameters<typeof createServer>[0],
  run: (baseUrl: string) => Promise<void>,
): Promise<void> {
  const server: Server = createServer(handler);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  assert.ok(address && typeof address === 'object');

  try {
    await run('http://127.0.0.1:' + address.port);
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
}

test('A1 llama.cpp provider sends bounded schema-constrained deterministic request', async () => {
  let captured: Record<string, unknown> | undefined;

  await withServer((request, response) => {
    let body = '';
    request.setEncoding('utf8');
    request.on('data', (chunk) => {
      body += chunk;
    });
    request.on('end', () => {
      captured = JSON.parse(body) as Record<string, unknown>;
      response.setHeader('content-type', 'application/json');
      response.end(
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  schemaVersion: 1,
                  kind: 'PROPOSE_ACTION',
                  reply: 'Perfecto, revisemos el viernes.',
                  proposedAction: {
                    action: 'SET_DATE',
                    arguments: {
                      naturalDate: 'viernes',
                    },
                  },
                }),
              },
            },
          ],
        }),
      );
    });
  }, async (baseUrl) => {
    const provider = new LlamaCppAgentModelProvider({ baseUrl, model: 'engines-agent-local' });
    const decision = await runAgentModelTurn(provider, input());
    assert.equal(decision.kind, 'PROPOSE_ACTION');
  });

  assert.ok(captured);
  assert.equal(captured.temperature, 0);
  assert.equal(captured.max_tokens, 128);
  assert.equal(captured.reasoning_effort, 'none');

  const format = captured.response_format as Record<string, unknown>;
  assert.equal(format.type, 'json_schema');
  const schemaText = JSON.stringify(format.schema);
  assert.match(schemaText, /SET_DATE/);
  assert.doesNotMatch(schemaText, /FINALIZE_APPOINTMENT/);

  const messages = captured.messages as Array<Record<string, unknown>>;
  assert.equal(messages.length, 2);
  assert.match(String(messages[0]?.content), /Engines owns all business truth/);
  assert.match(String(messages[0]?.content), /Mia/);
});

test('A1 llama.cpp provider fails closed on provider HTTP failure', async () => {
  await withServer((_request, response) => {
    response.statusCode = 503;
    response.end('model unavailable');
  }, async (baseUrl) => {
    const provider = new LlamaCppAgentModelProvider({ baseUrl });
    await assert.rejects(() => runAgentModelTurn(provider, input()), /HTTP 503/);
  });
});

test('A1 llama.cpp provider fails closed on non-JSON model content', async () => {
  await withServer((_request, response) => {
    response.setHeader('content-type', 'application/json');
    response.end(
      JSON.stringify({
        choices: [{ message: { content: 'I think Friday works.' } }],
      }),
    );
  }, async (baseUrl) => {
    const provider = new LlamaCppAgentModelProvider({ baseUrl });
    await assert.rejects(() => runAgentModelTurn(provider, input()), /not valid JSON/);
  });
});

test('A1 provider output still crosses A0 capability validation', async () => {
  await withServer((_request, response) => {
    response.setHeader('content-type', 'application/json');
    response.end(
      JSON.stringify({
        choices: [
          {
            message: {
              content: JSON.stringify({
                schemaVersion: 1,
                kind: 'PROPOSE_ACTION',
                reply: 'Listo.',
                proposedAction: {
                  action: 'FINALIZE_APPOINTMENT',
                  arguments: {},
                },
              }),
            },
          },
        ],
      }),
    );
  }, async (baseUrl) => {
    const provider = new LlamaCppAgentModelProvider({ baseUrl });
    await assert.rejects(() => runAgentModelTurn(provider, input()), /Agent capability denied/);
  });
});
