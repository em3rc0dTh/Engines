import { Pool } from 'pg';
import type {
  CanonicalChannelEnvelope,
  ChannelBindingStatus,
  ChannelConversationBinding,
  ChannelEventClaim,
  ChannelInboundEvent,
  ChannelKind,
} from '../../cta/channel-core/types.js';
import { channelEventMaterialHash } from '../../cta/channel-core/idempotency.js';

export class ChannelEventIdentityConflictError extends Error {
  readonly code = 'CHANNEL_EVENT_IDENTITY_CONFLICT' as const;
  constructor(readonly externalMessageId: string) {
    super(`Channel event ${externalMessageId} already exists with different canonical material`);
    this.name = 'ChannelEventIdentityConflictError';
  }
}

export class ChannelBindingConflictError extends Error {
  readonly code = 'CHANNEL_BINDING_CONFLICT' as const;
  constructor(readonly externalConversationId: string) {
    super(`Channel conversation ${externalConversationId} is already bound to different Workflow material`);
    this.name = 'ChannelBindingConflictError';
  }
}

type EventRow = Readonly<{
  business_slug: string;
  channel: ChannelKind;
  external_message_id: string;
  external_conversation_id: string;
  material_hash: string;
  status: 'PROCESSING' | 'APPLIED' | 'REJECTED';
  response_json: unknown | null;
  error_code: string | null;
  created_at: Date | string;
  updated_at: Date | string;
}>;

type BindingRow = Readonly<{
  business_slug: string;
  channel: ChannelKind;
  external_conversation_id: string;
  workflow_id: string;
  operation: string;
  binding_status: ChannelBindingStatus;
  created_at: Date | string;
  updated_at: Date | string;
}>;

function iso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function eventFromRow(row: EventRow): ChannelInboundEvent {
  return {
    businessSlug: row.business_slug,
    channel: row.channel,
    externalMessageId: row.external_message_id,
    externalConversationId: row.external_conversation_id,
    materialHash: row.material_hash,
    status: row.status,
    ...(row.response_json !== null ? { response: row.response_json } : {}),
    ...(row.error_code ? { errorCode: row.error_code } : {}),
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
  };
}

function bindingFromRow(row: BindingRow): ChannelConversationBinding {
  return {
    businessSlug: row.business_slug,
    channel: row.channel,
    externalConversationId: row.external_conversation_id,
    workflowId: row.workflow_id,
    operation: row.operation,
    bindingStatus: row.binding_status,
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
  };
}

const EVENT_COLUMNS = `business_slug, channel, external_message_id, external_conversation_id,
  material_hash, status, response_json, error_code, created_at, updated_at`;
const BINDING_COLUMNS = `business_slug, channel, external_conversation_id, workflow_id,
  operation, binding_status, created_at, updated_at`;

export class PostgresChannelRepository {
  constructor(private readonly pool: Pool) {}

  async claimInboundEvent(envelope: CanonicalChannelEnvelope): Promise<ChannelEventClaim> {
    const hash = channelEventMaterialHash(envelope);
    const inserted = await this.pool.query<EventRow>(
      `INSERT INTO channel_inbound_events
        (business_slug, channel, external_message_id, external_conversation_id, material_hash, status)
       VALUES ($1, $2, $3, $4, $5, 'PROCESSING')
       ON CONFLICT (business_slug, channel, external_message_id) DO NOTHING
       RETURNING ${EVENT_COLUMNS}`,
      [envelope.businessSlug, envelope.channel, envelope.externalMessageId, envelope.externalConversationId, hash],
    );

    const insertedRow = inserted.rows[0];
    if (insertedRow) return { kind: 'CLAIMED', event: eventFromRow(insertedRow) };

    const existing = await this.pool.query<EventRow>(
      `SELECT ${EVENT_COLUMNS}
       FROM channel_inbound_events
       WHERE business_slug = $1 AND channel = $2 AND external_message_id = $3`,
      [envelope.businessSlug, envelope.channel, envelope.externalMessageId],
    );
    const row = existing.rows[0];
    if (!row) throw new Error('CHANNEL_EVENT_CLAIM_LOST');
    if (row.material_hash !== hash) throw new ChannelEventIdentityConflictError(envelope.externalMessageId);

    const event = eventFromRow(row);
    if (row.status === 'APPLIED') return { kind: 'REPLAY_APPLIED', event, response: row.response_json };
    if (row.status === 'REJECTED') return { kind: 'REPLAY_REJECTED', event, response: row.response_json };
    return { kind: 'RESUME_PROCESSING', event };
  }

