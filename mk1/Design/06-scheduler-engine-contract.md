# G2 — Scheduler Engine Contract

## Status

**G2-S0 through G2-S8 CERTIFIED — G2-S9 NEXT**

The Scheduler Engine is the platform authority for concrete time/resource feasibility and allocation lifecycle. The certified path covers contract/persistence foundation, resource and schedule management, deterministic availability, atomic reservations, durable holds, multi-business isolation, frozen Services demand handoff, Scheduler-backed Appointment orchestration, and bounded real multi-resource atomicity.

Final exact-head run IDs and artifact digests are recorded on PR #32 after a documentation-complete seal so the branch is not mutated merely to copy its own CI metadata.

## 1. Responsibility and authority boundary

> **Given one immutable scheduling demand, determine feasible time/resource allocations and commit/release them safely under concurrency.**

Scheduler owns:

```text
resources
capabilities
schedule templates and overrides
capacity
availability generation
holds
reservations
resource assignments
capacity conflicts
Scheduler operation identity/replay
```

Scheduler does **not** own:

```text
Service/Offering commercial semantics
Customer profiles
Appointment conversation/domain orchestration
provider/channel rendering
payment execution
external provider integrations
```

Canonical authority chain:

```text
Services    = catalog/commercial + abstract scheduling semantics
Scheduler   = concrete time/resource allocation
Temporal    = durable orchestration authority
Appointment = domain projection and interaction state
PostgreSQL  = transactional operational truth
MongoDB     = semantic/audit evidence, not active free/busy truth
ObjectStore = attachment bytes/content integrity
```

## 2. Certified domain baseline

### SchedulerResource

Business-scoped, revisioned, explicitly time-zoned and capacity-bounded. Resource kind and capability remain data, never product/vertical runtime branches.

### Schedule

Recurring weekly schedule windows and exceptional `AVAILABLE`, `UNAVAILABLE`, and `CAPACITY` overrides remain separate Scheduler truth surfaces.

### SchedulingDemand

`SchedulingDemand` is the immutable Services → Scheduler handoff. It freezes by value:

```text
business scope
durable demand identity
Service identity + revision
Offering identity + revision
duration
capacity units
abstract capability/resource-kind requirements
pre/post buffers
```

Once persisted, Scheduler executes from that frozen material without re-reading mutable Services catalog head.

### SlotCandidate

`SlotCandidate` is deterministic and advisory. It is never persisted as reservation truth. From G2-S8 onward a candidate may contain multiple concrete assignments when the demand requires multiple independent capabilities.

### Hold

A `SchedulerHold` is durable PostgreSQL allocation truth with explicit assignments, occupied interval and persisted `expiresAt`. G2-S4 certifies the current one-resource hold lifecycle. G2-S8 does not widen that claim to multi-resource holds.

### Reservation

A `SchedulerReservation` is persisted PostgreSQL allocation truth with explicit resource assignments and revision/status lifecycle. G2-S8 proves that one reservation may atomically own multiple assignment rows.

## 3. G2-S0 — contract + persistence foundation

Certified foundation includes Scheduler contract surface, resource/capability persistence, schedule/override persistence, immutable demand persistence, hold/reservation assignment schema, business-scoped relational isolation, Scheduler command identity ledger, advisory/non-persisted `SlotCandidate`, and a provider-agnostic Scheduler core.

The historical G2-S0 regression guard is forward-compatible: later Appointment integration may consume Scheduler while the Scheduler foundation remains decoupled from Appointment-specific orchestration.

## 4. G2-S1 — management semantics

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

## 5. G2-S2 — deterministic one-resource availability

The certified one-resource availability primitive evaluates business scope, ACTIVE status, capability code/quantity, resource-kind constraints, weekly schedules, overrides, reservations, logically-unexpired holds, buffers, segment-wise capacity, granularity, preferred resource IDs and limits.

Stable order:

```text
startAt ASC
endAt ASC
assignment resource IDs ASC
candidateId ASC
```

Candidate identity derives from canonical business/demand/time/assignment material, never randomness or response metadata.

## 6. G2-S3 — atomic one-resource reservation

`confirmReservationAtomic(...)` revalidates current Scheduler truth at commit time before persisting a reservation.

```text
BEGIN
  validate command + immutable demand
  lock business+operation idempotency key
  replay identical prior successful operation if present
  reject same operation identity + changed material
  resolve advisory candidate
  lock resource capacity
  lock resource row FOR UPDATE
  require ACTIVE
  re-run deterministic availability
  classify capacity loss / stale slot
  persist immutable demand if new
  insert reservation + assignment + successful command
COMMIT
```

