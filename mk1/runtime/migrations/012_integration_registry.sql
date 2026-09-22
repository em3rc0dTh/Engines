CREATE TABLE IF NOT EXISTS integration_providers (
  provider_kind TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('ENABLED', 'DISABLED')),
  capabilities TEXT[] NOT NULL CHECK (cardinality(capabilities) > 0),
  revision INTEGER NOT NULL CHECK (revision >= 1),
  material_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS integration_connections (
  business_slug TEXT NOT NULL,
  connection_ref TEXT NOT NULL,
  provider_kind TEXT NOT NULL REFERENCES integration_providers(provider_kind),
  external_account_ref TEXT,
  status TEXT NOT NULL CHECK (status IN ('ENABLED', 'DISABLED')),
  capabilities TEXT[] NOT NULL CHECK (cardinality(capabilities) > 0),
  revision INTEGER NOT NULL CHECK (revision >= 1),
  material_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (business_slug, connection_ref)
);

CREATE INDEX IF NOT EXISTS integration_connections_provider_idx
  ON integration_connections (provider_kind, business_slug);

CREATE TABLE IF NOT EXISTS integration_secret_references (
  business_slug TEXT NOT NULL,
  connection_ref TEXT NOT NULL,
  secret_ref TEXT NOT NULL,
  purpose TEXT NOT NULL,
  binding_kind TEXT NOT NULL CHECK (binding_kind IN ('ENV', 'EXTERNAL_SECRET_STORE')),
  binding_ref TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (business_slug, connection_ref, secret_ref),
  UNIQUE (business_slug, connection_ref, purpose),
  FOREIGN KEY (business_slug, connection_ref)
    REFERENCES integration_connections (business_slug, connection_ref)
    ON DELETE CASCADE
);

COMMENT ON TABLE integration_secret_references IS
  'Secret references only. This registry MUST NOT persist secret values, access tokens, API keys, passwords, or credentials.';
