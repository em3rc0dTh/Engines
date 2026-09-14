# G2 — Scheduler Engine Contract

## Status

**G2-S0 + G2-S1 + G2-S2 + G2-S3 CERTIFIED — G2-S4 NEXT**

The Scheduler Engine is the platform authority for concrete time/resource feasibility and allocation lifecycle. G2-S0 freezes contracts and PostgreSQL foundation; G2-S1 certifies versioned/idempotent management; G2-S2 certifies deterministic one-resource availability; G2-S3 certifies atomic direct reservation confirmation under concurrent last-capacity contention.

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
persisted ACTIVE holds
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
→ return same reservation identity
→ replayed = true
→ no duplicate reservation

same operationId + different material
→ IDEMPOTENCY_MATERIAL_CONFLICT
→ no second mutation
```

## 9. Capacity/time semantics

Capacity feasibility applies to the occupied interval, including demand buffers. Persisted instants remain explicit offset/UTC values; Scheduler receives canonical instants and explicit IANA timezones. No implicit server-local time is permitted.

## 10. PostgreSQL authority

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

## 11. G2-S3 truth boundary

G2-S3 certifies **direct candidate confirmation only**. It does not implement or certify hold creation, hold consumption, logical expiry, restart recovery or cleanup semantics. `holdId` consumption belongs to G2-S4.

It also does not certify reservation cancellation/completion lifecycle, general multi-business behavior, runtime Services→SchedulingDemand creation, Appointment→Scheduler migration, multi-resource search/optimization, or final production readiness.

Passing G2-S3 removes the conflict-correctness blocker for later Appointment work but does not migrate Appointment automatically. Appointment integration remains G2-S7.

## 12. Later gates

```text
G2-S4  holds + logical expiry + replay/restart
G2-S5  multi-business generality
G2-S6  Services runtime SchedulingDemand integration
G2-S7  Appointment Workflow integration
G2-S8  multi-resource assignment proof or explicit deferral
G2-S9  final clean Scheduler certification
```

## 13. Certification path

```text
G2-S0 contract + persistence foundation                       ✅ CERTIFIED
G2-S1 resource/capability/schedule management                ✅ CERTIFIED
G2-S2 deterministic availability reads                      ✅ CERTIFIED
G2-S3 atomic single-resource reservation conflict           ✅ CERTIFIED
G2-S4 holds + expiry/replay                                  ⏭️ NEXT
G2-S5 multi-business generality                              OPEN
G2-S6 Services snapshot integration                         OPEN
G2-S7 Appointment Workflow integration                      OPEN
G2-S8 multi-resource assignment or explicit deferral proof  OPEN
G2-S9 final clean certification                             OPEN
```

No gate advances without dedicated CI, predecessor regressions, terminal marker, artifact digest, receipt/non-claims, machine-ledger transition and exact-final-head rerun.

## 14. Bounded claim

The Scheduler Engine is now certified to deterministically compute one-resource availability and to atomically commit a direct one-resource reservation under concurrent last-capacity contention with typed conflict, replay/idempotency and zero partial loser effects.

Logical hold lifecycle and later orchestration integrations remain explicitly unclaimed until their own gates pass.
