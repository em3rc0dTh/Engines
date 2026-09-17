CREATE TABLE IF NOT EXISTS integration_inbound_events (
  business_slug TEXT NOT NULL,
  connection_ref TEXT NOT NULL,
  provider_event_identity TEXT NOT NULL,
  event_id TEXT NOT NULL,
  capability TEXT NOT NULL,
  event_type TEXT NOT NULL,
  event_json JSONB NOT NULL,
  material_hash TEXT NOT NULL,
  received_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (business_slug, connection_ref, provider_event_identity),
  UNIQUE (business_slug, event_id),
  FOREIGN KEY (business_slug, connection_ref)
    REFERENCES integration_connections (business_slug, connection_ref)
);

CREATE INDEX IF NOT EXISTS integration_inbound_events_received_idx
  ON integration_inbound_events (business_slug, connection_ref, received_at DESC);

CREATE INDEX IF NOT EXISTS integration_inbound_events_type_idx
  ON integration_inbound_events (business_slug, event_type, received_at DESC);

COMMENT ON TABLE integration_inbound_events IS
  'Provider-neutral accepted inbound events. Raw webhook bodies, headers, signatures, secret values and provider transport mechanics are forbidden.';
