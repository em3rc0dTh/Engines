# G2 — Scheduler Engine Contract

## Status

**G2-S0 + G2-S1 + G2-S2 + G2-S3 + G2-S4 CERTIFIED — G2-S5 NEXT**

The Scheduler Engine is the platform authority for concrete time/resource feasibility and allocation lifecycle. G2-S0 freezes contracts and PostgreSQL foundation; G2-S1 certifies versioned/idempotent management; G2-S2 certifies deterministic one-resource availability; G2-S3 certifies atomic direct reservation confirmation under concurrent last-capacity contention; G2-S4 certifies persisted hold creation/release/consumption plus logical expiry that remains correct across process re-entry.

## 1. Responsibility

> **Given one immutable scheduling demand, determine feasible time/resource allocations and commit/release them safely under concurrency.**

Scheduler owns resources, capabilities, schedule templates/overrides, capacity, availability generation, holds, reservations, assignments, booking conflicts and reservation lifecycle. It does not own Service/Offering commercial semantics, Customer profiles, Appointment conversation state, channel/provider rendering, payment execution or external provider integrations.

## 2. Certified domain baseline

### Resource

`SchedulerResource` is business-scoped, revisioned, explicitly time-zoned and capacity-bounded. Resource kind and capability remain data, not vertical runtime branches.

### Schedule

Recurring weekly schedules and exceptional `AVAILABLE`, `UNAVAILABLE`, `CAPACITY` overrides remain separate Scheduler truth surfaces.

### SchedulingDemand

`SchedulingDemand` is the immutable Services → Scheduler handoff. It freezes service/offering revision identity, duration, required capabilities, requested capacity and buffers.

### SlotCandidate

`SlotCandidate` is advisory and deterministic. It is never persisted as reservation truth.

### Hold

A `SchedulerHold` is durable PostgreSQL allocation truth with explicit assignments, an occupancy interval and persisted `expiresAt`. An `ACTIVE` physical row blocks capacity only while it is logically unexpired at the evaluation `asOf` instant.

### Reservation

A `SchedulerReservation` is persisted PostgreSQL allocation truth with explicit resource assignments and revision/status lifecycle.

## 3. G2-S1 — certified management semantics

Certified commands:

```text
CreateResource
UpdateResource
SetResourceStatus
SetScheduleTemplate
PutScheduleOverride
DeleteScheduleOverride
```

Successful mutation and `scheduler_commands` operation identity commit atomically. Same operation + same canonical material replays. Same operation + different material fails closed. Stale revisions and cross-business mutation attempts cannot partially mutate state.

## 4. G2-S2 — certified deterministic availability

The first certified availability path is one-resource demand only. It evaluates:

```text
business scope
ACTIVE resource status
capability code + quantity
optional resource-kind constraints
weekly schedule windows
AVAILABLE / UNAVAILABLE / CAPACITY overrides
RESERVED allocations
persisted ACTIVE and logically-unexpired holds
pre/post buffers
segment-wise effective capacity
configurable granularity
preferred resource IDs
result limit
```

Stable order:

```text
startAt ASC
endAt ASC
assignment resource IDs ASC
candidateId ASC
```

Candidate identity derives from canonical business/demand/time/assignment material, not randomness or response metadata.

## 5. G2-S3 — certified atomic reservation confirmation

`confirmReservationAtomic(...)` is the first certified allocation mutation. A previously returned candidate is not authority. Confirmation revalidates current Scheduler truth at commit time before persisting a reservation.

Certified direct-confirmation sequence:

```text
BEGIN
  validate canonical command + immutable demand
  acquire business+operation idempotency lock
  replay an identical prior successful operation if present
  reject same operation identity + different material
  resolve advisory candidate to one resource
  acquire business+resource capacity serialization lock
  lock resource row FOR UPDATE
  require resource ACTIVE and unchanged timezone identity
  re-run deterministic one-resource availability for the exact requested slot
  classify current capacity disappearance as CAPACITY_CONFLICT
  classify other stale-candidate failure as SLOT_NO_LONGER_AVAILABLE
  persist immutable demand snapshot if new
  insert reservation
  insert reservation assignment
  insert successful scheduler_commands result
COMMIT
```

Any failure rolls the transaction back.

## 6. Critical G2-S3 concurrency invariant

Executable evidence proves:

```text
two concurrent confirmations for the final unit of capacity
→ exactly one RESERVED success
→ exactly one typed CAPACITY_CONFLICT
→ exactly one reservation row
→ exactly one assignment row
→ exactly one successful ConfirmReservation command row
→ loser commits no reservation / assignment / command business effect
```

The lock identity is deterministic and scoped to `businessSlug + resourceId`, so the two competing confirmations serialize before final capacity commitment.

## 7. Commit-time stale-candidate rule

A candidate shown earlier may become invalid before confirmation. G2-S3 proves this by creating a valid candidate, adding an `UNAVAILABLE` override, then confirming the stale candidate. The command returns `SLOT_NO_LONGER_AVAILABLE` with zero reservation, demand or command side effect.

