BEGIN;

-- G1/S1 evolves the certified MK0 catalog in place. The physical table names are
-- retained for compatibility; the new domain contract exposes service_products
-- as neutral Service Offerings.

ALTER TABLE service_catalog
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS revision INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS tags JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE service_catalog
  DROP CONSTRAINT IF EXISTS service_catalog_revision_check;
ALTER TABLE service_catalog
  ADD CONSTRAINT service_catalog_revision_check CHECK (revision >= 1);

ALTER TABLE service_catalog
  DROP CONSTRAINT IF EXISTS service_catalog_tags_array_check;
ALTER TABLE service_catalog
  ADD CONSTRAINT service_catalog_tags_array_check CHECK (jsonb_typeof(tags) = 'array');

ALTER TABLE service_catalog
  ADD COLUMN IF NOT EXISTS status TEXT
  GENERATED ALWAYS AS (CASE WHEN active THEN 'ACTIVE' ELSE 'INACTIVE' END) STORED;

CREATE UNIQUE INDEX IF NOT EXISTS uq_service_catalog_business_service_id
  ON service_catalog (business_slug, service_id);

ALTER TABLE service_products
  ADD COLUMN IF NOT EXISTS revision INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS priority INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tags JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS price_kind TEXT NOT NULL DEFAULT 'QUOTE_REQUIRED',
  ADD COLUMN IF NOT EXISTS price_amount_minor BIGINT,
  ADD COLUMN IF NOT EXISTS price_currency TEXT;

ALTER TABLE service_products
  DROP CONSTRAINT IF EXISTS service_products_revision_check;
ALTER TABLE service_products
  ADD CONSTRAINT service_products_revision_check CHECK (revision >= 1);

ALTER TABLE service_products
  DROP CONSTRAINT IF EXISTS service_products_priority_check;
ALTER TABLE service_products
  ADD CONSTRAINT service_products_priority_check CHECK (priority BETWEEN -1000000 AND 1000000);

ALTER TABLE service_products
  DROP CONSTRAINT IF EXISTS service_products_tags_array_check;
ALTER TABLE service_products
  ADD CONSTRAINT service_products_tags_array_check CHECK (jsonb_typeof(tags) = 'array');

ALTER TABLE service_products
  DROP CONSTRAINT IF EXISTS service_products_price_shape_check;
ALTER TABLE service_products
  ADD CONSTRAINT service_products_price_shape_check CHECK (
    (price_kind IN ('FREE', 'QUOTE_REQUIRED')
      AND price_amount_minor IS NULL
      AND price_currency IS NULL)
    OR
    (price_kind IN ('FIXED', 'FROM')
      AND price_amount_minor IS NOT NULL
      AND price_amount_minor >= 0
      AND price_currency IS NOT NULL
      AND price_currency ~ '^[A-Z]{3}$')
  );

ALTER TABLE service_products
  ADD COLUMN IF NOT EXISTS status TEXT
  GENERATED ALWAYS AS (CASE WHEN active THEN 'ACTIVE' ELSE 'INACTIVE' END) STORED;

CREATE UNIQUE INDEX IF NOT EXISTS uq_service_products_business_product_id
  ON service_products (business_slug, product_id);

CREATE TABLE IF NOT EXISTS service_requirements (
  requirement_id TEXT PRIMARY KEY,
  business_slug TEXT NOT NULL,
  product_id TEXT NOT NULL,
  requirement_code TEXT NOT NULL,
  requirement_kind TEXT NOT NULL CHECK (
    requirement_kind IN (
      'CUSTOMER_DATA',
      'DOCUMENT',
      'CONSENT',
      'ENTITY_ATTRIBUTE',
      'RESOURCE_CAPABILITY',
      'PRECONDITION'
    )
  ),
  required BOOLEAN NOT NULL DEFAULT TRUE,
  config JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(config) = 'object'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (business_slug, product_id, requirement_code),
  FOREIGN KEY (business_slug, product_id)
    REFERENCES service_products (business_slug, product_id)
    ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS service_dependencies (
  dependency_id TEXT PRIMARY KEY,
  business_slug TEXT NOT NULL,
  source_product_id TEXT NOT NULL,
  target_product_id TEXT NOT NULL,
  relation TEXT NOT NULL CHECK (relation IN ('REQUIRES', 'EXCLUDES')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (source_product_id <> target_product_id),
  UNIQUE (business_slug, source_product_id, target_product_id),
  FOREIGN KEY (business_slug, source_product_id)
    REFERENCES service_products (business_slug, product_id)
    ON DELETE CASCADE,
  FOREIGN KEY (business_slug, target_product_id)
    REFERENCES service_products (business_slug, product_id)
    ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS service_eligibility_rules (
  rule_id TEXT PRIMARY KEY,
  business_slug TEXT NOT NULL,
  product_id TEXT NOT NULL,
  mode TEXT NOT NULL DEFAULT 'ALL' CHECK (mode IN ('ALL')),
  predicates JSONB NOT NULL CHECK (jsonb_typeof(predicates) = 'array'),
  failure_code TEXT NOT NULL CHECK (length(btrim(failure_code)) > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (business_slug, product_id),
  FOREIGN KEY (business_slug, product_id)
    REFERENCES service_products (business_slug, product_id)
    ON DELETE CASCADE
);

-- Existing MK0 seed rows remain valid and become explicit revision-1,
-- quote-required Offerings until G1 fixtures publish richer commercial data.
UPDATE service_catalog
   SET revision = GREATEST(revision, 1),
       tags = COALESCE(tags, '[]'::jsonb);

UPDATE service_products
   SET revision = GREATEST(revision, 1),
       tags = COALESCE(tags, '[]'::jsonb),
       price_kind = COALESCE(price_kind, 'QUOTE_REQUIRED'),
       price_amount_minor = CASE
         WHEN COALESCE(price_kind, 'QUOTE_REQUIRED') IN ('FREE', 'QUOTE_REQUIRED') THEN NULL
         ELSE price_amount_minor
       END,
       price_currency = CASE
         WHEN COALESCE(price_kind, 'QUOTE_REQUIRED') IN ('FREE', 'QUOTE_REQUIRED') THEN NULL
         ELSE price_currency
       END;

COMMIT;
