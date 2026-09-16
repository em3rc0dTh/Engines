import type {
  CanonicalReference,
  CorrelationContext,
  IntegrationCommand,
  IntegrationEvent,
  JsonObject,
  JsonValue,
} from './types.js';

const COMMAND_KEYS = new Set([
  'schemaVersion',
  'commandId',
  'operationId',
  'businessSlug',
  'connectionRef',
  'capability',
  'action',
  'subjectRef',
  'targetRef',
  'payload',
  'requestedAt',
  'correlation',
]);

const EVENT_KEYS = new Set([
  'schemaVersion',
  'eventId',
  'providerEventIdentity',
  'businessSlug',
  'connectionRef',
  'capability',
  'eventType',
  'payload',
  'occurredAt',
  'receivedAt',
  'correlation',
]);

const SECRET_KEYS = new Set([
  'token',
  'accesstoken',
  'refreshtoken',
  'apikey',
  'password',
  'secret',
  'clientsecret',
  'webhooksecret',
  'authorization',
  'privatekey',
  'bearertoken',
  'credential',
  'credentials',
]);

const PROVIDER_MECHANIC_KEYS = new Set([
  'providerendpoint',
  'providerroute',
  'sdkmethod',
  'httpmethod',
  'httpheaders',
]);

function fail(message: string): never {
  throw new Error(`Integration contract invalid: ${message}`);
}

function asRecord(value: unknown, path: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    fail(`${path} must be an object`);
  }
  return value as Record<string, unknown>;
}

function assertExactKeys(value: Record<string, unknown>, allowed: Set<string>, path: string): void {
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) fail(`${path}.${key} is not part of the canonical contract`);
  }
}

function assertString(value: unknown, path: string, maxLength = 256): asserts value is string {
  if (typeof value !== 'string') fail(`${path} must be a string`);
  const trimmed = value.trim();
  if (trimmed.length === 0) fail(`${path} must not be empty`);
  if (trimmed.length > maxLength) fail(`${path} exceeds ${maxLength} characters`);
}

function assertBusinessSlug(value: unknown): asserts value is string {
  assertString(value, 'businessSlug', 63);
  if (!/^[a-z0-9][a-z0-9-]*$/.test(value)) {
    fail('businessSlug must be lowercase alphanumeric with optional hyphens');
  }
}

function assertInstant(value: unknown, path: string): asserts value is string {
  assertString(value, path, 64);
  const epoch = Date.parse(value);
  if (!Number.isFinite(epoch)) fail(`${path} must be an ISO/RFC3339 timestamp`);
}

function normalizeKey(key: string): string {
  return key.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function assertSafeJson(value: unknown, path: string, depth = 0): asserts value is JsonValue {
  if (depth > 10) fail(`${path} exceeds maximum JSON depth`);

  if (value === null || typeof value === 'string' || typeof value === 'boolean') return;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) fail(`${path} must contain only finite numbers`);
    return;
  }
  if (Array.isArray(value)) {
    if (value.length > 500) fail(`${path} exceeds maximum array length`);
    value.forEach((entry, index) => assertSafeJson(entry, `${path}[${index}]`, depth + 1));
    return;
  }
  if (typeof value !== 'object') fail(`${path} contains a non-JSON value`);

  const record = value as Record<string, unknown>;
  const keys = Object.keys(record);
  if (keys.length > 200) fail(`${path} exceeds maximum object key count`);

  for (const [key, entry] of Object.entries(record)) {
    const normalized = normalizeKey(key);
    if (SECRET_KEYS.has(normalized)) {
      fail(`${path}.${key} is secret-like material and cannot enter canonical payloads`);
    }
    if (PROVIDER_MECHANIC_KEYS.has(normalized)) {
      fail(`${path}.${key} is provider transport mechanics and cannot enter canonical payloads`);
    }
    assertSafeJson(entry, `${path}.${key}`, depth + 1);
  }
}

