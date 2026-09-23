import { createHash } from 'node:crypto';
import type { Pool } from 'pg';

import type { AgentConversationTurn, AgentDecision } from '../../contracts/agent-layer/index.js';
import type {
  AgentRuntimeClaim,
  AgentRuntimeMessageInput,
  AgentRuntimeRoute,
  AgentRuntimeStore,
} from '../../agent/runtime/index.js';

type TurnRow = Readonly<{
  turn_seq: string | number;
  business_slug: string;
  channel: string;
  external_conversation_id: string;
  external_message_id: string;
  external_sender_id: string;
  material_hash: string;
  user_text: string;
  status: 'PROCESSING' | 'APPLIED' | 'FAILED';
  route: AgentRuntimeRoute | null;
  model_invoked: boolean | null;
  context_turn_count: number;
  agent_reply: string | null;
  interpretation_json: unknown;
  response_json: unknown;
  engine_phase_before: string | null;
  engine_phase_after: string | null;
  error_code: string | null;
  attempt_count: number;
  created_at: Date;
  updated_at: Date;
}>;

const TURN_COLUMNS = `
  turn_seq, business_slug, channel, external_conversation_id, external_message_id,
  external_sender_id, material_hash, user_text, status, route, model_invoked,
  context_turn_count, agent_reply, interpretation_json, response_json,
  engine_phase_before, engine_phase_after, error_code, attempt_count,
  created_at, updated_at
`;

function materialHash(input: AgentRuntimeMessageInput): string {
  return createHash('sha256').update(JSON.stringify({
    businessSlug: input.businessSlug,
    channel: input.channel,
    externalConversationId: input.externalConversationId,
    externalMessageId: input.externalMessageId,
    externalSenderId: input.externalSenderId,
    text: input.text,
  })).digest('hex');
}

export class AgentRuntimeTurnIdentityConflictError extends Error {
  readonly code = 'AGENT_RUNTIME_TURN_IDENTITY_CONFLICT';

  constructor(readonly externalMessageId: string) {
    super('AGENT_RUNTIME_TURN_IDENTITY_CONFLICT:' + externalMessageId);
    this.name = 'AgentRuntimeTurnIdentityConflictError';
  }
}

export class AgentRuntimeTurnInProgressError extends Error {
  readonly code = 'AGENT_RUNTIME_TURN_IN_PROGRESS';

  constructor(readonly externalMessageId: string) {
    super('AGENT_RUNTIME_TURN_IN_PROGRESS:' + externalMessageId);
    this.name = 'AgentRuntimeTurnInProgressError';
  }
}

export class PostgresAgentRuntimeRepository implements AgentRuntimeStore {
  constructor(
    private readonly pool: Pool,
    private readonly staleProcessingSeconds = 120,
  ) {
    if (!Number.isInteger(staleProcessingSeconds) || staleProcessingSeconds < 1) {
      throw new Error('AGENT_RUNTIME_STALE_WINDOW_INVALID');
    }
  }

  async claim(input: AgentRuntimeMessageInput): Promise<AgentRuntimeClaim> {
    const hash = materialHash(input);
    const inserted = await this.pool.query<TurnRow>(
      `INSERT INTO agent_runtime_turns
        (business_slug, channel, external_conversation_id, external_message_id,
         external_sender_id, material_hash, user_text, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'PROCESSING')
       ON CONFLICT (business_slug, channel, external_message_id) DO NOTHING
       RETURNING ${TURN_COLUMNS}`,
      [
        input.businessSlug,
        input.channel,
        input.externalConversationId,
        input.externalMessageId,
        input.externalSenderId,
        hash,
        input.text,
      ],
    );

    if (inserted.rows[0]) return { kind: 'NEW' };

    const existingResult = await this.pool.query<TurnRow>(
      `SELECT ${TURN_COLUMNS}
       FROM agent_runtime_turns
       WHERE business_slug = $1 AND channel = $2 AND external_message_id = $3`,
      [input.businessSlug, input.channel, input.externalMessageId],
    );
    const existing = existingResult.rows[0];
    if (!existing) throw new Error('AGENT_RUNTIME_CLAIM_LOST');
    if (
      existing.material_hash !== hash
      || existing.external_conversation_id !== input.externalConversationId
      || existing.external_sender_id !== input.externalSenderId
    ) {
      throw new AgentRuntimeTurnIdentityConflictError(input.externalMessageId);
    }

    if (existing.status === 'APPLIED') {
      if (!existing.route || existing.model_invoked === null || !existing.agent_reply || existing.response_json == null) {
        throw new Error('AGENT_RUNTIME_APPLIED_RECEIPT_INCOMPLETE');
      }
      return {
        kind: 'REPLAY_APPLIED',
        response: existing.response_json,
        reply: existing.agent_reply,
        route: existing.route,
        modelInvoked: existing.model_invoked,
        contextTurnCount: existing.context_turn_count,
        ...(existing.engine_phase_before ? { enginePhaseBefore: existing.engine_phase_before } : {}),
        ...(existing.engine_phase_after ? { enginePhaseAfter: existing.engine_phase_after } : {}),
      };
    }

    if (existing.status === 'FAILED') {
      return {
        kind: 'REPLAY_FAILED',
        errorCode: existing.error_code ?? 'AGENT_RUNTIME_FAILED',
      };
    }

    const reclaimed = await this.pool.query<TurnRow>(
      `UPDATE agent_runtime_turns
       SET attempt_count = attempt_count + 1,
           updated_at = NOW(),
           error_code = NULL
       WHERE business_slug = $1
         AND channel = $2
         AND external_message_id = $3
         AND material_hash = $4
         AND status = 'PROCESSING'
         AND updated_at < NOW() - ($5::text || ' seconds')::interval
       RETURNING ${TURN_COLUMNS}`,
      [
        input.businessSlug,
        input.channel,
        input.externalMessageId,
        hash,
        String(this.staleProcessingSeconds),
      ],
    );
    if (reclaimed.rows[0]) return { kind: 'NEW' };

    throw new AgentRuntimeTurnInProgressError(input.externalMessageId);
  }

