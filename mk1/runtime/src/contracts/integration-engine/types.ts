export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonObject | readonly JsonValue[];
export type JsonObject = Readonly<Record<string, JsonValue>>;

export type IntegrationErrorCode =
  | 'INVALID_COMMAND'
  | 'CONNECTION_NOT_FOUND'
  | 'CONNECTION_DISABLED'
  | 'CAPABILITY_NOT_SUPPORTED'
  | 'AUTHENTICATION_FAILED'
  | 'RATE_LIMITED'
  | 'TRANSIENT_PROVIDER_FAILURE'
  | 'PERMANENT_PROVIDER_FAILURE'
  | 'PROVIDER_REJECTED'
  | 'TIMEOUT'
  | 'IDEMPOTENCY_CONFLICT'
  | 'INVALID_PROVIDER_EVENT'
  | 'DUPLICATE_PROVIDER_EVENT';

export type CanonicalReference = Readonly<{
  kind: string;
  ref: string;
}>;

export type CorrelationContext = Readonly<{
  correlationId: string;
  causationId?: string;
}>;

/**
 * Provider-neutral request for an external effect.
 *
 * Provider routes, SDK methods, auth headers and secret material are expressly
 * outside this contract. `connectionRef` identifies configured external
 * connectivity; it is not a credential.
 */
export type IntegrationCommand = Readonly<{
  schemaVersion: 1;
  commandId: string;
  operationId: string;
  businessSlug: string;
  connectionRef: string;
  capability: string;
  action: string;
  subjectRef?: CanonicalReference;
  targetRef?: CanonicalReference;
  payload: JsonObject;
  requestedAt: string;
  correlation?: CorrelationContext;
}>;

/**
 * Provider-neutral fact emitted only after provider authentication,
 * normalization and replay protection at the Integration boundary.
 */
export type IntegrationEvent = Readonly<{
  schemaVersion: 1;
  eventId: string;
  providerEventIdentity: string;
  businessSlug: string;
  connectionRef: string;
  capability: string;
  eventType: string;
  payload: JsonObject;
  occurredAt?: string;
  receivedAt: string;
  correlation?: CorrelationContext;
}>;

export type IntegrationOperationIdentity = Readonly<{
  businessSlug: string;
  operationId: string;
}>;

export type IntegrationProviderEventIdentity = Readonly<{
  businessSlug: string;
  connectionRef: string;
  providerEventIdentity: string;
}>;
