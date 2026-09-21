BEGIN;

CREATE TABLE IF NOT EXISTS cta_ingress_records (
  event_id TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  channel TEXT NOT NULL,
  business_slug TEXT NOT NULL,
  provider_event_id TEXT NOT NULL,
  external_user_id TEXT NOT NULL,
  external_conversation_id TEXT NOT NULL,
  action TEXT NOT NULL,
  received_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL,
  workflow_id TEXT,
  case_id TEXT,
  appointment_id TEXT,
  correlation_id TEXT NOT NULL,
  material_hash CHAR(64) NOT NULL,
  duplicate_count INTEGER NOT NULL DEFAULT 0,
  last_duplicate_at TIMESTAMPTZ,
  error_code TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (business_slug, provider, provider_event_id),
  CONSTRAINT cta_ingress_status_chk CHECK (status IN (
    'NORMALIZED','DISPATCHED','PROCESSING','COMPLETED','REJECTED','FAILED'
  ))
);

CREATE INDEX IF NOT EXISTS cta_ingress_correlation_idx
  ON cta_ingress_records (business_slug, correlation_id, created_at);

CREATE TABLE IF NOT EXISTS managed_entities (
  managed_entity_id TEXT PRIMARY KEY,
  business_slug TEXT NOT NULL,
  customer_id TEXT NOT NULL REFERENCES customers(customer_id),
  entity_type TEXT NOT NULL,
  external_ref TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','INACTIVE')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (business_slug, customer_id, entity_type, external_ref)
);

CREATE TABLE IF NOT EXISTS operational_cases (
  case_id TEXT PRIMARY KEY,
  business_slug TEXT NOT NULL,
  customer_id TEXT NOT NULL REFERENCES customers(customer_id),
  managed_entity_id TEXT NOT NULL REFERENCES managed_entities(managed_entity_id),
  workflow_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'APPOINTMENT_SCHEDULED',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (business_slug, workflow_id)
);

CREATE TABLE IF NOT EXISTS resource_reservations (
  resource_reservation_id TEXT PRIMARY KEY,
  business_slug TEXT NOT NULL,
  customer_id TEXT NOT NULL REFERENCES customers(customer_id),
  managed_entity_id TEXT NOT NULL REFERENCES managed_entities(managed_entity_id),
  case_id TEXT REFERENCES operational_cases(case_id),
  appointment_id TEXT,
  catalog_offering_id TEXT NOT NULL REFERENCES service_products(product_id),
  resource_key TEXT NOT NULL,
  reservation_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  workflow_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('HELD','BOOKED','RELEASED','CANCELLED')),
  release_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (start_time < end_time),
  UNIQUE (business_slug, workflow_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS resource_reservations_blocking_slot_uq
  ON resource_reservations (business_slug, resource_key, reservation_date, start_time)
  WHERE status IN ('HELD','BOOKED');

ALTER TABLE appointments ADD COLUMN IF NOT EXISTS managed_entity_id TEXT REFERENCES managed_entities(managed_entity_id);
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS case_id TEXT REFERENCES operational_cases(case_id);
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS resource_reservation_id TEXT;

CREATE TABLE IF NOT EXISTS operational_timeline_events (
  timeline_event_id TEXT PRIMARY KEY,
  business_slug TEXT NOT NULL,
  case_id TEXT NOT NULL REFERENCES operational_cases(case_id),
  appointment_id TEXT,
  resource_reservation_id TEXT,
  event_type TEXT NOT NULL,
  workflow_id TEXT NOT NULL,
  payload_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (workflow_id, event_type)
);

COMMIT;
