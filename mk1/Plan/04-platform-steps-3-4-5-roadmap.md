# MK1 — Steps 3–4–5 Execution Roadmap

## Status

**SCHEDULER G2-S4 CERTIFIED — G2-S5 NEXT**

This roadmap advances the platform while preserving certified authority boundaries. Scheduler and Integration remain separate engines; later gates never inherit claims merely because earlier contracts or schema exist.

## Current certified baseline

```text
Step 1 CTA / Channels
  WebChat C1A+C1B                       ✅ CERTIFIED + HUMAN VERIFIED
  Telegram adapter/official transport  ✅ CERTIFIED ON INHERITED BASELINE
  WhatsApp/Kapso transport regression  ✅ CERTIFIED ON INHERITED BASELINE
  Canonical CTA compatibility/router   ✅ PRE-SCHEDULER RE-CERTIFIED

Step 2 Temporal Orchestration           ✅ CURRENT APPOINTMENT SLICE CERTIFIED

Step 3 Services Engine
  S0–S8 / G1                           ✅ CERTIFIED

Layer 6 Persistence / Storage
  PostgreSQL + MongoDB v4 + ObjectStore ✅ CERTIFIED

Pre-Scheduler node/edge closure         ✅ CERTIFIED

Step 4 Scheduler Engine
  G2-S0 Contract + persistence          ✅ CERTIFIED
  G2-S1 Resource/schedule management    ✅ CERTIFIED
  G2-S2 Deterministic availability      ✅ CERTIFIED
  G2-S3 Atomic reservation conflict     ✅ CERTIFIED
  G2-S4 Holds + expiry/replay           ✅ CERTIFIED
  G2-S5 Multi-business generality       ⏭️ NEXT

Step 5 Integration Engine               BOUNDARY DESIGN / BUILD LATER
```

Exact heads, runs and artifact digests live in gate receipts/evidence because documentation commits change the branch head and therefore require exact-final-head recertification.

## Canonical Scheduler branch policy

Scheduler development is intentionally consolidated:

```text
ACTIVE BRANCH  build/g2-scheduler
ACTIVE PR      #32 — Scheduler G2 canonical track
BASE           feature/pre-scheduler-node-edge-certification

Historical per-gate PRs
  #29 G2-S0   CLOSED / UNMERGED / evidence preserved
  #30 G2-S1   CLOSED / UNMERGED / evidence preserved
  #31 G2-S2   CLOSED / UNMERGED / evidence preserved
```

From G2-S3 onward, the normal rule is **no new per-gate Scheduler branch**. G2-S4 through G2-S9 continue as sequential commits on `build/g2-scheduler`. Each gate still receives its own dedicated workflow, receipt, ledger transition, evidence artifacts and exact-final-head rerun. A new branch is allowed only for exceptional recovery/isolation, not as the default gate mechanism.

This keeps certification granular without fragmenting implementation history.

## Mandatory Scheduler certification rule

```text
IMPLEMENT
→ DEDICATED GATE CI
→ PREDECESSOR REGRESSIONS
→ GATE-SPECIFIC TERMINAL MARKER
→ EVIDENCE ARTIFACT + DIGEST
→ TEST RECEIPT + NON-CLAIMS
→ MACHINE LEDGER UPDATE
→ SAME GATE RE-RUN ON FINAL BRANCH HEAD
→ ONLY THEN ADVANCE THE NEXT GATE
```

Canonical policy: `mk1/Test/g2-scheduler-certification-policy.md`

Machine state: `mk1/Test/g2-scheduler-certification-ledger.json`

Executable verifier: `mk1/runtime/scripts/verify-scheduler-certification-ledger.ts`

## Track A — Services completion

**CLOSED.**

```text
S6 Multi-business generality                     ✅ CERTIFIED
S7 Appointment integration with Services         ✅ CERTIFIED
S8 Final clean G1 certification                  ✅ CERTIFIED
G1 Services Engine                               ✅ CERTIFIED
```

## Track B — Scheduler design/build

Scheduler owns concrete time/resource allocation; it does not own catalog/commercial semantics.

```text
G2-S0 Contract + persistence foundation                         ✅ CERTIFIED
G2-S1 Resource/capability/schedule management                   ✅ CERTIFIED
G2-S2 Deterministic availability engine                        ✅ CERTIFIED
G2-S3 Atomic reservation + concurrency conflict                ✅ CERTIFIED
G2-S4 Holds + expiry + replay                                   ✅ CERTIFIED
G2-S5 Multi-business generality                                 ⏭️ NEXT
G2-S6 Services snapshot/demand integration                      OPEN
G2-S7 Appointment Workflow integration                          OPEN
G2-S8 Multi-resource assignment proof or explicit deferral      OPEN
G2-S9 Final clean Scheduler certification                       OPEN
```

### G2-S0 — CERTIFIED

Frozen contracts, validation, PostgreSQL Scheduler schema, immutable `SchedulingDemand`, resource/schedule/override persistence, hold/reservation assignment schema, operation identity ledger, provider-agnostic boundaries and explicit non-integration with Appointment.

### G2-S1 — CERTIFIED

Certified versioned/idempotent management:

```text
CreateResource
UpdateResource
SetResourceStatus
SetScheduleTemplate
PutScheduleOverride
DeleteScheduleOverride
```

Same operation + same material replays; same operation + different material fails closed; stale revisions and cross-business mutations fail without partial effects.

### G2-S2 — CERTIFIED

Certified deterministic read-only one-resource availability over current Scheduler truth:

