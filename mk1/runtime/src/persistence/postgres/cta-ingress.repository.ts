import type { Pool } from 'pg';
import { ctaEventMaterialHash, type CTAIngressClaim, type CTAIngressRecord, type CTAIngressRepository, type CTAIngressStatus } from '../../cta/canonical/ingress.js';
import type { CanonicalCTAEvent } from '../../cta/canonical/types.js';

type Row = Readonly<{
  event_id: string; provider: string; channel: string; business_slug: string; provider_event_id: string;
  external_user_id: string; external_conversation_id: string; action: string; status: CTAIngressStatus;
  workflow_id: string | null; case_id: string | null; appointment_id: string | null; correlation_id: string;
  duplicate_count: number; material_hash: string; error_code: string | null;
}>;

const COLUMNS = `event_id, provider, channel, business_slug, provider_event_id, external_user_id,
  external_conversation_id, action, status, workflow_id, case_id, appointment_id, correlation_id,
  duplicate_count, material_hash, error_code`;

function fromRow(row: Row): CTAIngressRecord {
  return {
    eventId: row.event_id, provider: row.provider, channel: row.channel, businessSlug: row.business_slug,
    providerEventId: row.provider_event_id, externalUserId: row.external_user_id,
    externalConversationId: row.external_conversation_id, action: row.action, status: row.status,
    correlationId: row.correlation_id, duplicateCount: row.duplicate_count,
    ...(row.workflow_id ? { workflowId: row.workflow_id } : {}),
    ...(row.case_id ? { caseId: row.case_id } : {}),
    ...(row.appointment_id ? { appointmentId: row.appointment_id } : {}),
    ...(row.error_code ? { errorCode: row.error_code } : {}),
  };
}

export class CTAIngressIdentityConflictError extends Error {
  readonly code = 'CTA_INGRESS_IDENTITY_CONFLICT' as const;
  constructor(eventId: string) { super(`CTA event ${eventId} has different canonical material`); }
}

export class PostgresCTAIngressRepository implements CTAIngressRepository {
  constructor(private readonly pool: Pool) {}

  async claim(event: CanonicalCTAEvent): Promise<CTAIngressClaim> {
    const hash = ctaEventMaterialHash(event);
    const inserted = await this.pool.query<Row>(
      `INSERT INTO cta_ingress_records (
         event_id, provider, channel, business_slug, provider_event_id, external_user_id,
         external_conversation_id, action, received_at, status, correlation_id, material_hash
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::timestamptz,'NORMALIZED',$10,$11)
       ON CONFLICT (event_id) DO NOTHING RETURNING ${COLUMNS}`,
      [event.eventId, event.provider, event.channel, event.businessSlug, event.providerEventId,
        event.externalUserId, event.externalConversationId, event.action, event.receivedAt,
        event.correlationId, hash],
    );
    if (inserted.rows[0]) return { kind: 'CLAIMED', record: fromRow(inserted.rows[0]) };
    const existing = await this.pool.query<Row>(
      `UPDATE cta_ingress_records SET duplicate_count = duplicate_count + 1,
         last_duplicate_at = NOW(), updated_at = NOW() WHERE event_id = $1 RETURNING ${COLUMNS}`,
      [event.eventId],
    );
    const row = existing.rows[0];
    if (!row) throw new Error('CTA_INGRESS_CLAIM_LOST');
    if (row.material_hash !== hash) throw new CTAIngressIdentityConflictError(event.eventId);
    return { kind: 'DUPLICATE', record: fromRow(row) };
  }

  async transition(eventId: string, status: CTAIngressStatus, patch: Readonly<{
    workflowId?: string; caseId?: string; appointmentId?: string; errorCode?: string;
  }> = {}): Promise<CTAIngressRecord> {
    const result = await this.pool.query<Row>(
      `UPDATE cta_ingress_records SET status=$2, workflow_id=COALESCE($3,workflow_id),
       case_id=COALESCE($4,case_id), appointment_id=COALESCE($5,appointment_id),
       error_code=$6, updated_at=NOW() WHERE event_id=$1 RETURNING ${COLUMNS}`,
      [eventId, status, patch.workflowId ?? null, patch.caseId ?? null, patch.appointmentId ?? null, patch.errorCode ?? null],
    );
    const row = result.rows[0];
    if (!row) throw new Error(`CTA_INGRESS_NOT_FOUND:${eventId}`);
    return fromRow(row);
  }

  async completeConversation(input: Readonly<{
    businessSlug: string; correlationId: string; workflowId: string; caseId: string; appointmentId: string;
  }>): Promise<CTAIngressRecord | undefined> {
    const result = await this.pool.query<Row>(
      `UPDATE cta_ingress_records SET status='COMPLETED',case_id=$4,
       appointment_id=$5,error_code=NULL,updated_at=NOW()
       WHERE event_id=(SELECT event_id FROM cta_ingress_records
         WHERE business_slug=$1 AND correlation_id=$2 AND action='register_appointment' AND workflow_id=$3
         ORDER BY created_at DESC LIMIT 1)
       RETURNING ${COLUMNS}`,
      [input.businessSlug,input.correlationId,input.workflowId,input.caseId,input.appointmentId],
    );
    return result.rows[0] ? fromRow(result.rows[0]) : undefined;
  }

  async failConversation(input: Readonly<{
    businessSlug: string; correlationId: string; workflowId: string; errorCode: string;
  }>): Promise<CTAIngressRecord | undefined> {
    const result = await this.pool.query<Row>(
      `UPDATE cta_ingress_records SET status='FAILED',error_code=$4,updated_at=NOW()
       WHERE event_id=(SELECT event_id FROM cta_ingress_records
         WHERE business_slug=$1 AND correlation_id=$2 AND action='register_appointment' AND workflow_id=$3
         ORDER BY created_at DESC LIMIT 1)
       RETURNING ${COLUMNS}`,
      [input.businessSlug,input.correlationId,input.workflowId,input.errorCode],
    );
    return result.rows[0] ? fromRow(result.rows[0]) : undefined;
  }
}
