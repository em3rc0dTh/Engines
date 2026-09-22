BEGIN;

-- G2-S7: Scheduler is now the sole concrete time/resource allocation authority
-- for new Appointment finalization. Keep the legacy resource_reservation_id
-- column for historical rows, but link new rows directly to Scheduler truth.
ALTER TABLE appointments
  ADD COLUMN IF NOT EXISTS scheduler_reservation_id TEXT;

ALTER TABLE appointments
  DROP CONSTRAINT IF EXISTS appointments_scheduler_reservation_fk;
ALTER TABLE appointments
  ADD CONSTRAINT appointments_scheduler_reservation_fk
  FOREIGN KEY (scheduler_reservation_id)
  REFERENCES scheduler_reservations (reservation_id);

CREATE UNIQUE INDEX IF NOT EXISTS uq_appointments_scheduler_reservation
  ON appointments (scheduler_reservation_id)
  WHERE scheduler_reservation_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_appointments_scheduler_lookup
  ON appointments (business_slug, scheduler_reservation_id);

-- The old Appointment table enforced capacity with one row per
-- business/resource/date/start. G2 Scheduler now owns capacity, including
-- capacity > 1, so that legacy uniqueness must no longer arbitrate booking.
DO $$
DECLARE
  constraint_name TEXT;
BEGIN
  FOR constraint_name IN
    SELECT conname
      FROM pg_constraint
     WHERE conrelid = 'appointments'::regclass
       AND contype = 'u'
       AND pg_get_constraintdef(oid) LIKE '%business_slug, resource_key, appointment_date, start_time%'
  LOOP
    EXECUTE format('ALTER TABLE appointments DROP CONSTRAINT %I', constraint_name);
  END LOOP;
END $$;

CREATE INDEX IF NOT EXISTS idx_appointments_resource_start
  ON appointments (business_slug, resource_key, appointment_date, start_time);

-- The repository already ships a canonical golden Appointment fixture. Migrate
-- that fixture into the Scheduler model so inherited Appointment/CTA proofs run
-- unchanged while exercising the new authority boundary. The update is
-- revision-safe and idempotent: an existing scheduling profile is never
-- rewritten by this migration.
UPDATE service_products
   SET scheduling_profile = '{
         "capacityUnits": 1,
         "requiredCapabilities": [
           {"code":"APPOINTMENT_STANDARD","quantity":1,"resourceKinds":["BAY"]}
         ],
         "buffers": {"beforeMinutes":0,"afterMinutes":0}
       }'::jsonb,
       revision = revision + 1,
       updated_at = NOW()
 WHERE business_slug = 'golden-business'
   AND product_id IN (
     'prd_car_wash_basic',
     'prd_car_wash_executive',
     'prd_car_wash_salon'
   )
   AND scheduling_profile IS NULL;

INSERT INTO scheduler_resources (
  resource_id, business_slug, resource_code, resource_kind, resource_name,
  status, time_zone, capacity, revision
) VALUES (
  'res_golden_appointment_bay',
  'golden-business',
  'golden-appointment-bay',
  'BAY',
  'Golden Appointment Bay',
  'ACTIVE',
  'America/Lima',
  1,
  1
)
ON CONFLICT (resource_id) DO UPDATE
SET status = 'ACTIVE',
    time_zone = EXCLUDED.time_zone,
    capacity = EXCLUDED.capacity,
    updated_at = NOW();

INSERT INTO scheduler_resource_capabilities (
  business_slug, resource_id, capability_code, capacity_units, metadata
) VALUES (
  'golden-business',
  'res_golden_appointment_bay',
  'APPOINTMENT_STANDARD',
  1,
  '{}'::jsonb
)
ON CONFLICT (business_slug, resource_id, capability_code) DO UPDATE
SET capacity_units = EXCLUDED.capacity_units,
    metadata = EXCLUDED.metadata;

INSERT INTO scheduler_schedule_templates (
  schedule_id, business_slug, resource_id, time_zone, revision
) VALUES (
  'schedule_golden_appointment_bay',
  'golden-business',
  'res_golden_appointment_bay',
  'America/Lima',
  1
)
ON CONFLICT (schedule_id) DO UPDATE
SET resource_id = EXCLUDED.resource_id,
    time_zone = EXCLUDED.time_zone,
    updated_at = NOW();

DELETE FROM scheduler_schedule_windows
 WHERE business_slug = 'golden-business'
   AND schedule_id = 'schedule_golden_appointment_bay';

INSERT INTO scheduler_schedule_windows (
  business_slug, schedule_id, window_index, weekday,
  start_local, end_local, capacity
) VALUES
  ('golden-business','schedule_golden_appointment_bay',0,0,'06:00','07:30',1),
  ('golden-business','schedule_golden_appointment_bay',1,1,'06:00','07:30',1),
  ('golden-business','schedule_golden_appointment_bay',2,2,'06:00','07:30',1),
  ('golden-business','schedule_golden_appointment_bay',3,3,'06:00','07:30',1),
  ('golden-business','schedule_golden_appointment_bay',4,4,'06:00','07:30',1),
  ('golden-business','schedule_golden_appointment_bay',5,5,'06:00','07:30',1),
  ('golden-business','schedule_golden_appointment_bay',6,6,'06:00','07:30',1);

COMMIT;
