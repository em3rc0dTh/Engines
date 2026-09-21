import { createHash } from 'node:crypto';
import { canonicalJson } from '../../contracts/register-new-customer/index.js';
import type { CanonicalCTAEvent } from './types.js';

export type CTAIngressStatus =
  | 'NORMALIZED'
  | 'DISPATCHED'
  | 'PROCESSING'
  | 'COMPLETED'
  | 'REJECTED'
  | 'FAILED';

export type CTAIngressRecord = Readonly<{
  eventId: string;
  provider: string;
  channel: string;
  businessSlug: string;
  providerEventId: string;
  externalUserId: string;
  externalConversationId: string;
  action: string;
  status: CTAIngressStatus;
  workflowId?: string;
  caseId?: string;
  appointmentId?: string;
  correlationId: string;
  duplicateCount: number;
  errorCode?: string;
}>;

export type CTAIngressClaim =
  | Readonly<{ kind: 'CLAIMED'; record: CTAIngressRecord }>
  | Readonly<{ kind: 'DUPLICATE'; record: CTAIngressRecord }>;

export interface CTAIngressRepository {
  claim(event: CanonicalCTAEvent): Promise<CTAIngressClaim>;
  transition(eventId: string, status: CTAIngressStatus, patch?: Readonly<{
    workflowId?: string;
    caseId?: string;
    appointmentId?: string;
    errorCode?: string;
  }>): Promise<CTAIngressRecord>;
}

export function ctaEventMaterialHash(event: CanonicalCTAEvent): string {
  const material = {
    version: event.version,
    provider: event.provider,
    channel: event.channel,
    businessSlug: event.businessSlug,
    providerEventId: event.providerEventId,
    externalUserId: event.externalUserId,
    externalConversationId: event.externalConversationId,
    action: event.action,
    eventType: event.eventType,
    payload: event.payload,
  };
  return createHash('sha256').update(canonicalJson(material), 'utf8').digest('hex');
}
