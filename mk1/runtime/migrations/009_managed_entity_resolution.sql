BEGIN;

ALTER TABLE managed_entities
  ADD COLUMN IF NOT EXISTS display_name TEXT,
  ADD COLUMN IF NOT EXISTS summary TEXT,
  ADD COLUMN IF NOT EXISTS data_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

UPDATE managed_entities
   SET display_name = COALESCE(NULLIF(external_ref, ''), entity_type)
 WHERE display_name IS NULL OR BTRIM(display_name) = '';

ALTER TABLE managed_entities
  ALTER COLUMN display_name SET NOT NULL;

CREATE INDEX IF NOT EXISTS managed_entities_customer_type_active_idx
  ON managed_entities (business_slug, customer_id, entity_type, created_at)
  WHERE status = 'ACTIVE';

COMMIT;
