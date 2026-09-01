BEGIN;

CREATE TABLE IF NOT EXISTS service_mutation_commands (
  command_id TEXT PRIMARY KEY,
  operation TEXT NOT NULL CHECK (
    operation IN (
      'CreateService',
      'UpdateService',
      'SetServiceStatus',
      'CreateOffering',
      'UpdateOffering',
      'SetOfferingStatus'
    )
  ),
  business_slug TEXT NOT NULL,
  idempotency_key_hash CHAR(64) NOT NULL,
  command_fingerprint CHAR(64) NOT NULL,
  workflow_id TEXT NOT NULL,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('SERVICE', 'OFFERING')),
  entity_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('RESERVED', 'APPLIED', 'REJECTED')),
  result_payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (operation, business_slug, idempotency_key_hash)
);

CREATE INDEX IF NOT EXISTS idx_service_mutation_commands_entity
  ON service_mutation_commands (business_slug, entity_type, entity_id, created_at);

CREATE INDEX IF NOT EXISTS idx_service_mutation_commands_workflow
  ON service_mutation_commands (workflow_id);

COMMIT;