  async recentTurns(input: Readonly<{
    businessSlug: string;
    channel: string;
    externalConversationId: string;
    excludeExternalMessageId?: string;
    maxConversationTurns?: number;
  }>): Promise<readonly AgentConversationTurn[]> {
    const maxTurns = Math.min(8, Math.max(0, input.maxConversationTurns ?? 8));
    const messageLimit = Math.ceil(maxTurns / 2);
    if (messageLimit === 0) return [];

    const result = await this.pool.query<TurnRow>(
      `SELECT *
       FROM (
         SELECT ${TURN_COLUMNS}
         FROM agent_runtime_turns
         WHERE business_slug = $1
           AND channel = $2
           AND external_conversation_id = $3
           AND status = 'APPLIED'
           AND ($4::text IS NULL OR external_message_id <> $4)
         ORDER BY turn_seq DESC
         LIMIT $5
       ) recent
       ORDER BY turn_seq ASC`,
      [
        input.businessSlug,
        input.channel,
        input.externalConversationId,
        input.excludeExternalMessageId ?? null,
        messageLimit,
      ],
    );

    const turns: AgentConversationTurn[] = [];
    for (const row of result.rows) {
      turns.push({ role: 'USER', text: row.user_text });
      if (row.agent_reply) turns.push({ role: 'AGENT', text: row.agent_reply });
    }
    return turns.slice(-maxTurns);
  }

  async complete(input: Readonly<{
    message: AgentRuntimeMessageInput;
    response: unknown;
    reply: string;
    route: AgentRuntimeRoute;
    modelInvoked: boolean;
    contextTurnCount: number;
    interpretation?: AgentDecision;
    enginePhaseBefore?: string;
    enginePhaseAfter?: string;
  }>): Promise<void> {
    const result = await this.pool.query(
      `UPDATE agent_runtime_turns
       SET status = 'APPLIED',
           route = $4,
           model_invoked = $5,
           context_turn_count = $6,
           agent_reply = $7,
           interpretation_json = $8::jsonb,
           response_json = $9::jsonb,
           engine_phase_before = $10,
           engine_phase_after = $11,
           error_code = NULL,
           updated_at = NOW()
       WHERE business_slug = $1
         AND channel = $2
         AND external_message_id = $3
         AND status = 'PROCESSING'`,
      [
        input.message.businessSlug,
        input.message.channel,
        input.message.externalMessageId,
        input.route,
        input.modelInvoked,
        input.contextTurnCount,
        input.reply,
        input.interpretation ? JSON.stringify(input.interpretation) : null,
        JSON.stringify(input.response),
        input.enginePhaseBefore ?? null,
        input.enginePhaseAfter ?? null,
      ],
    );
    if (result.rowCount !== 1) throw new Error('AGENT_RUNTIME_COMPLETE_LOST');
  }

  async fail(input: Readonly<{
    message: AgentRuntimeMessageInput;
    errorCode: string;
  }>): Promise<void> {
    await this.pool.query(
      `UPDATE agent_runtime_turns
       SET status = 'FAILED',
           error_code = $4,
           updated_at = NOW()
       WHERE business_slug = $1
         AND channel = $2
         AND external_message_id = $3
         AND status = 'PROCESSING'`,
      [
        input.message.businessSlug,
        input.message.channel,
        input.message.externalMessageId,
        input.errorCode,
      ],
    );
  }
}
