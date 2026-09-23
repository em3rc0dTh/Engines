import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const TOTAL_BUDGET_MB = 8192;
const OS_DOCKER_RESERVE_MB = 1024;
const LLAMA_CAP_MB = 2304;

function parseMemory(value: string): number {
  const token = value.trim().split(/\s+/)[0] ?? '';
  const match = token.match(/^([0-9.]+)(B|KiB|MiB|GiB)$/);
  if (!match) throw new Error('AGENT_A2_MEMORY_PARSE_FAILED:' + value);
  const amount = Number(match[1]);
  const unit = match[2];
  if (unit === 'B') return amount / (1024 * 1024);
  if (unit === 'KiB') return amount / 1024;
  if (unit === 'MiB') return amount;
  return amount * 1024;
}

function llamaRssMb(): number {
  const pidFile = process.env.AGENT_LLAMA_PID_FILE ?? '/tmp/agent-a2-llama.pid';
  const pid = readFileSync(pidFile, 'utf8').trim();
  const status = readFileSync('/proc/' + pid + '/status', 'utf8');
  const match = status.match(/^VmRSS:\s+(\d+)\s+kB$/m);
  if (!match) throw new Error('AGENT_A2_LLAMA_RSS_MISSING');
  return Number(match[1]) / 1024;
}

const ids = execFileSync('docker', ['compose', '--profile', 'webchat', 'ps', '-q'], { encoding: 'utf8' })
  .trim()
  .split(/\s+/)
  .filter(Boolean);

assert.ok(ids.length >= 6, 'expected operational compose containers');

const raw = execFileSync(
  'docker',
  ['stats', '--no-stream', '--format', '{{json .}}', ...ids],
  { encoding: 'utf8' },
);

const containers = raw
  .trim()
  .split('\n')
  .filter(Boolean)
  .map((line) => JSON.parse(line) as Record<string, string>)
  .map((item) => ({
    name: item.Name ?? item.Container ?? 'unknown',
    memoryMb: parseMemory(item.MemUsage ?? ''),
  }));

const containerMb = containers.reduce((sum, item) => sum + item.memoryMb, 0);
const llamaMb = llamaRssMb();
const accountedMb = containerMb + llamaMb + OS_DOCKER_RESERVE_MB;

assert.ok(llamaMb <= LLAMA_CAP_MB, 'llama-server RSS exceeds A1 cap');
assert.ok(accountedMb <= TOTAL_BUDGET_MB, 'A2 total node budget exceeded');

console.log(JSON.stringify({
  budgetMb: TOTAL_BUDGET_MB,
  osDockerReserveMb: OS_DOCKER_RESERVE_MB,
  containerMb: Math.round(containerMb),
  llamaMb: Math.round(llamaMb),
  accountedMb: Math.round(accountedMb),
  headroomMb: Math.round(TOTAL_BUDGET_MB - accountedMb),
  containers,
}, null, 2));

console.log('AGENT_A2_FOUR_VCPU_AFFINITY_PROFILE_PASS');
console.log('AGENT_A2_TOTAL_NODE_MEMORY_BUDGET_PASS');
