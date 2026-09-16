import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

type GateStatus = 'CERTIFIED' | 'NEXT' | 'OPEN';

type Gate = Readonly<{
  id: string;
  status: GateStatus;
  predecessor: string | null;
  expectedReceipt: string;
  expectedWorkflow: string;
  terminalMarker: string;
}>;

type Ledger = Readonly<{
  schemaVersion: number;
  engine: string;
  track: string;
  policy: string;
  currentNext: string | null;
  gates: readonly Gate[];
}>;

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, '../../..');
const ledgerPath = resolve(repoRoot, 'mk1/Test/g3-integration-certification-ledger.json');
const policyPath = resolve(repoRoot, 'mk1/Test/g3-integration-certification-policy.md');
const designPath = resolve(repoRoot, 'mk1/Design/07-integration-engine-contract.md');

function fail(message: string): never {
  throw new Error(`Integration certification ledger invalid: ${message}`);
}

if (!existsSync(ledgerPath)) fail('ledger file is missing');
if (!existsSync(policyPath)) fail('mandatory certification policy is missing');
if (!existsSync(designPath)) fail('Integration design contract is missing');

const ledger = JSON.parse(readFileSync(ledgerPath, 'utf8')) as Ledger;

if (ledger.schemaVersion !== 1) fail(`unsupported schemaVersion ${ledger.schemaVersion}`);
if (ledger.engine !== 'Integration') fail(`engine must be Integration, got ${ledger.engine}`);
if (ledger.track !== 'G3') fail(`track must be G3, got ${ledger.track}`);
if (ledger.policy !== 'sequential-hard-gates') fail(`policy must be sequential-hard-gates, got ${ledger.policy}`);
if (!Array.isArray(ledger.gates) || ledger.gates.length !== 6) fail('exactly G3-I0 through G3-I5 must be declared');

const expectedIds = Array.from({ length: 6 }, (_, index) => `G3-I${index}`);
const validStatuses = new Set<GateStatus>(['CERTIFIED', 'NEXT', 'OPEN']);

ledger.gates.forEach((gate, index) => {
  if (gate.id !== expectedIds[index]) fail(`gate index ${index} must be ${expectedIds[index]}, got ${gate.id}`);
  if (!validStatuses.has(gate.status)) fail(`${gate.id} has invalid status ${String(gate.status)}`);

  const expectedPredecessor = index === 0 ? null : expectedIds[index - 1];
  if (gate.predecessor !== expectedPredecessor) {
    fail(`${gate.id} predecessor must be ${expectedPredecessor ?? 'null'}, got ${String(gate.predecessor)}`);
  }

  const expectedMarker = `INTEGRATION_G3_I${index}_CERTIFICATION_PASS`;
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
  if (nextGates.length !== 0) fail('no NEXT gate is allowed after G3-I5 is certified');
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
if (!policy.includes('No Integration gate may be skipped')) fail('policy does not explicitly prohibit skipped gates');
if (!policy.includes('RE-RUN SAME GATE ON FINAL BRANCH HEAD')) fail('policy does not require exact-final-head recertification');

const design = readFileSync(designPath, 'utf8');
if (ledger.currentNext && !design.includes(ledger.currentNext.replace('G3-', ''))) {
  fail(`design contract does not mention current next gate ${ledger.currentNext}`);
}

console.log(`Integration certified gates: ${certifiedCount}`);
console.log(`Integration next gate: ${ledger.currentNext ?? 'none — final closure certified'}`);
console.log('INTEGRATION_G3_CERTIFICATION_LEDGER_PASS');
