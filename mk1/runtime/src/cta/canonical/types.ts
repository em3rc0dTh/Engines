export const CANONICAL_CTA_VERSION = 'cta.v1' as const;

export type CTAProvider =
  | 'webchat'
  | 'telegram'
  | 'whatsapp'
  | 'api'
  | 'messenger'
  | 'facebook'
  | 'tiktok';

export type CTAChannel =
  | 'web'
  | 'telegram'
  | 'whatsapp'
  | 'api'
  | 'messenger'
  | 'facebook_comment'
  | 'tiktok';

export type CanonicalCTAAction = 'register_appointment';
export type CanonicalCTAEventType = 'button' | 'postback' | 'form' | 'comment' | 'command' | 'api_action';

/**
 * Provider-neutral ingress contract. Authentication and webhook parsing have
 * already happened when this value is produced.
 */
export type CanonicalCTAEvent = Readonly<{
  version: typeof CANONICAL_CTA_VERSION;
  eventId: string;
  provider: CTAProvider;
  channel: CTAChannel;
  businessSlug: string;
  providerEventId: string;
  externalUserId: string;
  externalConversationId: string;
  action: CanonicalCTAAction;
  eventType: CanonicalCTAEventType;
  idempotencyKey: string;
  correlationId: string;
  receivedAt: string;
  payload: Readonly<Record<string, unknown>>;
}>;

export type CTARoute =
  | Readonly<{ kind: 'WORKFLOW'; workflowType: 'RegisterNewAppointment'; event: CanonicalCTAEvent }>
  | Readonly<{ kind: 'UNSUPPORTED'; reason: string }>;
