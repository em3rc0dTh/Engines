import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const runtimeRoot = new URL('../../../', import.meta.url);

async function text(path: string): Promise<string> {
  return readFile(new URL(path, runtimeRoot), 'utf8');
}

test('Docker local inference keeps the certified llama.cpp and Qwen identities', async () => {
  const [dockerfile, runner] = await Promise.all([
    text('Dockerfile.agent-llama'),
    text('scripts/run-agent-llama.sh'),
  ]);

  assert.match(dockerfile, /b29c606e28a01b1bc8c1351026a0fa6e616bf6c4/);
  assert.match(dockerfile, /-DGGML_CUDA=OFF/);
  assert.match(dockerfile, /-DGGML_OPENMP=ON/);
  assert.match(runner, /qwen2\.5-1\.5b-instruct-q4_k_m\.gguf/);
  assert.match(runner, /6a1a2eb6d15622bf3c96857206351ba97e1af16c30d7a74ee38970e434e9407e/);
  assert.match(runner, /--threads "\$\{THREADS\}"/);
  assert.match(runner, /--ctx-size "\$\{CTX_SIZE\}"/);
  assert.match(runner, /--parallel "\$\{PARALLEL\}"/);
});

test('Compose exposes a persistent Agent model service and the Agent overlay binds channel-core to it', async () => {
  const [compose, overlay] = await Promise.all([
    text('docker-compose.yml'),
    text('docker-compose.agent.yml'),
  ]);

  assert.match(compose, /agent-llama:/);
  assert.match(compose, /profiles: \["agent"\]/);
  assert.match(compose, /Dockerfile\.agent-llama/);
  assert.match(compose, /engines_agent_models:\/models/);
  assert.match(compose, /127\.0\.0\.1:\$\{AGENT_LLAMA_HOST_PORT:-8080\}:8080/);
  assert.match(compose, /AGENT_LLAMA_BASE_URL: \$\{AGENT_LLAMA_BASE_URL:-http:\/\/agent-llama:8080\}/);

  assert.match(overlay, /ENGINES_AGENT_ENABLED: "true"/);
  assert.match(overlay, /AGENT_LLAMA_BASE_URL: http:\/\/agent-llama:8080/);
  assert.match(overlay, /agent-llama:\s*\n\s*condition: service_healthy/);
});
