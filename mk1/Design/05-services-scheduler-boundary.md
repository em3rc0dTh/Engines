# G1→G2 — Services / Scheduler Boundary Contract

## Status

**G2-S6 CERTIFIED — G2-S7 NEXT**

This contract defines the certified semantic/runtime handoff between Services and Scheduler. Candidate evidence proves the boundary against PostgreSQL and deterministic Scheduler execution; final exact-head run evidence is recorded on PR #32 after the documentation-complete branch seal so no post-seal branch mutation is required.

## 1. Authority split

```text
Services Engine owns
- what the offering is
- nominal duration
- pricing descriptor
- requirements/dependencies
- eligibility/recommendation
- immutable selected revision snapshot
- abstract scheduling profile

Scheduler Engine owns
- concrete resources
- capabilities available on resources
- schedules and overrides
- capacity/free-busy
- candidate slots
- holds
- reservations
- assignment/conflict lifecycle
```

Neither engine owns channel/provider presentation or transport mechanics.

## 2. Services scheduling profile

A schedulable Offering may carry versioned abstract scheduling semantics:

```ts
type ServiceSchedulingProfile = Readonly<{
  capacityUnits: number;
  requiredCapabilities: readonly Readonly<{
    code: string;
    quantity: number;
    resourceKinds?: readonly string[];
  }>[];
  buffers: Readonly<{
    beforeMinutes: number;
    afterMinutes: number;
  }>;
}>;
```

The profile is persisted with the Services Offering revision. It may describe resource **kinds/capabilities**, but it must not embed concrete Scheduler resource IDs, schedule IDs, hold IDs or reservation IDs.

Non-schedulable Offerings may omit the profile.

## 3. Immutable handoff

Scheduler receives material derived from an already-frozen `ServicesSelectionSnapshot`, not a fresh read of mutable catalog head.

```ts
type SchedulingDemand = Readonly<{
  schemaVersion: 1;
  businessSlug: string;
  demandId: string;
  service: {
    serviceId: string;
    revision: number;
  };
  offering: {
    offeringId: string;
    revision: number;
    durationMinutes: number;
  };
  capacityUnits: number;
  requiredCapabilities: readonly CapabilityDemand[];
  buffers: {
    beforeMinutes: number;
    afterMinutes: number;
  };
}>;

type CapabilityDemand = Readonly<{
  code: string;
  quantity: number;
  resourceKinds?: readonly string[];
}>;
```

`demandId` is durable workflow/domain identity for the scheduling demand. Once persisted, `scheduler_demands` is Scheduler operational truth by value.

## 4. Snapshot invariant

If a Workflow selected Offering revision `N`, Scheduler operations for that selection use the demand derived from `N` until an explicit Workflow operation creates/reselects a new demand.

```text
Services catalog head N+1
!= silent mutation of SchedulingDemand N
```

G2-S6 executable evidence proves this with materially different N and N+1 duration, capability, resource-kind and buffer semantics.

## 5. Materialization contract

Canonical handoff implementation:

```text
ServicesSelectionSnapshot
→ materializeSchedulingDemandFromServicesSnapshot(...)
→ validate canonical SchedulingDemand
→ persistSchedulingDemandImmutable(...)
→ scheduler_demands
```

The materializer:

```text
requires matching Service/Offering business + service identity
requires active frozen Service and Offering for new demand creation
requires a valid ServiceSchedulingProfile
copies Service revision by value
copies Offering revision + duration by value
copies capacity/capabilities/buffers by value
never looks up mutable Services head
```

## 6. Durable demand identity

Persistence is immutable and replay-safe:

```text
same demandId + same canonical frozen material
→ replay existing demand
→ same snapshot hash
→ no duplicate

same demandId + different canonical material
→ DEMAND_MATERIAL_CONFLICT
→ rollback
→ original demand unchanged
```

The current Scheduler schema makes `demand_id` globally unique; G2-S6 therefore serializes concurrent materialization on that durable identity.

## 7. Persistence decoupling