Final-unit concurrency is certified as exactly one winner and one zero-effect loser.

## 7. Replay / idempotency

```text
same successful operationId + same material
→ same durable result
→ replayed = true
→ no duplicate mutation

same operationId + changed material
→ IDEMPOTENCY_MATERIAL_CONFLICT
→ no second mutation
```

Scheduler command identity is business-scoped.

## 8. G2-S4 — holds, expiry and consumption

Certified semantics include durable hold create/release/replay, persisted logical expiry independent of process timers, restart/re-entry correctness, atomic valid-hold consumption, `ACTIVE → CONSUMED`, and expired-hold zero-effect failure.

Current certification boundary remains one concrete resource per hold.

## 9. G2-S5 — multi-business generality

The same Scheduler implementation proves business-scoped resource/capability/schedule/availability/hold/reservation/command state, same operation ID reuse across businesses, same resource code reuse across businesses, closed cross-business references and isolation of capacity exhaustion.

Business differences remain data rather than runtime forks.

## 10. G2-S6 — Services frozen-revision handoff

Services owns abstract scheduling semantics through versioned scheduling profiles:

```text
capacityUnits
requiredCapabilities[].code
requiredCapabilities[].quantity
requiredCapabilities[].resourceKinds?
buffers.beforeMinutes
buffers.afterMinutes
```

Runtime handoff:

```text
ServicesSelectionSnapshot
→ materialize SchedulingDemand by value
→ validate
→ persist scheduler_demands + snapshot_hash
→ Scheduler executes from frozen demand
```

The N→N+1 proof certifies that demand N retains its original scheduling semantics after mutable Services head advances, while a new demand sees N+1.

## 11. G2-S7 — Scheduler-backed Appointment orchestration

Canonical path:

```text
Services exact selection revision
→ freeze SchedulingDemand
→ Scheduler QueryAvailability
→ advisory SlotCandidate
→ user slot selection
→ explicit Finalize
→ atomic ConfirmReservation
→ appointments.scheduler_reservation_id
→ CTA/domain terminal projection
```

Temporal remains orchestration authority. Scheduler never becomes Customer or Appointment authority.

Successful migrated Appointment truth uses `scheduler_reservations` plus `scheduler_reservation_assignments`; `appointments.resource_reservation_id` remains NULL on the migrated path, so there is no legacy shadow allocation.

Finalization uses deterministic operation identity:

```text
appointment-finalize:<workflowId>
```

Retries replay the same Scheduler reservation. If Scheduler confirmation succeeds but downstream Appointment persistence permanently fails, ordinary retries first reuse the confirmed result; only after configured retry exhaustion does bounded saga compensation lock the operation/resource/reservation, verify no Appointment reference, transition `RESERVED → CANCELLED`, and preserve immutable command evidence.

That compensation is not a generalized public cancellation lifecycle.

G2-S7 remains a one-resource Appointment product slice.

## 12. G2-S8 — certified multi-resource atomicity

### 12.1 Scope

G2-S8 implements a minimal real multi-resource Scheduler path rather than a paper deferral.

Canonical certified fixture:

```text
SchedulingDemand
  ├── BAY_ACCESS → one concrete BAY
  └── TECHNICIAN → one concrete TECHNICIAN
       ↓
deterministic joint availability
       ↓
atomic multi-resource confirmation
```

The bounded semantics are:

```text
one distinct concrete resource per required capability demand
one canonical query timezone across the selected set
demand.capacityUnits consumed by each assignment
candidate assignments ordered by resourceId
capacity locks acquired by resourceId in deterministic order
complete joint candidate revalidated at commit
one reservation + all assignment rows + command result commit atomically
```

### 12.2 Joint availability

`queryDeterministicMultiResourceAvailability(...)` composes the already-certified one-resource availability primitive independently for each capability demand, intersects matching time intervals, rejects reuse of the same concrete resource for two capability demands, and emits canonical joint candidates.

This is deterministic composition, not a solver. No best-fit or optimization score is certified.

### 12.3 Atomic confirmation

`confirmMultiResourceReservationAtomic(...)` uses the same business-scoped command-ledger identity model as G2-S3, but serializes the full selected resource set.

