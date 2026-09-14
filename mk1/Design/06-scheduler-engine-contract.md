# G2 — Scheduler Engine Contract

## Status

**G2-S0 + G2-S1 + G2-S2 + G2-S3 + G2-S4 + G2-S5 + G2-S6 CERTIFIED — G2-S7 NEXT**

The Scheduler Engine is the platform authority for concrete time/resource feasibility and allocation lifecycle. G2-S0 freezes contracts and PostgreSQL foundation; G2-S1 certifies versioned/idempotent management; G2-S2 certifies deterministic one-resource availability; G2-S3 certifies atomic direct reservation under concurrent last-capacity contention; G2-S4 certifies persisted hold lifecycle and logical expiry; G2-S5 certifies multi-business generality/isolation; G2-S6 certifies the runtime Services frozen-revision → immutable `SchedulingDemand` handoff.

Final exact-head G2-S6 run IDs and artifact digests are recorded on PR #32 after the documentation-complete branch seal so no post-seal branch commit is required.

## 1. Responsibility

> **Given one immutable scheduling demand, determine feasible time/resource allocations and commit/release them safely under concurrency.**

Scheduler owns resources, capabilities, schedule templates/overrides, capacity, availability generation, holds, reservations, assignments, booking conflicts and reservation lifecycle. It does not own Service/Offering commercial semantics, Customer profiles, Appointment conversation state, channel/provider rendering, payment execution or external provider integrations.

## 2. Certified domain baseline

### Resource

`SchedulerResource` is business-scoped, revisioned, explicitly time-zoned and capacity-bounded. Resource kind and capability remain data, not vertical runtime branches.

### Schedule

Recurring weekly schedules and exceptional `AVAILABLE`, `UNAVAILABLE`, `CAPACITY` overrides remain separate Scheduler truth surfaces.

### SchedulingDemand

`SchedulingDemand` is the immutable Services → Scheduler handoff. It freezes:

```text
business scope
durable demand identity
Service identity + revision
Offering identity + revision
Offering duration
requested capacity
abstract capability/resource-kind requirements
pre/post buffers
```

Once persisted, Scheduler operates from this frozen material without re-reading current Services catalog head.

### SlotCandidate

`SlotCandidate` is advisory and deterministic. It is never persisted as reservation truth.

### Hold

A `SchedulerHold` is durable PostgreSQL allocation truth with explicit assignments, an occupied interval and persisted `expiresAt`. An `ACTIVE` physical row blocks capacity only while logically unexpired at the evaluation `asOf` instant.

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

Successful mutation and `scheduler_commands` operation identity commit atomically. Same operation + same canonical material replays. Same operation + different material fails closed. Stale revisions and cross-business mutations cannot partially mutate state.

## 4. G2-S2 — certified deterministic availability

The certified availability baseline is one-resource demand. It evaluates:

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
  re-run deterministic availability for requested slot
  classify capacity disappearance as CAPACITY_CONFLICT
  classify other stale-candidate failure as SLOT_NO_LONGER_AVAILABLE
  persist immutable demand snapshot if new
  insert reservation + assignment + successful command result
COMMIT
```

Critical invariant:

```text
two concurrent confirmations for the final unit of capacity
→ exactly one RESERVED success
→ exactly one typed CAPACITY_CONFLICT
→ exactly one reservation row
→ exactly one assignment row
→ exactly one successful ConfirmReservation command row
→ loser commits no reservation / assignment / command business effect
```

`availability shown != reservation persisted` remains enforced.

## 6. Replay/idempotency

```text
same successful operationId + same material
→ same durable result
→ replayed = true
→ no duplicate mutation

same operationId + different material
→ IDEMPOTENCY_MATERIAL_CONFLICT
→ no second mutation
```

Scheduler command operation identity is business-scoped.

## 7. G2-S4 — certified hold lifecycle

Certified semantics:

```text
CreateHold from currently feasible candidate
occupied interval includes demand buffers
ReleaseHold → RELEASED
same-operation replay
changed-material conflict
persisted expiresAt
logical expiry from persisted time, independent of cleanup timing
fresh PostgreSQL Pool preserves expiry truth
valid hold consumed atomically with reservation
ACTIVE → CONSUMED on successful consumption
expired hold → HOLD_EXPIRED
expired-hold failure commits zero reservation/command effect
```

## 8. G2-S5 — certified multi-business generality

The same unmodified Scheduler implementation proves:

```text
resource/capability/schedule reads remain business-scoped
availability remains business-scoped
holds remain business-scoped
reservations remain business-scoped
scheduler_commands identity is (businessSlug, operationId)
same operationId can execute independently in two businesses
same resource code can exist independently in two businesses
cross-business schedule→resource reference fails closed
cross-business demand scope fails closed
cross-business preferred resource yields no candidate
cross-business hold reference fails closed
capacity exhaustion in business A does not alter business B
no fixture/provider/channel branch exists in Scheduler core
```

Business differences remain data rather than runtime forks.

## 9. G2-S6 — certified Services frozen-revision handoff

### Services authority

Services owns versioned abstract scheduling semantics through `ServiceSchedulingProfile`:

```text
capacityUnits
requiredCapabilities[].code
requiredCapabilities[].quantity
requiredCapabilities[].resourceKinds?
buffers.beforeMinutes
buffers.afterMinutes
```

Offering `durationMinutes` remains Services catalog truth. The scheduling profile contains no concrete Scheduler resource/schedule/hold/reservation identity.

### Runtime materializer

```text
ServicesSelectionSnapshot
→ materializeSchedulingDemandFromServicesSnapshot(...)
→ SchedulingDemand
→ persistSchedulingDemandImmutable(...)
→ scheduler_demands
```

The materializer consumes a frozen snapshot and never fetches mutable Services head. It requires Service/Offering business and parent identity consistency, active frozen lifecycle, a valid scheduling profile and a valid resulting `SchedulingDemand`.

### Immutable demand persistence

Demand material is hashed from canonical frozen value. Persistence is serialized on durable `demandId` and is fail-closed:

```text
same demandId + same material
→ replay
→ same snapshot hash
→ no duplicate row