  async completeInboundEvent(
    envelope: CanonicalChannelEnvelope,
    response: unknown,
  ): Promise<ChannelInboundEvent> {
    return this.finishInboundEvent(envelope, 'APPLIED', response);
  }

  async rejectInboundEvent(
    envelope: CanonicalChannelEnvelope,
    response: unknown,
    errorCode: string,
  ): Promise<ChannelInboundEvent> {
    return this.finishInboundEvent(envelope, 'REJECTED', response, errorCode);
  }

  private async finishInboundEvent(
    envelope: CanonicalChannelEnvelope,
    status: 'APPLIED' | 'REJECTED',
    response: unknown,
    errorCode?: string,
  ): Promise<ChannelInboundEvent> {
    const hash = channelEventMaterialHash(envelope);
    const result = await this.pool.query<EventRow>(
      `UPDATE channel_inbound_events
       SET status = $6, response_json = $7::jsonb, error_code = $8, updated_at = NOW()
       WHERE business_slug = $1 AND channel = $2 AND external_message_id = $3
         AND external_conversation_id = $4 AND material_hash = $5
       RETURNING ${EVENT_COLUMNS}`,
      [
        envelope.businessSlug,
        envelope.channel,
        envelope.externalMessageId,
        envelope.externalConversationId,
        hash,
        status,
        JSON.stringify(response ?? null),
        errorCode ?? null,
      ],
    );
    const row = result.rows[0];
    if (!row) throw new ChannelEventIdentityConflictError(envelope.externalMessageId);
    return eventFromRow(row);
  }

  async getConversationBinding(input: Readonly<{
    businessSlug: string;
    channel: ChannelKind;
    externalConversationId: string;
  }>): Promise<ChannelConversationBinding | undefined> {
    const result = await this.pool.query<BindingRow>(
      `SELECT ${BINDING_COLUMNS}
       FROM channel_conversation_bindings
       WHERE business_slug = $1 AND channel = $2 AND external_conversation_id = $3`,
      [input.businessSlug, input.channel, input.externalConversationId],
    );
    const row = result.rows[0];
    return row ? bindingFromRow(row) : undefined;
  }

  async bindConversation(input: Readonly<{
    businessSlug: string;
    channel: ChannelKind;
    externalConversationId: string;
    workflowId: string;
    operation: string;
  }>): Promise<ChannelConversationBinding> {
    const inserted = await this.pool.query<BindingRow>(
      `INSERT INTO channel_conversation_bindings
        (business_slug, channel, external_conversation_id, workflow_id, operation, binding_status)
       VALUES ($1, $2, $3, $4, $5, 'ACTIVE')
       ON CONFLICT (business_slug, channel, external_conversation_id) DO NOTHING
       RETURNING ${BINDING_COLUMNS}`,
      [input.businessSlug, input.channel, input.externalConversationId, input.workflowId, input.operation],
    );
    const insertedRow = inserted.rows[0];
    if (insertedRow) return bindingFromRow(insertedRow);

    const existing = await this.getConversationBinding(input);
    if (!existing) throw new Error('CHANNEL_BINDING_INSERT_LOST');
    if (existing.workflowId !== input.workflowId || existing.operation !== input.operation) {
      throw new ChannelBindingConflictError(input.externalConversationId);
    }
    return existing;
  }

  async updateBindingStatus(input: Readonly<{
    businessSlug: string;
    channel: ChannelKind;
    externalConversationId: string;
    status: ChannelBindingStatus;
  }>): Promise<ChannelConversationBinding | undefined> {
    const result = await this.pool.query<BindingRow>(
      `UPDATE channel_conversation_bindings
       SET binding_status = $4, updated_at = NOW()
       WHERE business_slug = $1 AND channel = $2 AND external_conversation_id = $3
       RETURNING ${BINDING_COLUMNS}`,
      [input.businessSlug, input.channel, input.externalConversationId, input.status],
    );
    const row = result.rows[0];
    return row ? bindingFromRow(row) : undefined;
  }
}