```text
BEGIN
  lock operation identity
  if successful command already exists:
    validate identical material/result identity
    replay durable reservation immediately

  resolve current joint candidate for new operation
  sort assignments by resourceId
  lock each scheduler-capacity key in that order
  lock all selected resource rows in the same order
  require every selected resource ACTIVE
  revalidate complete joint candidate
  persist immutable demand if new
  insert one reservation
  insert every resource assignment
  insert successful command result
COMMIT
```

The durable replay check intentionally precedes current availability resolution. A successful reservation consumes its own slot; therefore current free/busy state cannot be used as a replay gate.

### 12.4 Concurrency invariant

The dedicated PostgreSQL proof races two distinct operations for the same final BAY + TECHNICIAN pair/time interval:

```text
exactly one confirmation succeeds
exactly one fails closed
winner has one reservation + both assignments + command result
loser has zero reservation / assignment / command effect
```

Deterministic resource lock ordering avoids operation-specific lock-order drift.

### 12.5 Explicit non-claims

G2-S8 does not certify:

```text
multi-resource hold create/consume
solver / optimization / scoring / best-fit / routing
heterogeneous candidate display timezones
generalized staff shift / travel / sequence planning
Appointment consuming multi-resource demands
generalized cancellation/completion lifecycle
```

G2-S4 holds and the G2-S7 Appointment product path retain their existing one-resource boundaries.

## 13. Forward-compatible predecessor gates

Historical S0/S3/S4/S5/S6 guards protect the durable producer invariant:

```text
later consumers may use Scheduler
BUT
Scheduler foundation/reservation/hold/multi-business/Services-handoff core
must not import or branch on Appointment/provider-specific orchestration
```

G2-S8 continues that provider/channel-agnostic rule.

## 14. Capacity/time semantics

Capacity feasibility applies to occupied intervals including demand buffers. Persisted instants remain explicit offset/UTC values; Scheduler receives canonical instants and explicit IANA timezones. No implicit server-local time is permitted.

The current G2-S8 joint-candidate proof requires a common canonical query timezone across the selected resource set. Cross-timezone optimization is not claimed.

## 15. PostgreSQL authority

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

Composite business-scoped foreign keys protect declared relationships. The command ledger is unique on `(business_slug, operation_id)`. Immutable demand input is persisted by value with `snapshot_hash` and no live Services foreign-key coupling.

Multi-resource certification uses the existing normalized assignment table; no second allocation authority is introduced.

## 16. Certification path

```text
G2-S0 contract + persistence foundation                       ✅ CERTIFIED
G2-S1 resource/capability/schedule management                ✅ CERTIFIED
G2-S2 deterministic availability reads                      ✅ CERTIFIED
G2-S3 atomic single-resource reservation conflict           ✅ CERTIFIED
G2-S4 holds + expiry/replay                                  ✅ CERTIFIED
G2-S5 multi-business generality                              ✅ CERTIFIED
G2-S6 Services snapshot/demand integration                   ✅ CERTIFIED
G2-S7 Appointment Workflow integration                       ✅ CERTIFIED
G2-S8 multi-resource assignment + atomicity                  ✅ CERTIFIED
G2-S9 final clean certification                              ⏭️ NEXT
```

No gate may advance until the predecessor has dedicated CI, protected predecessor regressions, terminal marker, artifact evidence, receipt/non-claims, machine-ledger transition, and same-gate exact-final-head rerun.

## 17. G2-S9 frozen target

G2-S9 adds no normal feature scope. It is the final clean Scheduler closure over G2-S0 through G2-S8 plus protected Services, Appointment, CTA/channel and persistence regressions.

It must verify documentation/ledger consistency, run the full Scheduler proof chain from a pristine laboratory, emit final evidence and terminal marker, and preserve every explicit non-claim. It must not silently widen G2-S8 into solver/optimization or multi-resource holds.

## 18. Truth boundary

G2-S8 certifies bounded deterministic multi-resource availability and all-or-nothing reservation across multiple concrete resources. It does **not** certify production readiness, a generalized optimization engine, multi-resource holds, generalized cancellation lifecycle, Integration Engine provider behavior, or Agent/MCP intelligence.

## 19. Bounded claim

The Scheduler Engine is certified through G2-S8 for deterministic resource scheduling, durable one-resource holds, one- and multi-resource atomic reservations, multi-business isolation, immutable Services revision handoff, Scheduler-backed one-resource Appointment orchestration, replay/idempotency, and bounded failure compensation.

G2-S9 is the final Scheduler closure. Certification does not authorize merge; PR #32 remains draft/unmerged and continued work remains on `build/g2-scheduler`.
