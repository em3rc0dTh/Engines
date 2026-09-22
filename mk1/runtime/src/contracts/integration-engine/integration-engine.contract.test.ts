import assert from 'node:assert/strict';
import test from 'node:test';

import {
  integrationOperationIdentity,
  integrationProviderEventIdentity,
  validateIntegrationCommand,
  validateIntegrationEvent,
} from './index.js';

const VALID_COMMAND = {
  schemaVersion: 1,
  commandId: 'cmd_001',
  operationId: 'appointment:apt_001:sync',
  businessSlug: 'golden-business',
  connectionRef: 'conn_crm_primary',
  capability: 'crm.contact-sync',
  action: 'UPSERT_CONTACT',
  subjectRef: {
    kind: 'Customer',
    ref: 'cus_001',
  },
  payload: {
    displayName: 'Eduardo',
    email: 'eduardo@example.test',
    metadata: {
      source: 'appointment',
    },
  },
  requestedAt: '2026-09-16T18:10:00.000Z',
  correlation: {
    correlationId: 'wf_001',
    causationId: 'evt_001',
  },
} as const;

const VALID_EVENT = {
  schemaVersion: 1,
  eventId: 'intevt_001',
  providerEventIdentity: 'external-event-991',
  businessSlug: 'golden-business',
  connectionRef: 'conn_crm_primary',
  capability: 'crm.contact-sync',
  eventType: 'CONTACT_ACCEPTED',
  payload: {
    externalContactRef: 'contact_44',
    accepted: true,
  },
  occurredAt: '2026-09-16T18:10:01.000Z',
  receivedAt: '2026-09-16T18:10:02.000Z',
  correlation: {
    correlationId: 'wf_001',
  },
} as const;

test('accepts provider-neutral IntegrationCommand and IntegrationEvent', () => {
  const command = validateIntegrationCommand(VALID_COMMAND);
  const event = validateIntegrationEvent(VALID_EVENT);

  assert.equal(command.operationId, VALID_COMMAND.operationId);
  assert.equal(event.providerEventIdentity, VALID_EVENT.providerEventIdentity);
});

test('requires exactly one canonical subject/target reference', () => {
  assert.throws(
    () => validateIntegrationCommand({ ...VALID_COMMAND, subjectRef: undefined }),
    /exactly one of subjectRef or targetRef/,
  );

  assert.throws(
    () =>
      validateIntegrationCommand({
        ...VALID_COMMAND,
        targetRef: { kind: 'ExternalContact', ref: 'ext_001' },
      }),
    /exactly one of subjectRef or targetRef/,
  );

  assert.doesNotThrow(() =>
    validateIntegrationCommand({
      ...VALID_COMMAND,
      subjectRef: undefined,
      targetRef: { kind: 'ExternalContact', ref: 'ext_001' },
    }),
  );
});

test('rejects provider-specific top-level contract leakage', () => {
  assert.throws(
    () => validateIntegrationCommand({ ...VALID_COMMAND, providerKind: 'vendor-a' }),
    /providerKind is not part of the canonical contract/,
  );

  assert.throws(
    () => validateIntegrationEvent({ ...VALID_EVENT, rawProviderPayload: { ok: true } }),
    /rawProviderPayload is not part of the canonical contract/,
  );
});

test('rejects secret-like material recursively from canonical payloads', () => {
  assert.throws(
    () =>
      validateIntegrationCommand({
        ...VALID_COMMAND,
        payload: {
          displayName: 'Eduardo',
          nested: { accessToken: 'must-never-persist-here' },
        },
      }),
    /secret-like material/,
  );

  assert.throws(
    () =>
      validateIntegrationEvent({
        ...VALID_EVENT,
        payload: {
          credentials: { username: 'x' },
        },
      }),
    /secret-like material/,
  );
});

test('rejects provider transport mechanics from canonical payloads', () => {
  assert.throws(
    () =>
      validateIntegrationCommand({
        ...VALID_COMMAND,
        payload: {
          externalContactRef: 'contact_44',
          httpHeaders: { 'x-provider-version': 'v1' },
        },
      }),
    /provider transport mechanics/,
  );

  assert.throws(
    () =>
      validateIntegrationCommand({
        ...VALID_COMMAND,
        payload: {
          providerEndpoint: '/vendor/v7/contacts',
        },
      }),
    /provider transport mechanics/,
  );
});

test('operation identity is stable and business-scoped', () => {
  const first = integrationOperationIdentity('golden-business', 'appointment:apt_001:sync');
  const replay = integrationOperationIdentity('golden-business', 'appointment:apt_001:sync');
  const otherBusiness = integrationOperationIdentity('other-business', 'appointment:apt_001:sync');

  assert.equal(first, replay);
  assert.notEqual(first, otherBusiness);
});

test('provider event identity is stable across replay and scoped by connection/business', () => {
  const first = integrationProviderEventIdentity('golden-business', 'conn_crm_primary', 'evt-991');
  const replay = integrationProviderEventIdentity('golden-business', 'conn_crm_primary', 'evt-991');
  const otherConnection = integrationProviderEventIdentity('golden-business', 'conn_crm_secondary', 'evt-991');
  const otherBusiness = integrationProviderEventIdentity('other-business', 'conn_crm_primary', 'evt-991');

  assert.equal(first, replay);
  assert.notEqual(first, otherConnection);
  assert.notEqual(first, otherBusiness);
});

test('rejects malformed business scope and provider event identity', () => {
  assert.throws(
    () => validateIntegrationCommand({ ...VALID_COMMAND, businessSlug: 'Golden Business' }),
    /businessSlug must be lowercase/,
  );

  assert.throws(
    () => validateIntegrationEvent({ ...VALID_EVENT, providerEventIdentity: '' }),
    /providerEventIdentity must not be empty/,
  );
});
