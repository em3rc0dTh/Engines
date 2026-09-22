CREATE TABLE IF NOT EXISTS integration_outbound_commands (
  business_slug TEXT NOT NULL,
  operation_id TEXT NOT NULL,
  command_id TEXT NOT NULL,
  connection_ref TEXT NOT NULL,
  capability TEXT NOT NULL,
  action TEXT NOT NULL,
  command_json JSONB NOT NULL,
  material_hash TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('READY','IN_FLIGHT','RETRY_WAIT','SUCCEEDED','FAILED_PERMANENT')),
  attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  max_attempts INTEGER NOT NULL CHECK (max_attempts >= 1),
  next_attempt_at TIMESTAMPTZ,
  lease_expires_at TIMESTAMPTZ,
  current_attempt_id TEXT,
  last_error_code TEXT,
  provider_receipt_ref TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (business_slug, operation_id),
  UNIQUE (business_slug, command_id),
  FOREIGN KEY (business_slug, connection_ref)
    REFERENCES integration_connections (business_slug, connection_ref)
);

CREATE INDEX IF NOT EXISTS integration_outbound_due_idx
  ON integration_outbound_commands (status, next_attempt_at, lease_expires_at, created_at);

CREATE TABLE IF NOT EXISTS integration_outbound_attempts (
  business_slug TEXT NOT NULL,
  operation_id TEXT NOT NULL,
  attempt_number INTEGER NOT NULL CHECK (attempt_number >= 1),
  attempt_id TEXT NOT NULL,
  started_at TIMESTAMPTZ NOT NULL,
  finished_at TIMESTAMPTZ,
  outcome TEXT CHECK (outcome IN ('SUCCEEDED','RETRYABLE','FAILED_PERMANENT','LEASE_EXPIRED')),
  error_code TEXT,
  provider_receipt_ref TEXT,
  next_attempt_at TIMESTAMPTZ,
  PRIMARY KEY (business_slug, operation_id, attempt_number),
  UNIQUE (attempt_id),
  FOREIGN KEY (business_slug, operation_id)
    REFERENCES integration_outbound_commands (business_slug, operation_id)
    ON DELETE CASCADE
);

COMMENT ON TABLE integration_outbound_commands IS
  'Provider-neutral durable outbound command ledger. Secret values and provider auth material are forbidden.';
COMMENT ON TABLE integration_outbound_attempts IS
  'Durable delivery-attempt history. Provider-specific raw response bodies and secret material are outside this ledger.';