`scheduler_demands` intentionally has no foreign key to `service_catalog` or `service_products`.

That is a correctness property:

```text
Services current head = mutable catalog truth
Scheduler demand       = immutable operational input
```

Services can publish N+1 without changing demand N. Scheduler availability/hold/reservation logic can reload demand N from PostgreSQL without consulting current Services catalog.

## 8. Resource abstraction

Services may require abstract capabilities such as:

```text
WASH_BAY
VETERINARIAN
XRAY_MACHINE
DELIVERY_VEHICLE
CONSULTATION_ROOM
```

It must not smuggle generic concrete identities such as `employee_42` or `bay_3` into the scheduling profile. A commercial offering that genuinely names a specific concrete resource would require a separately designed explicit relationship rather than weakening this generic boundary.

## 9. Query contract

```ts
type QueryAvailabilityInput = Readonly<{
  businessSlug: string;
  requestId: string;
  demand: SchedulingDemand;
  window: {
    startAt: string;
    endAt: string;
    timeZone: string;
  };
  preferredResourceIds?: readonly string[];
  limit?: number;
}>;
```

Output is advisory `SlotCandidate[]`; no availability response reserves capacity.

## 10. Hold / reservation boundary

Scheduler alone turns advisory availability into capacity protection or durable allocation.

```text
SchedulingDemand
→ QueryAvailability
→ optional CreateHold
→ ConfirmReservation with commit-time revalidation
```

Candidates/holds never authorize skipping current-truth validation.

## 11. G2-S6 executable proof

Implementation candidate exact head `9d6af52e5749e83469e7d4aca89775753ea2f4e5` passed independently in push and PR contexts.

It proves:

```text
Services N is persisted and projected
snapshot N is frozen by value
demand N persists with exact revisions + snapshot_hash
identical demand retry replays
Scheduler reloads demand N and resolves N-compatible resource semantics
Services publishes materially different N+1
demand N remains unchanged after N+1
demand N continues driving N Scheduler behavior
new demand N+1 sees N+1 semantics
Scheduler reloads N+1 and resolves N+1-compatible resource semantics
old demandId + N+1 material fails closed
G2-S0..G2-S5 regressions remain green
inherited CTA/Temporal path remains green
```

Exact-final-head push/PR run IDs and artifact digests are maintained on PR #32 after the final seal rather than causing a new unsealed documentation commit.

## 12. Appointment composition target — G2-S7

G2-S6 deliberately does **not** migrate `RegisterNewAppointment`.

The G2-S7 composition target remains:

```text
Appointment Workflow
  → Get/Select frozen Offering snapshot
  → derive/persist SchedulingDemand
  → QueryAvailability
  → choose SlotCandidate
  → optional CreateHold
  → explicit Finalize
  → ConfirmReservation atomically
  → persist/reference Scheduler reservation in Appointment result
```

`availability shown != reservation persisted` remains mandatory.

## 13. Failure semantics

Scheduler domain failures remain typed, including:

```text
BUSINESS_SCOPE_NOT_FOUND
SCHEDULING_DEMAND_INVALID
CAPABILITY_UNSATISFIED
NO_AVAILABILITY
SLOT_NO_LONGER_AVAILABLE
CAPACITY_CONFLICT
RESOURCE_INACTIVE
HOLD_NOT_FOUND
HOLD_EXPIRED
RESERVATION_NOT_FOUND
RESERVATION_REVISION_CONFLICT
IDEMPOTENCY_MATERIAL_CONFLICT
```

G2-S6 handoff adds fail-closed materialization outcomes including `SCHEDULING_PROFILE_MISSING`, `SNAPSHOT_SCOPE_MISMATCH` and `DEMAND_MATERIAL_CONFLICT`.

## 14. Non-claims

G2-S6 does not certify Appointment→Scheduler orchestration, multi-resource assignment/search, broad Integration Engine behavior, reservation cancel/complete lifecycle, or final Scheduler production readiness. Those remain later gates.
