BEGIN;

CREATE TABLE IF NOT EXISTS customers (
  customer_id TEXT PRIMARY KEY,
  business_slug TEXT NOT NULL,
  customer_type TEXT,
  customer_name TEXT,
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS customer_contacts (
  customer_id TEXT PRIMARY KEY REFERENCES customers(customer_id) ON DELETE CASCADE,
  business_slug TEXT NOT NULL,
  email_normalized TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_customer_contacts_business_email
  ON customer_contacts (business_slug, email_normalized)
  WHERE email_normalized IS NOT NULL;

CREATE TABLE IF NOT EXISTS customer_phones (
  customer_id TEXT NOT NULL REFERENCES customers(customer_id) ON DELETE CASCADE,
  phone_index INTEGER NOT NULL,
  business_slug TEXT NOT NULL,
  country_code TEXT,
  phone_number TEXT NOT NULL,
  normalized TEXT NOT NULL,
  is_primary BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (customer_id, phone_index)
);

CREATE INDEX IF NOT EXISTS idx_customer_phones_business_normalized
  ON customer_phones (business_slug, normalized);

CREATE TABLE IF NOT EXISTS customer_documents (
  customer_id TEXT PRIMARY KEY REFERENCES customers(customer_id) ON DELETE CASCADE,
  business_slug TEXT NOT NULL,
  document_type TEXT NOT NULL,
  country TEXT NOT NULL,
  document_value TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (business_slug, document_type, country, document_value)
);

CREATE TABLE IF NOT EXISTS registration_commands (
  registration_id TEXT PRIMARY KEY,
  operation TEXT NOT NULL,
  business_slug TEXT NOT NULL,
  idempotency_key_hash CHAR(64) NOT NULL,
  command_fingerprint CHAR(64) NOT NULL,
  workflow_id TEXT NOT NULL,
  customer_id TEXT REFERENCES customers(customer_id),
  status TEXT NOT NULL CHECK (status IN (
    'RESERVED',
    'SOFT_DUPLICATE_PENDING_DECISION',
    'EXISTING_CUSTOMER_PENDING_AUDIT',
    'CUSTOMER_CREATED_PENDING_AUDIT'
  )),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (operation, business_slug, idempotency_key_hash)
);

CREATE INDEX IF NOT EXISTS idx_registration_commands_workflow
  ON registration_commands (workflow_id);

COMMIT;
