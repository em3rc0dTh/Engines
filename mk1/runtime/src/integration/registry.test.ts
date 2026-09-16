import assert from 'node:assert/strict';
import test from 'node:test';
import {
  validateIntegrationConnection,
  validateIntegrationProviderDefinition,
  validateIntegrationSecretReference,
  type IntegrationConnection,
} from './registry.js';

const NOW = '2026-09-16T20:00:00.000Z';

test('provider definition requires unique capabilities and a positive revision', () => {
  assert.deepEqual(validateIntegrationProviderDefinition({
    providerKind: 'calendar-provider',
    displayName: 'Calendar Provider',
    status: 'ENABLED',
    capabilities: ['calendar.create_event', 'calendar.cancel_event'],
    revision: 1,
  }), []);

  assert.ok(validateIntegrationProviderDefinition({
    providerKind: 'calendar-provider',
    displayName: 'Calendar Provider',
    status: 'ENABLED',
    capabilities: ['calendar.create_event', 'calendar.create_event'],
    revision: 0,
  }).length >= 2);
});

test('secret reference models locators only and validates ENV bindings', () => {
  assert.deepEqual(validateIntegrationSecretReference({
    secretRef: 'auth-primary',
    purpose: 'provider-auth',
    bindingKind: 'ENV',
    bindingRef: 'CALENDAR_PRIMARY_TOKEN',
  }), []);

  assert.ok(validateIntegrationSecretReference({
    secretRef: 'auth-primary',
    purpose: 'provider-auth',
    bindingKind: 'ENV',
    bindingRef: 'literal secret value',
  }).some((issue) => issue.code === 'INVALID_ENV_BINDING'));
});

test('connection registry is business scoped and rejects duplicate secret purposes', () => {
  const connection: IntegrationConnection = {
    connectionRef: 'calendar-primary',
    businessSlug: 'golden-business',
    providerKind: 'calendar-provider',
    externalAccountRef: 'acct-001',
    status: 'ENABLED',
    capabilities: ['calendar.create_event'],
    secretRefs: [
      {
        secretRef: 'auth-a',
        purpose: 'provider-auth',
        bindingKind: 'ENV',
        bindingRef: 'CALENDAR_PRIMARY_TOKEN',
      },
      {
        secretRef: 'auth-b',
        purpose: 'provider-auth',
        bindingKind: 'EXTERNAL_SECRET_STORE',
        bindingRef: 'vault://calendar/secondary',
      },
    ],
    revision: 1,
    createdAt: NOW,
    updatedAt: NOW,
  };

  const issues = validateIntegrationConnection(connection);
  assert.ok(issues.some((issue) => issue.path === 'secretRefs.purpose' && issue.code === 'DUPLICATE'));
});
