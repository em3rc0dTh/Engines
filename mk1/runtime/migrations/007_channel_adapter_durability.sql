CREATE TABLE IF NOT EXISTS channel_conversation_bindings (
  business_slug TEXT NOT NULL,
  channel TEXT NOT NULL,
  external_conversation_id TEXT NOT NULL,
  workflow_id TEXT NOT NULL,
  operation TEXT NOT NULL,
  binding_status TEXT NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (business_slug, channel, external_conversation_id),
  UNIQUE (business_slug, channel, workflow_id),
  CONSTRAINT channel_binding_status_chk CHECK (binding_status IN ('ACTIVE', 'COMPLETED', 'FAILED'))
);

CREATE TABLE IF NOT EXISTS channel_inbound_events (
  business_slug TEXT NOT NULL,
  channel TEXT NOT NULL,
  external_message_id TEXT NOT NULL,
  external_conversation_id TEXT NOT NULL,
  material_hash TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PROCESSING',
  response_json JSONB,
  error_code TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (business_slug, channel, external_message_id),
  CONSTRAINT channel_event_status_chk CHECK (status IN ('PROCESSING', 'APPLIED', 'REJECTED'))
);

CREATE INDEX IF NOT EXISTS channel_inbound_events_conversation_idx
  ON channel_inbound_events (business_slug, channel, external_conversation_id, created_at);
