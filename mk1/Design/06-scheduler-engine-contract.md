# G2 — Scheduler Engine Contract

## Status

**G2-S0 + G2-S1 + G2-S2 + G2-S3 + G2-S4 + G2-S5 + G2-S6 CANDIDATE CERTIFIED — EXACT-FINAL-HEAD G2-S6 SEAL PENDING**

The Scheduler Engine is the platform authority for concrete time/resource feasibility and allocation lifecycle. G2-S0 freezes contracts and PostgreSQL foundation; G2-S1 certifies versioned/idempotent management; G2-S2 certifies deterministic one-resource availability; G2-S3 certifies atomic direct reservation under concurrent last-capacity contention; G2-S4 certifies persisted hold lifecycle and logical expiry; G2-S5 certifies multi-business generality/isolation; G2-S6 candidate proof certifies the runtime Services frozen-revision → immutable `SchedulingDemand` handoff.

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

Once persisted, Scheduler may operate from this frozen material without re-reading current Services catalog head.

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

Certified sequence:

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

The capacity lock identity is deterministic and scoped to `businessSlug + resourceId`.

## 7. Commit-time stale-candidate rule

A previously returned candidate is advisory, never authority. Current Scheduler truth is revalidated at confirmation.

```text
availability shown != reservation persisted
```

remains an enforced invariant.

## 8. Replay/idempotency

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

The same unmodified Scheduler implementation executed two materially different businesses and proved:

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

Business differences remain data rather than runtime forks.

## 11. G2-S6 — Services frozen-revision handoff

### Services authority

Services owns versioned abstract scheduling semantics for a schedulable Offering through `ServiceSchedulingProfile`:

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

Canonical implementation:

```text
ServicesSelectionSnapshot
→ materializeSchedulingDemandFromServicesSnapshot(...)
→ SchedulingDemand
→ persistSchedulingDemandImmutable(...)
→ scheduler_demands
```

The materializer consumes a frozen snapshot and never fetches mutable Services head. It requires Service/Offering business and parent identity consistency, active frozen lifecycle, a valid scheduling profile, and a valid resulting `SchedulingDemand`.

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

`scheduler_demands` intentionally has no FK to mutable Services tables.

### N → N+1 invariant

Candidate executable proof uses materially different scheduling semantics:

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

It proves:

```text
snapshot N → persisted demand N
Scheduler reloads demand N from PostgreSQL and resolves N semantics
Services catalog advances to N+1
demand N + snapshot_hash remain unchanged
Scheduler still resolves N semantics from persisted demand N
new snapshot N+1 → new persisted demand N+1
Scheduler reloads N+1 and resolves N+1 semantics
old demandId + N+1 material fails closed
```

The proof therefore validates operational use of persisted frozen truth, not merely serialization equality.

### Candidate evidence

Implementation candidate exact head:

```text
9d6af52e5749e83469e7d4aca89775753ea2f4e5
```

Dedicated push `34908156644` and PR `34908161495` both passed contract/boundary, PostgreSQL handoff/predecessor/platform, and seal jobs. Branch documentation/ledger commits after that candidate require the mandatory same-workflow exact-final-head rerun before G2-S6 is called final-head certified.

## 12. Capacity/time semantics

Capacity feasibility applies to the occupied interval, including demand buffers. Persisted instants remain explicit offset/UTC values; Scheduler receives canonical instants and explicit IANA timezones. No implicit server-local time is permitted.

Availability and hold correctness accept an explicit logical evaluation instant for deterministic certification and restart-safe semantics.

## 13. PostgreSQL authority

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

## 14. Current truth boundary

G2-S6 candidate proof certifies the Services frozen-revision → immutable Scheduler demand handoff while preserving G2-S0..G2-S5 behavior.

It does **not** certify Appointment→Scheduler migration, multi-resource search/optimization, reservation cancel/complete lifecycle, Integration Engine behavior, or final Scheduler production readiness.

Appointment integration remains G2-S7.

## 15. Remaining gates

```text
G2-S7  Appointment Workflow integration
G2-S8  multi-resource assignment proof or explicit deferral
G2-S9  final clean Scheduler certification
```

## 16. Certification path

```text
G2-S0 contract + persistence foundation                       ✅ CERTIFIED
G2-S1 resource/capability/schedule management                ✅ CERTIFIED
G2-S2 deterministic availability reads                      ✅ CERTIFIED
G2-S3 atomic single-resource reservation conflict           ✅ CERTIFIED
G2-S4 holds + expiry/replay                                  ✅ CERTIFIED
G2-S5 multi-business generality                              ✅ CERTIFIED
G2-S6 Services snapshot/demand integration                   🟡 CANDIDATE PASS / FINAL HEAD SEAL PENDING
G2-S7 Appointment Workflow integration                       ⏭️ NEXT AFTER S6 FINAL SEAL
G2-S8 multi-resource assignment or explicit deferral proof   OPEN
G2-S9 final clean certification                              OPEN
```

No gate advances operationally until dedicated CI, predecessor regressions, terminal marker, artifact digest, receipt/non-claims, machine-ledger transition and same-gate exact-final-head rerun are complete.

## 17. G2-S7 frozen target

Only after G2-S6 exact-final-head certification, migrate `RegisterNewAppointment` through the already-certified boundaries:

```text
Services selection snapshot
→ materialize/persist SchedulingDemand
→ QueryAvailability
→ selected SlotCandidate
→ optional hold
→ explicit Finalize
→ ConfirmReservation
→ Appointment result references Scheduler reservation
```

The Workflow must preserve `availability shown != reservation persisted`, Temporal orchestration authority, replay/idempotency and existing CTA/channel compatibility. Scheduler must not become Customer/Appointment authority.

## 18. Bounded claim

The Scheduler Engine is certified through G2-S5 and has a successful independent G2-S6 implementation candidate proving immutable Services revision handoff into Scheduler operational truth. G2-S6 becomes final-head certified only when the documentation-complete exact branch head passes the same dedicated workflow in push and PR contexts.