Therefore:

```text
availability shown != reservation persisted
```

remains an enforced invariant.

## 8. Replay/idempotency

```text
same successful operationId + same material
→ return same durable result identity
→ replayed = true
→ no duplicate mutation

same operationId + different material
→ IDEMPOTENCY_MATERIAL_CONFLICT
→ no second mutation
```

The operation identity boundary is business-scoped.

## 9. G2-S4 — certified hold lifecycle

G2-S4 adds durable one-resource hold semantics without weakening G2-S3 atomic reservation correctness.

### CreateHold

A hold is created only from a currently feasible advisory candidate. Its persisted occupied interval includes the demand's before/after buffers. The command ledger and hold mutation commit atomically.

### ReleaseHold

Explicit release transitions an eligible hold to `RELEASED` durably. Same operation + same material replays; operation identity reuse with different material fails closed.

### Logical expiry

Expiry correctness is defined from persisted time:

```text
hold.status = ACTIVE
AND hold.expires_at > asOf
→ blocking allocation

hold.status = ACTIVE
AND hold.expires_at <= asOf
→ logically expired, non-blocking allocation
```

A cleanup process may later persist `EXPIRED`, but cleanup timing is not part of the free/busy correctness boundary.

Executable evidence proves the same logical expiry through a newly created PostgreSQL Pool, so restart/re-entry cannot resurrect an expired blocking hold.

### Hold consumption

A valid unexpired hold may be consumed by reservation confirmation. Hold validation, capacity serialization, reservation/assignment persistence, `ACTIVE → CONSUMED`, and successful command-ledger result share one transactional boundary. An expired hold returns typed `HOLD_EXPIRED` and commits zero reservation/command effect.

## 10. Capacity/time semantics

Capacity feasibility applies to the occupied interval, including demand buffers. Persisted instants remain explicit offset/UTC values; Scheduler receives canonical instants and explicit IANA timezones. No implicit server-local time is permitted.

Availability and hold correctness accept an explicit logical evaluation instant for deterministic certification and restart-safe semantics.

## 11. PostgreSQL authority

Canonical Scheduler truth remains:

```text
scheduler_resources
scheduler_resource_capabilities
scheduler_schedule_templates
scheduler_schedule_windows
scheduler_schedule_overrides
scheduler_demands
scheduler_holds
scheduler_hold_assignments
scheduler_reservations
scheduler_reservation_assignments
scheduler_commands
```

MongoDB may hold semantic/audit evidence but never active free/busy truth.

## 12. G2-S4 truth boundary

G2-S4 certifies one-resource hold creation, release, persisted-time logical expiry, housekeeping projection, replay/idempotency and atomic held reservation consumption.

It does **not** certify general multi-business behavior, runtime Services→SchedulingDemand creation, Appointment→Scheduler migration, multi-resource search/optimization, reservation cancel/complete lifecycle, Integration Engine behavior or final production readiness.

Passing G2-S4 advances the Scheduler correctness prefix but does not migrate Appointment. Appointment integration remains G2-S7.

## 13. Later gates

```text
G2-S5  multi-business generality
G2-S6  Services runtime SchedulingDemand integration
G2-S7  Appointment Workflow integration
G2-S8  multi-resource assignment proof or explicit deferral
G2-S9  final clean Scheduler certification
```

## 14. Certification path

```text
G2-S0 contract + persistence foundation                       ✅ CERTIFIED
G2-S1 resource/capability/schedule management                ✅ CERTIFIED
G2-S2 deterministic availability reads                      ✅ CERTIFIED
G2-S3 atomic single-resource reservation conflict           ✅ CERTIFIED
G2-S4 holds + expiry/replay                                  ✅ CERTIFIED
G2-S5 multi-business generality                              ⏭️ NEXT
G2-S6 Services snapshot integration                         OPEN
G2-S7 Appointment Workflow integration                      OPEN
G2-S8 multi-resource assignment or explicit deferral proof  OPEN
G2-S9 final clean certification                             OPEN
```

No gate advances without dedicated CI, predecessor regressions, terminal marker, artifact digest, receipt/non-claims, machine-ledger transition and exact-final-head rerun.

## 15. G2-S5 frozen proof target

G2-S5 must prove the same Scheduler implementation handles materially different business fixtures without provider/vertical forks and without state bleed:

```text
business-scoped resource/capability/schedule truth
business-scoped availability
business-scoped holds
business-scoped reservations
business-scoped command idempotency
same operationId reusable across different businesses
cross-business references fail closed
capacity consumption in business A cannot affect business B
```

This gate proves generality of the existing semantics; it must not introduce customer-specific runtime branches merely to satisfy fixtures.

## 16. Bounded claim

The Scheduler Engine is certified to deterministically compute one-resource availability, atomically commit a direct one-resource reservation under concurrent last-capacity contention, and manage durable one-resource holds with restart-safe persisted-time expiry, replay/idempotency and atomic held-reservation consumption.

General multi-business proof and later orchestration integrations remain explicitly unclaimed until their own gates pass.
