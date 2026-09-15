import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

type GateStatus = 'CERTIFIED' | 'NEXT' | 'OPEN';

type Gate = {
  id: string;
  status: GateStatus;
  predecessor: string | null;
  expectedReceipt: string;
  expectedWorkflow: string;
  terminalMarker: string;
};

type Ledger = {
  schemaVersion: number;
  engine: string;
  track: string;
  policy: string;
  currentNext: string | null;
  gates: Gate[];
};

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, '../../..');
const ledgerPath = resolve(repoRoot, 'mk1/Test/g2-scheduler-certification-ledger.json');
const policyPath = resolve(repoRoot, 'mk1/Test/g2-scheduler-certification-policy.md');
const roadmapPath = resolve(repoRoot, 'mk1/Plan/04-platform-steps-3-4-5-roadmap.md');

function fail(message: string): never {
  throw new Error(`Scheduler certification ledger invalid: ${message}`);
}

if (!existsSync(ledgerPath)) fail('ledger file is missing');
if (!existsSync(policyPath)) fail('mandatory certification policy is missing');
if (!existsSync(roadmapPath)) fail('Scheduler roadmap is missing');

const ledger = JSON.parse(readFileSync(ledgerPath, 'utf8')) as Ledger;

if (ledger.schemaVersion !== 1) fail(`unsupported schemaVersion ${ledger.schemaVersion}`);
if (ledger.engine !== 'Scheduler') fail(`engine must be Scheduler, got ${ledger.engine}`);
if (ledger.track !== 'G2') fail(`track must be G2, got ${ledger.track}`);
if (ledger.policy !== 'sequential-hard-gates') fail(`policy must be sequential-hard-gates, got ${ledger.policy}`);
if (!Array.isArray(ledger.gates) || ledger.gates.length !== 10) fail('exactly G2-S0 through G2-S9 must be declared');

const expectedIds = Array.from({ length: 10 }, (_, index) => `G2-S${index}`);
const validStatuses = new Set<GateStatus>(['CERTIFIED', 'NEXT', 'OPEN']);

ledger.gates.forEach((gate, index) => {
  if (gate.id !== expectedIds[index]) fail(`gate index ${index} must be ${expectedIds[index]}, got ${gate.id}`);
  if (!validStatuses.has(gate.status)) fail(`${gate.id} has invalid status ${String(gate.status)}`);

  const expectedPredecessor = index === 0 ? null : expectedIds[index - 1];
  if (gate.predecessor !== expectedPredecessor) {
    fail(`${gate.id} predecessor must be ${expectedPredecessor ?? 'null'}, got ${String(gate.predecessor)}`);
  }

  const expectedMarker = `SCHEDULER_G2_S${index}_CERTIFICATION_PASS`;
  if (gate.terminalMarker !== expectedMarker) {
    fail(`${gate.id} marker must be ${expectedMarker}, got ${gate.terminalMarker}`);
  }
});

const certifiedCount = ledger.gates.filter((gate) => gate.status === 'CERTIFIED').length;
const nextGates = ledger.gates.filter((gate) => gate.status === 'NEXT');

for (let index = 0; index < certifiedCount; index += 1) {
  if (ledger.gates[index]?.status !== 'CERTIFIED') {
    fail(`CERTIFIED gates must form a contiguous prefix; ${expectedIds[index]} is not CERTIFIED`);
  }
}

if (certifiedCount === ledger.gates.length) {
  if (nextGates.length !== 0) fail('no NEXT gate is allowed after G2-S9 is certified');
  if (ledger.currentNext !== null) fail('currentNext must be null after final certification');
} else {
  if (nextGates.length !== 1) fail(`exactly one NEXT gate is required, found ${nextGates.length}`);
  const expectedNext = expectedIds[certifiedCount];
  if (nextGates[0]?.id !== expectedNext) fail(`NEXT gate must be ${expectedNext}, got ${nextGates[0]?.id}`);
  if (ledger.currentNext !== expectedNext) fail(`currentNext must be ${expectedNext}, got ${String(ledger.currentNext)}`);

  for (let index = certifiedCount + 1; index < ledger.gates.length; index += 1) {
    if (ledger.gates[index]?.status !== 'OPEN') {
      fail(`${expectedIds[index]} must remain OPEN until every predecessor is certified`);
    }
  }
}

for (const gate of ledger.gates.filter((candidate) => candidate.status === 'CERTIFIED')) {
  const receiptPath = resolve(repoRoot, gate.expectedReceipt);
  const workflowPath = resolve(repoRoot, gate.expectedWorkflow);

  if (!existsSync(receiptPath)) fail(`${gate.id} receipt missing at ${gate.expectedReceipt}`);
  if (!existsSync(workflowPath)) fail(`${gate.id} workflow missing at ${gate.expectedWorkflow}`);

  const receipt = readFileSync(receiptPath, 'utf8');
  const workflow = readFileSync(workflowPath, 'utf8');

  if (!receipt.includes('✅ CERTIFIED')) fail(`${gate.id} receipt does not carry an explicit CERTIFIED verdict`);
  if (!receipt.includes(gate.terminalMarker)) fail(`${gate.id} receipt does not record ${gate.terminalMarker}`);
  if (!workflow.includes(gate.terminalMarker)) fail(`${gate.id} workflow does not emit ${gate.terminalMarker}`);
}

const policy = readFileSync(policyPath, 'utf8');
if (!policy.includes('No Scheduler gate may be skipped')) fail('policy does not explicitly prohibit skipped gates');
if (!policy.includes('RE-RUN THE SAME GATE ON THE FINAL BRANCH HEAD')) fail('policy does not require exact-final-head recertification');

const roadmap = readFileSync(roadmapPath, 'utf8');
if (ledger.currentNext && !roadmap.includes(ledger.currentNext)) {
  fail(`roadmap does not mention current next gate ${ledger.currentNext}`);
}

console.log(`Scheduler certified prefix: G2-S0..G2-S${Math.max(0, certifiedCount - 1)}`);
console.log(`Scheduler next gate: ${ledger.currentNext ?? 'none — final closure certified'}`);
console.log('SCHEDULER_G2_CERTIFICATION_LEDGER_PASS');