same demandId + different material
→ DEMAND_MATERIAL_CONFLICT
→ rollback
→ original demand unchanged
```

`scheduler_demands` intentionally has no foreign key to mutable Services tables.

### N → N+1 invariant

Executable proof uses materially different scheduling semantics:

```text
revision N
  duration       30m
  capability     G2S6_CAP_N
  resource kind  BAY
  buffers        5 / 5

revision N+1
  duration       60m
  capability     G2S6_CAP_N1
  resource kind  ROOM
  buffers        0 / 15
```

Certified proof:

```text
snapshot N → persisted demand N
Scheduler reloads demand N from PostgreSQL and resolves N semantics
Services catalog advances to N+1
demand N + snapshot_hash remain unchanged
Scheduler still resolves N semantics from persisted demand N
new snapshot N+1 → new persisted demand N+1
Scheduler reloads N+1 and resolves N+1 semantics
old demandId + N+1 material fails closed
G2-S0..G2-S5 regressions remain green
inherited CTA/Temporal path remains green
Appointment remains outside Scheduler
```

Implementation candidate head `9d6af52e5749e83469e7d4aca89775753ea2f4e5` passed push run `34908156644` and PR run `34908161495`. The same G2-S6 workflow is the authority for the documentation-complete exact-head seal.

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

Composite business-scoped foreign keys protect declared relationships. The command ledger is unique on `(business_slug, operation_id)`. Immutable Scheduler demand input is persisted by value with `snapshot_hash` and no live Services foreign-key coupling.

MongoDB may hold semantic/audit evidence but never active free/busy truth.

## 12. Truth boundary

G2-S6 certifies Services frozen-revision → immutable Scheduler demand handoff while preserving G2-S0..G2-S5 behavior.

It does **not** certify Appointment→Scheduler migration, multi-resource search/optimization, reservation cancel/complete lifecycle, Integration Engine behavior, or final Scheduler production readiness.

Appointment integration remains G2-S7.

## 13. Certification path

```text
G2-S0 contract + persistence foundation                       ✅ CERTIFIED
G2-S1 resource/capability/schedule management                ✅ CERTIFIED
G2-S2 deterministic availability reads                      ✅ CERTIFIED
G2-S3 atomic single-resource reservation conflict           ✅ CERTIFIED
G2-S4 holds + expiry/replay                                  ✅ CERTIFIED
G2-S5 multi-business generality                              ✅ CERTIFIED
G2-S6 Services snapshot/demand integration                   ✅ CERTIFIED
G2-S7 Appointment Workflow integration                       ⏭️ NEXT
G2-S8 multi-resource assignment or explicit deferral proof   OPEN
G2-S9 final clean certification                              OPEN
```

No gate executes until the predecessor has dedicated CI, predecessor regressions, terminal marker, artifact evidence, receipt/non-claims, machine-ledger transition and same-gate exact-final-head rerun.

## 14. G2-S7 frozen target

Only after the G2-S6 exact-final-head seal, migrate `RegisterNewAppointment` through certified boundaries:

```text
Services selection snapshot
→ materialize/persist SchedulingDemand
→ QueryAvailability
→ selected SlotCandidate
→ optional CreateHold
→ explicit Finalize
→ ConfirmReservation
→ Appointment result references Scheduler reservation
```

The Workflow must preserve:

```text
Temporal orchestration authority
availability shown != reservation persisted
Scheduler does not become Appointment/Customer authority
replay/idempotency under Workflow retry
commit-time current-capacity revalidation
provider/channel mechanics outside Workflow business logic
existing CTA compatibility/regressions
```

## 15. Bounded claim

The Scheduler Engine is certified through G2-S6 for one-resource scheduling semantics, durable holds/reservations, multi-business isolation and immutable Services revision handoff. Appointment integration and later closure gates remain explicitly unclaimed until their dedicated proofs pass.
