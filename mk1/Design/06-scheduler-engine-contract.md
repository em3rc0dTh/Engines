# G2 — Scheduler Engine Contract

## Status

**G2-S0 through G2-S7 CERTIFIED — G2-S8 NEXT**

The Scheduler Engine is the platform authority for concrete time/resource feasibility and allocation lifecycle. The certified path now covers contract/persistence foundation, management, deterministic one-resource availability, atomic reservation, durable holds, multi-business isolation, frozen Services demand handoff, and Scheduler-backed Appointment orchestration.

Final exact-head G2-S7 run IDs and artifact digests are recorded on PR #32 after the documentation-complete branch seal so the branch is not mutated merely to copy its own CI metadata.

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
Services   = catalog/commercial + abstract scheduling semantics
Scheduler  = concrete time/resource allocation
Temporal   = durable orchestration authority
Appointment= domain projection and interaction state
PostgreSQL = transactional operational truth
MongoDB    = semantic/audit evidence, not active free/busy truth
ObjectStore= attachment bytes/content integrity
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

`SlotCandidate` is deterministic and advisory. It is never persisted as reservation truth.

### Hold

A `SchedulerHold` is durable PostgreSQL allocation truth with explicit assignments, occupied interval and persisted `expiresAt`. An `ACTIVE` row blocks capacity only while logically unexpired at the evaluation `asOf` instant.

### Reservation

A `SchedulerReservation` is persisted PostgreSQL allocation truth with explicit resource assignments and revision/status lifecycle.

## 3. G2-S0 — contract + persistence foundation

Certified foundation includes:

```text
Scheduler contract surface
resource/capability persistence
schedule/override persistence
immutable demand persistence
hold/reservation assignment schema
business-scoped relational isolation
Scheduler command identity ledger
SlotCandidate advisory/non-persisted invariant
provider-agnostic Scheduler core
```

The historical G2-S0 regression guard is forward-compatible: later Appointment integration may consume Scheduler, while the G2-S0 Scheduler foundation itself remains decoupled from Appointment-specific orchestration.

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

## 5. G2-S2 — deterministic availability

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

## 6. G2-S3 — atomic reservation confirmation

`confirmReservationAtomic(...)` revalidates current Scheduler truth at commit time before persisting a reservation.

```text
BEGIN
  validate command + immutable demand
  acquire business+operation idempotency lock
  replay identical prior successful operation if present
  reject same operation identity + different material
  resolve advisory candidate to one concrete resource
  acquire business+resource capacity serialization lock
  lock resource row FOR UPDATE
  require resource ACTIVE
  re-run deterministic availability for requested slot
  classify last-capacity disappearance as CAPACITY_CONFLICT
  classify other stale candidate failure as SLOT_NO_LONGER_AVAILABLE
  persist immutable demand snapshot if new
  insert reservation + assignment + successful command result
COMMIT
```

Certified concurrency invariant:

```text
two concurrent confirmations for the final unit of capacity
→ exactly one RESERVED success
→ exactly one typed CAPACITY_CONFLICT
→ exactly one reservation row
→ exactly one assignment row
→ exactly one successful ConfirmReservation command
→ loser commits no reservation / assignment / command effect
```

`availability shown != reservation persisted` remains a platform invariant.

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

## 8. G2-S4 — holds, logical expiry and consumption

Certified semantics:

