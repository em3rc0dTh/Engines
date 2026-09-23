CREATE TABLE IF NOT EXISTS agent_runtime_turns (
  turn_seq BIGSERIAL NOT NULL UNIQUE,
  business_slug TEXT NOT NULL,
  channel TEXT NOT NULL,
  external_conversation_id TEXT NOT NULL,
  external_message_id TEXT NOT NULL,
  external_sender_id TEXT NOT NULL,
  material_hash TEXT NOT NULL,
  user_text TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PROCESSING',
  route TEXT,
  model_invoked BOOLEAN,
  context_turn_count INTEGER NOT NULL DEFAULT 0,
  agent_reply TEXT,
  interpretation_json JSONB,
  response_json JSONB,
  engine_phase_before TEXT,
  engine_phase_after TEXT,
  error_code TEXT,
  attempt_count INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (business_slug, channel, external_message_id),
  CONSTRAINT agent_runtime_turn_status_chk
    CHECK (status IN ('PROCESSING', 'APPLIED', 'FAILED')),
  CONSTRAINT agent_runtime_turn_route_chk
    CHECK (route IS NULL OR route IN ('MODEL', 'DETERMINISTIC_BYPASS', 'SAFE_FALLBACK')),
  CONSTRAINT agent_runtime_context_turn_count_chk
    CHECK (context_turn_count >= 0),
  CONSTRAINT agent_runtime_attempt_count_chk
    CHECK (attempt_count >= 1)
);

CREATE INDEX IF NOT EXISTS agent_runtime_turns_conversation_idx
  ON agent_runtime_turns (
    business_slug,
    channel,
    external_conversation_id,
    turn_seq DESC
  );

CREATE INDEX IF NOT EXISTS agent_runtime_turns_status_idx
  ON agent_runtime_turns (status, updated_at);
