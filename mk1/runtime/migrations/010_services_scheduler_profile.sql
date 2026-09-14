BEGIN;

-- G2-S6 completes the frozen Services → Scheduler handoff by persisting the
-- abstract scheduling demand material on the versioned Offering head. The
-- profile is Services-owned catalog truth; Scheduler still persists a copied
-- immutable SchedulingDemand and has no FK/read dependency on mutable heads.
ALTER TABLE service_products
  ADD COLUMN IF NOT EXISTS scheduling_profile JSONB;

ALTER TABLE service_products
  DROP CONSTRAINT IF EXISTS service_products_scheduling_profile_shape_check;
ALTER TABLE service_products
  ADD CONSTRAINT service_products_scheduling_profile_shape_check CHECK (
    scheduling_profile IS NULL
    OR (
      jsonb_typeof(scheduling_profile) = 'object'
      AND jsonb_typeof(scheduling_profile->'capacityUnits') = 'number'
      AND (scheduling_profile->>'capacityUnits')::numeric > 0
      AND jsonb_typeof(scheduling_profile->'requiredCapabilities') = 'array'
      AND jsonb_typeof(scheduling_profile->'buffers') = 'object'
      AND jsonb_typeof(scheduling_profile->'buffers'->'beforeMinutes') = 'number'
      AND jsonb_typeof(scheduling_profile->'buffers'->'afterMinutes') = 'number'
      AND (scheduling_profile->'buffers'->>'beforeMinutes')::numeric >= 0
      AND (scheduling_profile->'buffers'->>'afterMinutes')::numeric >= 0
    )
  );

COMMENT ON COLUMN service_products.scheduling_profile IS
  'Services-owned abstract scheduling material copied by value into Scheduler SchedulingDemand; no concrete resource identities.';

COMMIT;
