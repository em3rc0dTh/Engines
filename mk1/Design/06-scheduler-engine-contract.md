# G2 — Scheduler Engine Contract

## Status

**G2-S0 + G2-S1 + G2-S2 + G2-S3 + G2-S4 + G2-S5 CERTIFIED — G2-S6 NEXT**

The Scheduler Engine is the platform authority for concrete time/resource feasibility and allocation lifecycle. G2-S0 freezes contracts and PostgreSQL foundation; G2-S1 certifies versioned/idempotent management; G2-S2 certifies deterministic one-resource availability; G2-S3 certifies atomic direct reservation confirmation under concurrent last-capacity contention; G2-S4 certifies persisted hold creation/release/consumption plus logical expiry; G2-S5 certifies that those semantics remain isolated and generic across materially different businesses without vertical/provider branches.

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

`confirmReservationAtomic(...)` revalidates current Scheduler truth at commit time before persisting a reservation.

Certified direct-confirmation sequence:

```text
BEGIN
  validate canonical command + immutable demand
  acquire business+operation idempotency lock
  replay identical prior successful operation if present
  reject same operation identity + different material
  resolve advisory candidate to one resource
  acquire business+resource capacity serialization lock
  lock resource row FOR UPDATE
  require resource ACTIVE and unchanged timezone identity
  re-run deterministic availability for the requested slot
  classify capacity disappearance as CAPACITY_CONFLICT
  classify other stale-candidate failure as SLOT_NO_LONGER_AVAILABLE
  persist immutable demand snapshot if new
  insert reservation + assignment + successful command result
COMMIT
```

Any failure rolls the transaction back.

## 6. Critical G2-S3 concurrency invariant

```text
two concurrent confirmations for the final unit of capacity
→ exactly one RESERVED success
→ exactly one typed CAPACITY_CONFLICT
→ exactly one reservation row
→ exactly one assignment row
→ exactly one successful ConfirmReservation command row
→ loser commits no reservation / assignment / command business effect
```

The lock identity is deterministic and scoped to `businessSlug + resourceId`.

## 7. Commit-time stale-candidate rule

A previously returned candidate is advisory, never authority. Current Scheduler truth is revalidated at confirmation.

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

### CreateHold

A hold is created only from a currently feasible advisory candidate. Its persisted occupied interval includes demand buffers. Command ledger and hold mutation commit atomically.

### ReleaseHold

Explicit release transitions an eligible hold to `RELEASED` durably and replay-safely.

### Logical expiry

```text
hold.status = ACTIVE
AND hold.expires_at > asOf
→ blocking allocation

hold.status = ACTIVE
AND hold.expires_at <= asOf
→ logically expired, non-blocking allocation
```

Cleanup may later persist `EXPIRED`; cleanup timing is not part of free/busy correctness. Fresh PostgreSQL Pool re-entry proves restart cannot resurrect an expired blocking hold.

### Hold consumption

Valid unexpired hold consumption, reservation/assignment persistence, `ACTIVE → CONSUMED`, and successful command result share one transaction. Expired hold returns `HOLD_EXPIRED` and commits zero reservation/command effect.

## 10. G2-S5 — certified multi-business generality

G2-S5 proves business scope is a correctness boundary, not a naming convention.

The same unmodified Scheduler implementation executed two materially different businesses:

```text
Business A: BAY  + ALPHA_CAPABILITY + 30m + 5/5 buffers + 08:00–12:00
Business B: ROOM + BETA_CAPABILITY  + 45m + 0/10 buffers + 07:30–15:30
```

Certified invariants:

```text
resource/capability/schedule reads remain business-scoped
availability remains business-scoped
holds remain business-scoped
reservations remain business-scoped
scheduler_commands idempotency identity is (businessSlug, operationId)
same operationId can execute independently in two businesses
same resource code can exist independently in two businesses
cross-business schedule→resource reference fails closed
cross-business demand scope fails closed
cross-business preferred resource yields no candidate
cross-business hold reference fails closed
capacity exhaustion in business A does not alter business B
no fixture/provider/channel branch exists in Scheduler core
```

Business differences are represented as data. No customer-specific runtime branch was added for this proof.

## 11. Capacity/time semantics

Capacity feasibility applies to the occupied interval, including demand buffers. Persisted instants remain explicit offset/UTC values; Scheduler receives canonical instants and explicit IANA timezones. No implicit server-local time is permitted.

Availability and hold correctness accept an explicit logical evaluation instant for deterministic certification and restart-safe semantics.

## 12. PostgreSQL authority

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

Composite business-scoped foreign keys protect resource/schedule/hold/reservation relationships where declared. The durable command ledger is unique on `(business_slug, operation_id)`.

MongoDB may hold semantic/audit evidence but never active free/busy truth.

## 13. Current truth boundary

G2-S5 certifies multi-business isolation/generality for the already-certified Scheduler management, availability, hold and reservation semantics.

It does **not** yet certify runtime Services→SchedulingDemand derivation, mutable catalog-head isolation of that runtime handoff, Appointment→Scheduler migration, multi-resource search/optimization, reservation cancel/complete lifecycle, Integration Engine behavior, or final production readiness.

Appointment integration remains G2-S7.

## 14. Later gates

```text
G2-S6  Services runtime SchedulingDemand integration
G2-S7  Appointment Workflow integration
G2-S8  multi-resource assignment proof or explicit deferral
G2-S9  final clean Scheduler certification
```

## 15. Certification path

```text
G2-S0 contract + persistence foundation                       ✅ CERTIFIED
G2-S1 resource/capability/schedule management                ✅ CERTIFIED
G2-S2 deterministic availability reads                      ✅ CERTIFIED
G2-S3 atomic single-resource reservation conflict           ✅ CERTIFIED
G2-S4 holds + expiry/replay                                  ✅ CERTIFIED
G2-S5 multi-business generality                              ✅ CERTIFIED
G2-S6 Services snapshot integration                         ⏭️ NEXT
G2-S7 Appointment Workflow integration                      OPEN
G2-S8 multi-resource assignment or explicit deferral proof  OPEN
G2-S9 final clean certification                             OPEN
```

No gate advances without dedicated CI, predecessor regressions, terminal marker, artifact digest, receipt/non-claims, machine-ledger transition and exact-final-head rerun.

## 16. G2-S6 frozen proof target

G2-S6 owns the runtime boundary that creates a canonical immutable `SchedulingDemand` from a frozen Services Offering revision.

Required proof:

```text
resolve one concrete Services Service + Offering revision N
materialize SchedulingDemand by value from N
preserve business, service/offering revision identity, duration, capacity/capabilities and buffers
persist/use demand without FK/read dependency on mutable Services catalog head
advance Services Offering head to N+1 with materially different scheduling fields
prove the already-materialized demand N remains unchanged
prove Scheduler continues to use N for that demand
materialize a new demand from N+1 and prove it contains N+1 material
reject wrong-business or nonexistent/stale snapshot identity
preserve G2-S0..G2-S5 regressions
```

This gate does not rewrite `RegisterNewAppointment`; orchestration migration remains G2-S7.

## 17. Bounded claim

The Scheduler Engine is certified to deterministically compute one-resource availability, atomically commit a one-resource reservation under concurrent contention, manage durable one-resource holds with restart-safe persisted-time expiry, and preserve all of those semantics across materially different business scopes with business-scoped idempotency and no vertical/provider runtime branches.

Services runtime handoff and later orchestration integrations remain explicitly unclaimed until their own gates pass.
