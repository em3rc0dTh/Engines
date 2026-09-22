import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  integrationOperationIdentity,
  integrationProviderEventIdentity,
  validateIntegrationCommand,
  validateIntegrationEvent,
} from '../src/contracts/integration-engine/index.js';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const runtimeRoot = resolve(scriptDir, '..');
const repoRoot = resolve(runtimeRoot, '../..');
const contractRoot = resolve(runtimeRoot, 'src/contracts/integration-engine');

function fail(message: string): never {
  throw new Error(`G3-I0 certification failed: ${message}`);
}

const productionFiles = ['types.ts', 'validation.ts', 'index.ts'];
const productionSource = productionFiles
  .map((file) => readFileSync(resolve(contractRoot, file), 'utf8'))
  .join('\n');

const forbiddenImports = [
  '/scheduler/',
  '/services/',
  '/cta/',
  '/orchestration/',
  'register-new-appointment',
  'register-new-customer',
];
for (const forbidden of forbiddenImports) {
  if (productionSource.toLowerCase().includes(forbidden.toLowerCase())) {
    fail(`Integration canonical contracts import/couple to forbidden domain surface: ${forbidden}`);
  }
}
console.log('INTEGRATION_G3_I0_AUTHORITY_BOUNDARY_PASS');

const providerNames = ['telegram', 'whatsapp', 'kapso', 'facebook', 'tiktok', 'messenger'];
for (const providerName of providerNames) {
  if (productionSource.toLowerCase().includes(providerName)) {
    fail(`provider name leaked into canonical Integration contract: ${providerName}`);
  }
}
console.log('INTEGRATION_G3_I0_PROVIDER_NEUTRAL_PASS');

const command = validateIntegrationCommand({
  schemaVersion: 1,
  commandId: 'cmd_i0_cert',
  operationId: 'case:case_001:external-sync',
  businessSlug: 'golden-business',
  connectionRef: 'conn_primary',
  capability: 'external-record-sync',
  action: 'UPSERT_RECORD',
  subjectRef: { kind: 'OperationalCase', ref: 'case_001' },
  payload: { recordRef: 'record_001', state: 'READY' },
  requestedAt: '2026-09-16T18:20:00.000Z',
  correlation: { correlationId: 'wf_i0_cert', causationId: 'case_001' },
});

const event = validateIntegrationEvent({
  schemaVersion: 1,
  eventId: 'intevt_i0_cert',
  providerEventIdentity: 'external-event-i0-cert',
  businessSlug: 'golden-business',
  connectionRef: 'conn_primary',
  capability: 'external-record-sync',
  eventType: 'RECORD_ACCEPTED',
  payload: { recordRef: 'record_001', accepted: true },
  occurredAt: '2026-09-16T18:20:01.000Z',
  receivedAt: '2026-09-16T18:20:02.000Z',
  correlation: { correlationId: 'wf_i0_cert' },
});

if (command.businessSlug !== event.businessSlug) fail('certification fixture lost business scope');
console.log('INTEGRATION_G3_I0_CONTRACTS_PASS');

let secretRejected = false;
try {
  validateIntegrationCommand({
    ...command,
    payload: { recordRef: 'record_001', nested: { accessToken: 'forbidden' } },
  });
} catch (error) {
  secretRejected = error instanceof Error && error.message.includes('secret-like material');
}
if (!secretRejected) fail('secret-like payload was not rejected');
console.log('INTEGRATION_G3_I0_SECRET_BOUNDARY_PASS');

const opA = integrationOperationIdentity('golden-business', 'case:case_001:external-sync');
const opReplay = integrationOperationIdentity('golden-business', 'case:case_001:external-sync');
const opOtherBusiness = integrationOperationIdentity('other-business', 'case:case_001:external-sync');
if (opA !== opReplay || opA === opOtherBusiness) fail('operation identity is not stable and business-scoped');

const evtA = integrationProviderEventIdentity('golden-business', 'conn_primary', 'provider-event-1');
const evtReplay = integrationProviderEventIdentity('golden-business', 'conn_primary', 'provider-event-1');
const evtOtherConnection = integrationProviderEventIdentity('golden-business', 'conn_secondary', 'provider-event-1');
if (evtA !== evtReplay || evtA === evtOtherConnection) fail('provider event identity is not stable and connection-scoped');
console.log('INTEGRATION_G3_I0_IDENTITY_PASS');

const design = readFileSync(resolve(repoRoot, 'mk1/Design/07-integration-engine-contract.md'), 'utf8');
if (!design.includes('IntegrationCommand') || !design.includes('IntegrationEvent')) {
  fail('design contract does not preserve canonical command/event boundary');
}
if (!design.includes('Existing interactive Telegram/WhatsApp channel transports remain CTA/channel evidence')) {
  fail('design contract does not preserve existing channel-vs-Integration truth boundary');
}

console.log('INTEGRATION_G3_I0_CERTIFICATION_PASS');