```text
CreateHold from currently feasible candidate
occupied hold interval includes demand buffers
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

Correctness never depends on process-memory timers.

## 9. G2-S5 — multi-business generality

The same unmodified Scheduler implementation proves:

```text
resource/capability/schedule reads remain business-scoped
availability remains business-scoped
holds remain business-scoped
reservations remain business-scoped
scheduler_commands identity is (businessSlug, operationId)
same operationId may execute independently in different businesses
same resource code may exist independently in different businesses
cross-business schedule→resource reference fails closed
cross-business demand scope fails closed
cross-business preferred resource yields no candidate
cross-business hold reference fails closed
capacity exhaustion in business A does not alter business B
no fixture/provider/channel branch exists in Scheduler core
```

Business differences remain data rather than runtime forks.

## 10. G2-S6 — Services frozen-revision handoff

Services owns abstract scheduling semantics through a versioned `ServiceSchedulingProfile`:

```text
capacityUnits
requiredCapabilities[].code
requiredCapabilities[].quantity
requiredCapabilities[].resourceKinds?
buffers.beforeMinutes
buffers.afterMinutes
```

Offering `durationMinutes` remains Services catalog truth. The scheduling profile contains no concrete Scheduler resource/schedule/hold/reservation identity.

Runtime handoff:

```text
ServicesSelectionSnapshot
→ materializeSchedulingDemandFromServicesSnapshot(...)
→ validate canonical SchedulingDemand
→ persistSchedulingDemandImmutable(...)
→ scheduler_demands + snapshot_hash
```

The materializer consumes a frozen snapshot and never fetches mutable Services head.

Immutable demand persistence:

```text
same demandId + same material
→ replay
→ same snapshot hash
→ no duplicate row

same demandId + changed material
→ DEMAND_MATERIAL_CONFLICT
→ rollback
→ original demand unchanged
```

Executable N→N+1 proof certifies that demand N retains its original duration/capability/resource-kind/buffer semantics after Services publishes materially different N+1, while a newly materialized demand sees N+1.

## 11. G2-S7 — certified Appointment orchestration

### 11.1 Canonical path

`RegisterNewAppointment` now consumes the already-certified Services/Scheduler boundary:

```text
Services exact selection revision
→ freeze schedulable selection
→ materialize/persist immutable SchedulingDemand
→ Scheduler QueryAvailability
→ advisory SlotCandidate
→ user selects slot
→ explicit Finalize
→ Scheduler ConfirmReservation
→ Appointment references scheduler_reservation_id
→ CTA/domain terminal projection
```

Temporal remains orchestration authority throughout. Scheduler never becomes Customer or Appointment authority.

### 11.2 Frozen selection

The exact schedulable Services projection shown to a durable Appointment workflow is frozen before user selection. Catalog N→N+1 cannot mutate an active Appointment's persisted demand.

### 11.3 Availability versus commit

Availability is advisory. `Finalize` is the durable reservation boundary.

At `Finalize`, Scheduler revalidates current capacity under the G2-S3 atomic reservation locks. A slot that became unavailable after being shown is not persisted as stale capacity; the workflow projects a typed slot conflict and returns to selection with refreshed availability.

### 11.4 Appointment persistence link

Successful migrated Appointment truth is:

```text
scheduler_reservations              authoritative capacity record
scheduler_reservation_assignments   concrete resource assignment
appointments.scheduler_reservation_id
                                    domain reference to Scheduler truth
appointments.resource_reservation_id
                                    NULL on migrated path
