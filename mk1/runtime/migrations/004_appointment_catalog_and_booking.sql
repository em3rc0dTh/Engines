BEGIN;

CREATE TABLE IF NOT EXISTS service_catalog (
  service_id TEXT PRIMARY KEY,
  business_slug TEXT NOT NULL,
  service_code TEXT NOT NULL,
  service_name TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (business_slug, service_code)
);

CREATE TABLE IF NOT EXISTS service_products (
  product_id TEXT PRIMARY KEY,
  service_id TEXT NOT NULL REFERENCES service_catalog(service_id),
  business_slug TEXT NOT NULL,
  product_code TEXT NOT NULL,
  product_name TEXT NOT NULL,
  description TEXT,
  duration_minutes INTEGER NOT NULL CHECK (duration_minutes > 0 AND duration_minutes <= 1440),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (business_slug, product_code)
);

CREATE INDEX IF NOT EXISTS idx_service_products_service_active
  ON service_products (business_slug, service_id, active);

CREATE TABLE IF NOT EXISTS service_availability_rules (
  availability_rule_id TEXT PRIMARY KEY,
  business_slug TEXT NOT NULL,
  product_id TEXT NOT NULL REFERENCES service_products(product_id),
  weekday SMALLINT NOT NULL CHECK (weekday BETWEEN 0 AND 6),
  opens_at TIME NOT NULL,
  closes_at TIME NOT NULL,
  slot_minutes INTEGER NOT NULL CHECK (slot_minutes > 0 AND slot_minutes <= 1440),
  resource_key TEXT NOT NULL DEFAULT 'default',
  active BOOLEAN NOT NULL DEFAULT TRUE,
  CHECK (opens_at < closes_at),
  UNIQUE (business_slug, product_id, weekday, resource_key)
);

CREATE TABLE IF NOT EXISTS appointment_commands (
  appointment_command_id TEXT PRIMARY KEY,
  operation TEXT NOT NULL DEFAULT 'RegisterNewAppointment',
  business_slug TEXT NOT NULL,
  idempotency_key_hash CHAR(64) NOT NULL,
  command_fingerprint CHAR(64) NOT NULL,
  workflow_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('RESERVED', 'BOOKED')),
  appointment_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (operation, business_slug, idempotency_key_hash),
  UNIQUE (workflow_id)
);

CREATE TABLE IF NOT EXISTS appointments (
  appointment_id TEXT PRIMARY KEY,
  business_slug TEXT NOT NULL,
  workflow_id TEXT NOT NULL,
  customer_id TEXT NOT NULL REFERENCES customers(customer_id),
  service_id TEXT NOT NULL REFERENCES service_catalog(service_id),
  product_id TEXT NOT NULL REFERENCES service_products(product_id),
  appointment_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  timezone TEXT NOT NULL DEFAULT 'America/Lima',
  resource_key TEXT NOT NULL DEFAULT 'default',
  status TEXT NOT NULL DEFAULT 'BOOKED' CHECK (status IN ('BOOKED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (start_time < end_time),
  UNIQUE (workflow_id),
  UNIQUE (business_slug, resource_key, appointment_date, start_time)
);

ALTER TABLE appointment_commands
  DROP CONSTRAINT IF EXISTS appointment_commands_appointment_id_fkey;
ALTER TABLE appointment_commands
  ADD CONSTRAINT appointment_commands_appointment_id_fkey
  FOREIGN KEY (appointment_id) REFERENCES appointments(appointment_id);

CREATE INDEX IF NOT EXISTS idx_appointments_customer_date
  ON appointments (business_slug, customer_id, appointment_date);

CREATE INDEX IF NOT EXISTS idx_appointments_product_date
  ON appointments (business_slug, product_id, appointment_date);

INSERT INTO service_catalog (service_id, business_slug, service_code, service_name, active)
VALUES ('svc_car_wash', 'golden-business', 'car-wash', 'Car Wash', TRUE)
ON CONFLICT (service_id) DO UPDATE
SET service_name = EXCLUDED.service_name,
    active = EXCLUDED.active,
    updated_at = NOW();

INSERT INTO service_products (
  product_id, service_id, business_slug, product_code, product_name, description, duration_minutes, active
)
VALUES
  ('prd_car_wash_basic', 'svc_car_wash', 'golden-business', 'car-wash-basic', 'Basic Clean', 'Basic exterior car wash', 30, TRUE),
  ('prd_car_wash_executive', 'svc_car_wash', 'golden-business', 'car-wash-executive', 'Executive Clean', 'Expanded exterior and interior clean', 30, TRUE),
  ('prd_car_wash_salon', 'svc_car_wash', 'golden-business', 'car-wash-salon', 'Salon Clean', 'Salon-focused complete clean', 30, TRUE)
ON CONFLICT (product_id) DO UPDATE
SET product_name = EXCLUDED.product_name,
    description = EXCLUDED.description,
    duration_minutes = EXCLUDED.duration_minutes,
    active = EXCLUDED.active,
    updated_at = NOW();

INSERT INTO service_availability_rules (
  availability_rule_id, business_slug, product_id, weekday, opens_at, closes_at, slot_minutes, resource_key, active
)
SELECT
  'avr_' || p.product_id || '_' || d.weekday,
  'golden-business',
  p.product_id,
  d.weekday,
  TIME '06:00',
  TIME '07:30',
  30,
  'default',
  TRUE
FROM (VALUES
  ('prd_car_wash_basic'),
  ('prd_car_wash_executive'),
  ('prd_car_wash_salon')
) AS p(product_id)
CROSS JOIN (VALUES (1), (2), (3), (4), (5), (6)) AS d(weekday)
ON CONFLICT (business_slug, product_id, weekday, resource_key) DO UPDATE
SET opens_at = EXCLUDED.opens_at,
    closes_at = EXCLUDED.closes_at,
    slot_minutes = EXCLUDED.slot_minutes,
    active = EXCLUDED.active;

COMMIT;