```text
business scope
ACTIVE resource filtering
capability + resource-kind matching
weekly schedules
AVAILABLE / UNAVAILABLE / CAPACITY overrides
segment-wise effective capacity
RESERVED allocations
persisted ACTIVE unexpired holds
pre/post buffers
configurable granularity
deterministic candidate IDs
stable candidate ordering
SlotCandidate advisory/non-persisted
```

### G2-S3 — CERTIFIED

Certified direct one-resource `ConfirmReservation` with commit-time revalidation and atomic concurrency control.

Critical executable invariant:

```text
two concurrent confirmations for the final unit of capacity
→ exactly one RESERVED success
→ exactly one typed CAPACITY_CONFLICT
→ exactly one persisted reservation
→ exactly one persisted assignment
→ exactly one successful ConfirmReservation command result
→ loser commits zero reservation / assignment / command effect
```

Also certified:

```text
same successful operation + same material replay
same operation + changed material → IDEMPOTENCY_MATERIAL_CONFLICT
stale candidate after schedule/override mutation → SLOT_NO_LONGER_AVAILABLE
resource-scoped deterministic transaction serialization
G2-S0/S1/S2 predecessor regressions
inherited CTA/Temporal regression
Appointment remains outside Scheduler
```

### G2-S4 — CERTIFIED

Certified persisted hold lifecycle on the same canonical Scheduler line:

```text
CreateHold durable persistence
ReleaseHold durable transition
same-operation replay
same-operation different-material → IDEMPOTENCY_MATERIAL_CONFLICT
explicit persisted expiresAt
logical expiry based on persisted time
expired ACTIVE hold becomes non-blocking before housekeeping
fresh PostgreSQL Pool preserves expiry truth
housekeeping may project ACTIVE → EXPIRED after correctness is already true
valid hold is consumed atomically with reservation
consumed hold → CONSUMED
expired hold confirmation → HOLD_EXPIRED
expired-hold failure → zero reservation / command effect
```

Correctness does not depend on `setTimeout`, `setInterval`, cron, in-memory state or a cleanup worker running at a precise instant. Availability evaluates `expires_at` directly against the query `asOf` truth.

G2-S4 preserves the G2-S3 atomic confirmation invariant and does not migrate Appointment.

### G2-S5 — NEXT

Run materially different businesses through the same Scheduler implementation with zero vertical/provider branches.

Minimum executable proof:

```text
at least two distinct business slugs
materially different resource kinds / capabilities / schedules
distinct immutable SchedulingDemand fixtures
availability isolation per business
hold isolation per business
reservation isolation per business
same operationId may safely exist in different businesses
cross-business resource/schedule/hold/reservation references fail closed
one business reaching capacity does not affect the other
no provider/vertical names or branching in Scheduler core
G2-S0..G2-S4 predecessor regressions remain green
```

G2-S5 proves generality/isolation of the already-certified Scheduler semantics. It must not add customer-specific special cases merely to make fixtures pass.

### G2-S6

Feed Scheduler from immutable Services `SchedulingDemand` derived from frozen Offering revisions. Prove catalog head N+1 cannot silently mutate an active demand from N.

### G2-S7

Only after prior Scheduler correctness gates are certified, migrate `RegisterNewAppointment`:

```text
Services selection
→ SchedulingDemand
→ QueryAvailability
→ selected candidate
→ optional hold
→ explicit Finalize
→ ConfirmReservation
→ Appointment result references Scheduler reservation
```

Preserve `availability shown != reservation persisted`.

### G2-S8

Prove multi-resource assignment if required by the first product slice; otherwise record an explicit, testable deferral rather than implying support.

### G2-S9

Run one clean Scheduler closure over G2-S0–G2-S8 plus protected CTA/Temporal/Services/Persistence regressions and emit the final Scheduler receipt.

## Track C — Integration boundary

Do not build a broad provider platform yet. Prepare common contracts, then choose the first concrete provider from product need.

```text
I0 Integration command/event contracts
I1 connection/provider registry + secret references
I2 durable outbound command/retry ledger
I3 authenticated inbound webhook/idempotency ledger
I4 first real provider adapter
I5 Temporal composition + failure/recovery proof
```

## Track D — channel evolution

Channel work can proceed independently of Scheduler. Provider mechanics terminate at the canonical compatibility/domain boundary and must not leak provider branches into Temporal workflows or Scheduler.

## Cross-track dependency rules

```text
Channel work must not wait for Scheduler.
Scheduler consumes Services snapshots, not channels.
Integration is not a prerequisite for core scheduling.
Appointment migration remains G2-S7.
Persistence ownership stays explicit across PostgreSQL / MongoDB / Object Store.
Agent/MCP waits until deterministic core gates are sufficiently mature.
No Scheduler gate advances until its predecessor is independently certified.
```

## Frozen authority boundaries

```text
Services = commercial/catalog semantics
Scheduler = concrete time/resource allocation
Integration = external-system adapter/delivery mechanics
Channel interactive ingress = CTA, not Integration
PostgreSQL = transactional operational truth for Scheduler/current relational slice
Temporal = orchestration authority
MongoDB = operational document/audit/semantic evidence
Object Store = attachment bytes/content integrity
```

## Next executable work

```text
1. Final-seal G2-S4 on the exact receipt/evidence/roadmap/ledger head.
2. Keep PR #32 draft/unmerged; certification does not authorize merge.
3. Do NOT create a G2-S5 branch.
4. Continue G2-S5 directly on build/g2-scheduler.
5. Prove two materially different businesses with strict data/operation isolation.
6. Prove capacity/hold/reservation state cannot bleed across business scope.
7. Preserve G2-S0/S1/S2/S3/S4 regressions.
8. Do not migrate Appointment before G2-S7.
```
