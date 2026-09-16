BEGIN;

CREATE TABLE IF NOT EXISTS scheduler_resources (
  resource_id TEXT PRIMARY KEY,
  business_slug TEXT NOT NULL,
  resource_code TEXT NOT NULL,
  resource_kind TEXT NOT NULL,
  resource_name TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('ACTIVE', 'INACTIVE')),
  time_zone TEXT NOT NULL,
  capacity INTEGER NOT NULL CHECK (capacity > 0),
  revision INTEGER NOT NULL CHECK (revision > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (business_slug, resource_id),
  UNIQUE (business_slug, resource_code)
);

CREATE INDEX IF NOT EXISTS idx_scheduler_resources_scope
  ON scheduler_resources (business_slug, status, resource_kind, resource_code);

CREATE TABLE IF NOT EXISTS scheduler_resource_capabilities (
  business_slug TEXT NOT NULL,
  resource_id TEXT NOT NULL,
  capability_code TEXT NOT NULL,
  capacity_units INTEGER CHECK (capacity_units IS NULL OR capacity_units > 0),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (jsonb_typeof(metadata) = 'object'),
  PRIMARY KEY (business_slug, resource_id, capability_code),
  FOREIGN KEY (business_slug, resource_id)
    REFERENCES scheduler_resources (business_slug, resource_id)
    ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_scheduler_capabilities_lookup
  ON scheduler_resource_capabilities (business_slug, capability_code, resource_id);

CREATE TABLE IF NOT EXISTS scheduler_schedule_templates (
  schedule_id TEXT PRIMARY KEY,
  business_slug TEXT NOT NULL,
  resource_id TEXT NOT NULL,
  time_zone TEXT NOT NULL,
  revision INTEGER NOT NULL CHECK (revision > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  FOREIGN KEY (business_slug, resource_id)
    REFERENCES scheduler_resources (business_slug, resource_id),
  UNIQUE (business_slug, schedule_id)
);

CREATE TABLE IF NOT EXISTS scheduler_schedule_windows (
  business_slug TEXT NOT NULL,
  schedule_id TEXT NOT NULL,
  window_index INTEGER NOT NULL CHECK (window_index >= 0),
  weekday SMALLINT NOT NULL CHECK (weekday BETWEEN 0 AND 6),
  start_local TIME NOT NULL,
  end_local TIME NOT NULL,
  capacity INTEGER CHECK (capacity IS NULL OR capacity > 0),
  CHECK (start_local < end_local),
  PRIMARY KEY (schedule_id, window_index),
  FOREIGN KEY (business_slug, schedule_id)
    REFERENCES scheduler_schedule_templates (business_slug, schedule_id)
    ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_scheduler_schedule_windows_lookup
  ON scheduler_schedule_windows (business_slug, weekday, start_local, end_local);

CREATE TABLE IF NOT EXISTS scheduler_schedule_overrides (
  override_id TEXT PRIMARY KEY,
  business_slug TEXT NOT NULL,
  resource_id TEXT NOT NULL,
  start_at TIMESTAMPTZ NOT NULL,
  end_at TIMESTAMPTZ NOT NULL,
  override_kind TEXT NOT NULL CHECK (override_kind IN ('AVAILABLE', 'UNAVAILABLE', 'CAPACITY')),
  capacity INTEGER,
  reason_code TEXT,
  revision INTEGER NOT NULL CHECK (revision > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (start_at < end_at),
  CHECK (
    (override_kind = 'CAPACITY' AND capacity IS NOT NULL AND capacity > 0)
    OR (override_kind <> 'CAPACITY' AND capacity IS NULL)
  ),
  FOREIGN KEY (business_slug, resource_id)
    REFERENCES scheduler_resources (business_slug, resource_id),
  UNIQUE (business_slug, override_id)
);

CREATE INDEX IF NOT EXISTS idx_scheduler_overrides_resource_window
  ON scheduler_schedule_overrides (business_slug, resource_id, start_at, end_at);

-- G2-S0 implementation decision: persist the immutable Services→Scheduler handoff
-- directly so later availability/hold/reservation gates never need to re-read a
-- mutable catalog head. No FK to service_catalog/service_products is intentional.
CREATE TABLE IF NOT EXISTS scheduler_demands (
  demand_id TEXT PRIMARY KEY,
  schema_version SMALLINT NOT NULL CHECK (schema_version = 1),
  business_slug TEXT NOT NULL,
  service_id TEXT NOT NULL,
  service_revision INTEGER NOT NULL CHECK (service_revision > 0),
  offering_id TEXT NOT NULL,
  offering_revision INTEGER NOT NULL CHECK (offering_revision > 0),
  duration_minutes INTEGER NOT NULL CHECK (duration_minutes > 0 AND duration_minutes <= 1440),
  capacity_units INTEGER NOT NULL CHECK (capacity_units > 0),
  required_capabilities JSONB NOT NULL DEFAULT '[]'::jsonb,
  buffer_before_minutes INTEGER NOT NULL DEFAULT 0 CHECK (buffer_before_minutes BETWEEN 0 AND 1440),
  buffer_after_minutes INTEGER NOT NULL DEFAULT 0 CHECK (buffer_after_minutes BETWEEN 0 AND 1440),
  snapshot_hash CHAR(64) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (jsonb_typeof(required_capabilities) = 'array'),
  UNIQUE (business_slug, demand_id)
);

CREATE INDEX IF NOT EXISTS idx_scheduler_demands_snapshot
  ON scheduler_demands (business_slug, service_id, service_revision, offering_id, offering_revision);

CREATE TABLE IF NOT EXISTS scheduler_holds (
  hold_id TEXT PRIMARY KEY,
  business_slug TEXT NOT NULL,
  demand_id TEXT NOT NULL,
  start_at TIMESTAMPTZ NOT NULL,
  end_at TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('ACTIVE', 'EXPIRED', 'RELEASED', 'CONSUMED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (start_at < end_at),
  FOREIGN KEY (business_slug, demand_id)
    REFERENCES scheduler_demands (business_slug, demand_id),
  UNIQUE (business_slug, hold_id)
);

CREATE TABLE IF NOT EXISTS scheduler_hold_assignments (
  business_slug TEXT NOT NULL,
  hold_id TEXT NOT NULL,
  resource_id TEXT NOT NULL,
  capacity_units INTEGER NOT NULL CHECK (capacity_units > 0),
  PRIMARY KEY (hold_id, resource_id),
  FOREIGN KEY (business_slug, hold_id)
    REFERENCES scheduler_holds (business_slug, hold_id)
    ON DELETE CASCADE,
  FOREIGN KEY (business_slug, resource_id)
    REFERENCES scheduler_resources (business_slug, resource_id)
);

CREATE INDEX IF NOT EXISTS idx_scheduler_holds_window
  ON scheduler_holds (business_slug, status, start_at, end_at, expires_at);

CREATE TABLE IF NOT EXISTS scheduler_reservations (
  reservation_id TEXT PRIMARY KEY,
  business_slug TEXT NOT NULL,
  demand_id TEXT NOT NULL,
  start_at TIMESTAMPTZ NOT NULL,
  end_at TIMESTAMPTZ NOT NULL,
  time_zone TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('RESERVED', 'CANCELLED', 'COMPLETED')),
  revision INTEGER NOT NULL CHECK (revision > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (start_at < end_at),
  FOREIGN KEY (business_slug, demand_id)
    REFERENCES scheduler_demands (business_slug, demand_id),
  UNIQUE (business_slug, reservation_id)
);

CREATE TABLE IF NOT EXISTS scheduler_reservation_assignments (
  business_slug TEXT NOT NULL,
  reservation_id TEXT NOT NULL,
  resource_id TEXT NOT NULL,
  capacity_units INTEGER NOT NULL CHECK (capacity_units > 0),
  PRIMARY KEY (reservation_id, resource_id),
  FOREIGN KEY (business_slug, reservation_id)
    REFERENCES scheduler_reservations (business_slug, reservation_id)
    ON DELETE CASCADE,
  FOREIGN KEY (business_slug, resource_id)
    REFERENCES scheduler_resources (business_slug, resource_id)
);

CREATE INDEX IF NOT EXISTS idx_scheduler_reservations_window
  ON scheduler_reservations (business_slug, status, start_at, end_at);

CREATE TABLE IF NOT EXISTS scheduler_commands (
  command_id TEXT PRIMARY KEY,
  business_slug TEXT NOT NULL,
  operation_id TEXT NOT NULL,
  command_type TEXT NOT NULL,
  material_hash CHAR(64) NOT NULL,
  command_material JSONB NOT NULL DEFAULT '{}'::jsonb,
  result_type TEXT,
  result_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (jsonb_typeof(command_material) = 'object'),
  UNIQUE (business_slug, operation_id)
);

CREATE INDEX IF NOT EXISTS idx_scheduler_commands_result
  ON scheduler_commands (business_slug, result_type, result_id);

COMMIT;