function assertReference(value: unknown, path: string): asserts value is CanonicalReference {
  const record = asRecord(value, path);
  assertExactKeys(record, new Set(['kind', 'ref']), path);
  assertString(record.kind, `${path}.kind`, 128);
  assertString(record.ref, `${path}.ref`, 512);
}

function assertCorrelation(value: unknown, path: string): asserts value is CorrelationContext {
  const record = asRecord(value, path);
  assertExactKeys(record, new Set(['correlationId', 'causationId']), path);
  assertString(record.correlationId, `${path}.correlationId`, 256);
  if (record.causationId !== undefined) assertString(record.causationId, `${path}.causationId`, 256);
}

function assertPayload(value: unknown): asserts value is JsonObject {
  const record = asRecord(value, 'payload');
  assertSafeJson(record, 'payload');
}

export function validateIntegrationCommand(value: unknown): IntegrationCommand {
  const record = asRecord(value, 'command');
  assertExactKeys(record, COMMAND_KEYS, 'command');

  if (record.schemaVersion !== 1) fail('command.schemaVersion must be 1');
  assertString(record.commandId, 'command.commandId', 256);
  assertString(record.operationId, 'command.operationId', 256);
  assertBusinessSlug(record.businessSlug);
  assertString(record.connectionRef, 'command.connectionRef', 256);
  assertString(record.capability, 'command.capability', 128);
  assertString(record.action, 'command.action', 128);
  assertInstant(record.requestedAt, 'command.requestedAt');
  assertPayload(record.payload);

  const hasSubject = record.subjectRef !== undefined;
  const hasTarget = record.targetRef !== undefined;
  if (hasSubject === hasTarget) {
    fail('command must contain exactly one of subjectRef or targetRef');
  }
  if (record.subjectRef !== undefined) assertReference(record.subjectRef, 'command.subjectRef');
  if (record.targetRef !== undefined) assertReference(record.targetRef, 'command.targetRef');
  if (record.correlation !== undefined) assertCorrelation(record.correlation, 'command.correlation');

  return record as unknown as IntegrationCommand;
}

export function validateIntegrationEvent(value: unknown): IntegrationEvent {
  const record = asRecord(value, 'event');
  assertExactKeys(record, EVENT_KEYS, 'event');

  if (record.schemaVersion !== 1) fail('event.schemaVersion must be 1');
  assertString(record.eventId, 'event.eventId', 256);
  assertString(record.providerEventIdentity, 'event.providerEventIdentity', 512);
  assertBusinessSlug(record.businessSlug);
  assertString(record.connectionRef, 'event.connectionRef', 256);
  assertString(record.capability, 'event.capability', 128);
  assertString(record.eventType, 'event.eventType', 128);
  assertPayload(record.payload);
  if (record.occurredAt !== undefined) assertInstant(record.occurredAt, 'event.occurredAt');
  assertInstant(record.receivedAt, 'event.receivedAt');
  if (record.correlation !== undefined) assertCorrelation(record.correlation, 'event.correlation');

  return record as unknown as IntegrationEvent;
}

function encodePart(value: string): string {
  return encodeURIComponent(value);
}

export function integrationOperationIdentity(businessSlug: string, operationId: string): string {
  assertBusinessSlug(businessSlug);
  assertString(operationId, 'operationId', 256);
  return `integration-operation:${encodePart(businessSlug)}:${encodePart(operationId)}`;
}

export function integrationProviderEventIdentity(
  businessSlug: string,
  connectionRef: string,
  providerEventIdentity: string,
): string {
  assertBusinessSlug(businessSlug);
  assertString(connectionRef, 'connectionRef', 256);
  assertString(providerEventIdentity, 'providerEventIdentity', 512);
  return `integration-event:${encodePart(businessSlug)}:${encodePart(connectionRef)}:${encodePart(providerEventIdentity)}`;
}
