# G2-S6 Scheduler Certification Evidence — 2026-09-14

## Scope

Gate: `G2-S6 — Services frozen revision → immutable SchedulingDemand runtime handoff`

Canonical branch: `build/g2-scheduler`

Active PR: `#32`

Predecessor certified prefix: `G2-S0..G2-S5`.

## Candidate exact head

```text
9d6af52e5749e83469e7d4aca89775753ea2f4e5
```

Candidate execution was run independently in push and pull-request contexts.

## Candidate push proof

```text
run       34908156644
result    SUCCESS

jobs
g2-s6-contracts-boundaries       SUCCESS
g2-s6-postgres-services-handoff  SUCCESS
scheduler-g2-s6-seal             SUCCESS
```

Artifacts:

```text
scheduler-g2-s6-34908156644
id      10373038529
sha256  ac19a18f05110e4ddc0ac383f35e2d623c2344e2bda3372d9d736ccb1aa865f7

scheduler-g2-s6-seal-34908156644
id      10373098349
sha256  31ee2cc53af62f5175f4b7c82fe0ab2897f8c36af01a6dc8eadb02624f3b2da0
```

## Candidate PR proof

```text
run       34908161495
result    SUCCESS

jobs
g2-s6-contracts-boundaries       SUCCESS
g2-s6-postgres-services-handoff  SUCCESS
scheduler-g2-s6-seal             SUCCESS
```

Artifacts:

```text
scheduler-g2-s6-34908161495
id      10373461589
sha256  2b82a0ebd9635f161f11b1c887899913133cc13aafc678c2ce3610c946019da1

scheduler-g2-s6-seal-34908161495
id      10373631264
sha256  1b2b7e2c4cb37f2d83a698026142654399b840ddd0aad6e1c9612fa711a4d0fd
```

## Certified implementation surfaces

```text
mk1/runtime/migrations/010_services_scheduler_profile.sql
mk1/runtime/src/contracts/services-engine/types.ts
mk1/runtime/src/contracts/services-engine/validation.ts
mk1/runtime/src/contracts/services-engine/management.ts
mk1/runtime/src/persistence/postgres/services.repository.ts
mk1/runtime/src/persistence/postgres/services-management.repository.ts
mk1/runtime/src/scheduler/services-demand-handoff.ts
mk1/runtime/src/scheduler/services-demand-handoff.test.ts
mk1/runtime/scripts/migrate-postgres-scheduler-g2-s6.ts
mk1/runtime/scripts/certify-scheduler-g2-s6.ts
.github/workflows/mk1-scheduler-g2-s6.yml
```

## Proven boundary

Services owns the versioned abstract scheduling profile attached to a schedulable Offering:

```text
capacityUnits
requiredCapabilities[].code
requiredCapabilities[].quantity
requiredCapabilities[].resourceKinds?
buffers.beforeMinutes
buffers.afterMinutes
```

Services does not embed concrete Scheduler resource/schedule/hold/reservation identities in this profile.

Scheduler receives a frozen `SchedulingDemand` containing exact Service/Offering revision identity, duration and copied scheduling material. The handoff materializer consumes a frozen `ServicesSelectionSnapshot` rather than re-reading the mutable catalog head.

## Immutable persistence proof

The candidate establishes:

```text
Services N
→ snapshot N
→ demand N
→ scheduler_demands + snapshot_hash

same demandId + same N material
→ replay

same demandId + changed material
→ DEMAND_MATERIAL_CONFLICT
→ no overwrite
```

The `scheduler_demands` table intentionally remains detached from mutable Services catalog heads by foreign key, so the persisted demand is a value snapshot rather than a live catalog reference.

## N → N+1 proof

The executable probe publishes materially different scheduling semantics:

```text
N
  service revision       1
  offering revision      1
  duration               30m
  capability             G2S6_CAP_N
  resource kind          BAY
  buffers                 5 / 5

N+1
  service revision       2
  offering revision      2
  duration               60m
  capability             G2S6_CAP_N1
  resource kind          ROOM
  buffers                 0 / 15
```

Evidence proves:

```text
demand N survives catalog advance unchanged
snapshot_hash N remains unchanged
Scheduler re-loads persisted demand N and continues to expose N semantics
new demand N+1 contains N+1 material
Scheduler re-loads persisted demand N+1 and exposes N+1 semantics
```

This is stronger than merely comparing serialized input: the probe reloads both demands from PostgreSQL and executes deterministic Scheduler availability from that persisted truth.

## Protected regressions

Candidate workflow re-certified:

```text
G2-S0 contract + persistence
G2-S1 resource/schedule management
G2-S2 deterministic availability
G2-S3 atomic reservation
G2-S4 hold lifecycle
G2-S5 multi-business isolation
Services contract/management regressions
Appointment contract regression
CTA canonical regression
inherited Temporal/CTA runtime path
```

## Boundary guards

Candidate CI proves:

```text
no concrete resourceId/scheduleId/holdId/reservationId in Services scheduling-profile contract
no Telegram/WhatsApp/TikTok/WebChat/Kapso/Messenger/Facebook mechanics in handoff/core Services surfaces
no Scheduler migration references in RegisterNewAppointment workflow/activity
```

Appointment migration therefore remains G2-S7.

## Terminal markers

```text
SCHEDULER_G2_S6_CONTRACTS_PASS
SCHEDULER_G2_S6_ABSTRACT_BOUNDARY_PASS
SCHEDULER_G2_S6_GENERIC_BOUNDARY_PASS
SCHEDULER_G2_S6_NO_APPOINTMENT_MIGRATION_PASS
SCHEDULER_G2_S6_PREDECESSOR_REGRESSION_PASS
SCHEDULER_G2_S6_SERVICES_HANDOFF_PASS
SCHEDULER_G2_S6_PLATFORM_REGRESSION_PASS
SCHEDULER_G2_S6_CERTIFICATION_PASS
```

## Truth boundary

G2-S6 proves frozen Services scheduling semantics can become immutable Scheduler operational input without mutable-catalog drift.

It does not claim Appointment→Scheduler orchestration, multi-resource assignment/search, broad Integration Engine behavior, reservation cancellation/completion lifecycle, or final Scheduler production readiness.

## Exact-final-head requirement

This evidence file records candidate proof. Because this file and the related receipt/design/roadmap/ledger updates change the branch head, the same dedicated G2-S6 workflow must run again in both push and PR contexts on the documentation-complete exact branch head. Final run IDs and final artifact digests belong in PR #32 after that seal; adding them to this branch file afterward would itself invalidate exact-head certification.
