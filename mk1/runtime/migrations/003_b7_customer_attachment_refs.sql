BEGIN;

CREATE TABLE IF NOT EXISTS customer_attachment_refs (
  customer_id TEXT NOT NULL REFERENCES customers(customer_id) ON DELETE CASCADE,
  attachment_id TEXT NOT NULL,
  kind TEXT,
  display_name TEXT,
  media_type TEXT NOT NULL,
  byte_length INTEGER NOT NULL CHECK (byte_length >= 0),
  sha256 CHAR(64) NOT NULL CHECK (sha256 ~ '^[a-f0-9]{64}$'),
  committed_at TIMESTAMPTZ NOT NULL,
  linked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (customer_id, attachment_id),
  UNIQUE (attachment_id)
);

CREATE INDEX IF NOT EXISTS idx_customer_attachment_refs_customer
  ON customer_attachment_refs (customer_id);

CREATE INDEX IF NOT EXISTS idx_customer_attachment_refs_sha256
  ON customer_attachment_refs (sha256);

COMMIT;
