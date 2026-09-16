import { createHash } from 'node:crypto';
import {
  validateIntegrationEvent,
  type CorrelationContext,
  type IntegrationErrorCode,
  type IntegrationEvent,
  type JsonObject,
} from '../contracts/integration-engine/index.js';

/**
 * Transient transport envelope presented to Integration Engine.
 *
 * Headers and rawBody exist only long enough for a provider verifier to
 * authenticate and normalize the request. They MUST NOT be persisted in the
 * canonical inbound-event ledger.
 */
export type IntegrationWebhookRequest = Readonly<{
  businessSlug: string;
  connectionRef: string;
  headers: Readonly<Record<string, string | undefined>>;
  rawBody: string;
  receivedAt: string;
}>;

/** Provider-normalized material after authentication/verification succeeds. */
export type VerifiedProviderWebhook = Readonly<{
  providerEventIdentity: string;
  capability: string;
  eventType: string;
  payload: JsonObject;
  occurredAt?: string;
  correlation?: CorrelationContext;
}>;

/**
 * Provider verification is deliberately injected at I3. A concrete provider
 * adapter/secret resolver is an I4 concern; I3 only requires that no canonical
 * event can be accepted before this verifier succeeds.
 */
export interface IntegrationWebhookVerifier {
  verify(request: IntegrationWebhookRequest): Promise<VerifiedProviderWebhook>;
}

export interface IntegrationInboundConnectionResolver {
  resolveConnection(businessSlug: string, connectionRef: string, capability: string): Promise<unknown>;
}

export type IntegrationInboundAcceptance = Readonly<{
  event: IntegrationEvent;
  replayed: boolean;
}>;

export interface IntegrationInboundEventLedger {
  accept(event: IntegrationEvent): Promise<IntegrationInboundAcceptance>;
}

export class IntegrationInboundError extends Error {
  constructor(readonly code: IntegrationErrorCode, message: string = code) {
    super(message);
    this.name = 'IntegrationInboundError';
  }
}

function canonicalEventId(
  businessSlug: string,
  connectionRef: string,
  providerEventIdentity: string,
): string {
  const digest = createHash('sha256')
    .update(businessSlug)
    .update('\u0000')
    .update(connectionRef)
    .update('\u0000')
    .update(providerEventIdentity)
    .digest('hex');
  return `integration-event:${digest}`;
}

/**
 * Accept one external webhook into the provider-neutral Integration boundary.
 *
 * Ordering is intentional and security-relevant:
 *   1. provider authentication / verification (transient transport material)
 *   2. business-scoped connection + capability resolution
 *   3. canonical IntegrationEvent validation
 *   4. durable idempotent acceptance / replay protection
 */
export async function acceptIntegrationWebhook(input: Readonly<{
  request: IntegrationWebhookRequest;
  verifier: IntegrationWebhookVerifier;
  connections: IntegrationInboundConnectionResolver;
  ledger: IntegrationInboundEventLedger;
}>): Promise<IntegrationInboundAcceptance> {
  let verified: VerifiedProviderWebhook;
  try {
    verified = await input.verifier.verify(input.request);
  } catch (error) {
    if (error instanceof IntegrationInboundError && error.code === 'AUTHENTICATION_FAILED') {
      throw error;
    }
    throw new IntegrationInboundError(
      'AUTHENTICATION_FAILED',
      error instanceof Error ? `AUTHENTICATION_FAILED:${error.message}` : 'AUTHENTICATION_FAILED',
    );
  }

  await input.connections.resolveConnection(
    input.request.businessSlug,
    input.request.connectionRef,
    verified.capability,
  );

  const event = validateIntegrationEvent({
    schemaVersion: 1,
    eventId: canonicalEventId(
      input.request.businessSlug,
      input.request.connectionRef,
      verified.providerEventIdentity,
    ),
    providerEventIdentity: verified.providerEventIdentity,
    businessSlug: input.request.businessSlug,
    connectionRef: input.request.connectionRef,
    capability: verified.capability,
    eventType: verified.eventType,
    payload: verified.payload,
    ...(verified.occurredAt === undefined ? {} : { occurredAt: verified.occurredAt }),
    receivedAt: input.request.receivedAt,
    ...(verified.correlation === undefined ? {} : { correlation: verified.correlation }),
  });

  return input.ledger.accept(event);
}