```

G2-S7 certifies **zero legacy ResourceReservation shadow writes** for migrated successful Appointment creation.

### 11.5 Durable retry / replay

Appointment finalization uses deterministic Scheduler operation identity:

```text
appointment-finalize:<workflowId>
```

Therefore:

```text
Temporal Activity retry
→ same Scheduler command identity/material
→ same confirmed reservation replays
→ no duplicate reservation
```

### 11.6 Exhausted-retry saga compensation

G2-S7 certification found and closed the post-confirmation failure gap. Scheduler confirmation is committed before downstream Appointment graph persistence; a permanent downstream failure must not leave orphaned blocking capacity.

Ordinary Activity attempts preserve the confirmed reservation so retry may complete Appointment persistence. Only when the configured Appointment Activity retry budget is exhausted does the S7-specific compensation execute:

```text
resolve appointment-finalize:<workflowId> command
→ lock Scheduler operation
→ lock assigned resource capacity
→ lock reservation row
→ verify no Appointment references reservation
→ if RESERVED: set CANCELLED + increment revision
→ keep immutable ConfirmReservation command as evidence
→ failed workflow/CTA projection remains FAILED
```

The `CANCELLED` reservation is non-blocking to current availability semantics.

This is a **bounded Appointment orchestration compensation**, not a general public Scheduler cancellation lifecycle. General cancellation/completion semantics are not implicitly certified by G2-S7.

### 11.7 One-resource truth boundary

G2-S7 certifies exactly one concrete Scheduler assignment for the current Appointment slice. Generalized multi-resource search/assignment/optimization remains G2-S8.

### 11.8 Provider/channel boundary

Appointment Scheduler bridge and compensation logic contain no Telegram, WhatsApp, TikTok, Messenger, Facebook, Kapso, WebChat, or other provider mechanics. CTA/channel orchestration consumes the canonical Appointment contract and is regression-tested separately.

## 12. Forward-compatible predecessor gates

Historical S0/S3/S4/S5/S6 CI originally encoded temporary “Appointment must not use Scheduler yet” guards. After G2-S7 became authorized, those guards were changed to protect the durable invariant:

```text
later Appointment may consume Scheduler
BUT
Scheduler foundation / reservation / hold / multi-business / Services-handoff core
must not import or branch on Appointment-specific orchestration
```

This preserves earlier certifications without freezing the platform at an earlier construction phase.

## 13. Capacity/time semantics

Capacity feasibility applies to occupied intervals including demand buffers. Persisted instants remain explicit offset/UTC values; Scheduler receives canonical instants and explicit IANA timezones. No implicit server-local time is permitted.

Availability and hold correctness accept an explicit logical evaluation instant for deterministic certification and restart-safe semantics.

## 14. PostgreSQL authority

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

Appointment adds only a reference to Scheduler reservation identity; it does not duplicate Scheduler free/busy truth.

## 15. Certification path

```text
G2-S0 contract + persistence foundation                       ✅ CERTIFIED
G2-S1 resource/capability/schedule management                ✅ CERTIFIED
G2-S2 deterministic availability reads                      ✅ CERTIFIED
G2-S3 atomic single-resource reservation conflict           ✅ CERTIFIED
G2-S4 holds + expiry/replay                                  ✅ CERTIFIED
G2-S5 multi-business generality                              ✅ CERTIFIED
G2-S6 Services snapshot/demand integration                   ✅ CERTIFIED
G2-S7 Appointment Workflow integration                       ✅ CERTIFIED
G2-S8 multi-resource assignment or explicit deferral proof   ⏭️ NEXT
G2-S9 final clean certification                              OPEN
```

No gate may advance until the predecessor has dedicated CI, protected predecessor regressions, terminal marker, artifact evidence, receipt/non-claims, machine-ledger transition, and same-gate exact-final-head rerun.

## 16. G2-S8 frozen target

G2-S8 must either prove generalized multi-resource assignment/search or explicitly defer it with executable evidence rather than implying support.

If implemented, the proof must extend beyond G2-S7's one-resource Appointment path and demonstrate atomicity, deterministic assignment identity, business isolation, replay, and conflict behavior across multiple simultaneously required resources.

## 17. Truth boundary

G2-S7 certifies Scheduler-backed Appointment orchestration through one concrete resource, including replay and bounded exhausted-retry compensation.

It does **not** certify:

```text
generalized multi-resource search/assignment/optimization   → G2-S8
general reservation cancel/complete lifecycle               → not inherited from S7 compensation
final clean Scheduler closure / production readiness        → G2-S9
Integration Engine provider behavior                        → separate track
Agent/MCP intelligence layer                                → later
```

## 18. Bounded claim

The Scheduler Engine is certified through G2-S7 for one-resource scheduling semantics, durable holds/reservations, multi-business isolation, immutable Services revision handoff, and Scheduler-backed Appointment orchestration with durable retry/replay and bounded orphan-capacity compensation.

G2-S8 and G2-S9 remain explicit future gates. Certification does not authorize merge; PR #32 remains draft/unmerged and continued Scheduler work remains on `build/g2-scheduler`.
