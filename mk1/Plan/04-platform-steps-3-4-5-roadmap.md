# MK1 — Steps 3–4–5 Execution Roadmap

## Status

**SCHEDULER G2-S0..G2-S9 CERTIFIED — G2 CLOSED**

This roadmap advances the platform while preserving certified authority boundaries. Scheduler and Integration remain separate engines; later gates never inherit claims merely because earlier contracts or schema exist.

Exact-final-head evidence is kept on PR #32 after documentation-complete branch seals. The branch itself is not mutated merely to copy final run IDs/digests, because that would create a new unsealed head.

## Current certified baseline

```text
Step 1 CTA / Channels
  WebChat C1A+C1B                       ✅ CERTIFIED + HUMAN VERIFIED
  Telegram adapter/official transport  ✅ CERTIFIED ON INHERITED BASELINE
  WhatsApp/Kapso transport regression  ✅ CERTIFIED ON INHERITED BASELINE
  Canonical CTA compatibility/router   ✅ SCHEDULER-PATH RE-CERTIFIED

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
  G2-S5 Multi-business generality       ✅ CERTIFIED
  G2-S6 Services snapshot integration   ✅ CERTIFIED
  G2-S7 Appointment integration         ✅ CERTIFIED
  G2-S8 Multi-resource atomicity        ✅ CERTIFIED
  G2-S9 Final clean certification       ✅ CERTIFIED
  Scheduler G2                         ✅ CLOSED

Step 5 Integration Engine               BOUNDARY DESIGN / BUILD LATER
```

## Canonical Scheduler branch policy

```text
ACTIVE BRANCH  build/g2-scheduler
ACTIVE PR      #32 — Scheduler G2 canonical track
BASE           feature/pre-scheduler-node-edge-certification

Historical per-gate PRs
  #29 G2-S0   CLOSED / UNMERGED / evidence preserved
  #30 G2-S1   CLOSED / UNMERGED / evidence preserved
  #31 G2-S2   CLOSED / UNMERGED / evidence preserved
```

From G2-S3 through final closure, normal Scheduler development stayed on `build/g2-scheduler`. No normal per-gate branch was created. Each gate received its own workflow, executable proof, receipt, machine-ledger transition, artifact evidence and exact-final-head rerun. Certification still does not authorize merge.

## Mandatory Scheduler certification rule

```text
IMPLEMENT
→ DEDICATED GATE CI
→ PREDECESSOR REGRESSIONS
→ GATE-SPECIFIC TERMINAL MARKER
→ EVIDENCE ARTIFACT + DIGEST
→ TEST RECEIPT + NON-CLAIMS
→ MACHINE LEDGER UPDATE
→ RE-RUN THE SAME GATE ON THE FINAL BRANCH HEAD
→ ONLY THEN EXECUTE THE NEXT GATE
```

Canonical policy: `mk1/Test/g2-scheduler-certification-policy.md`

Machine state: `mk1/Test/g2-scheduler-certification-ledger.json`

Executable verifier: `mk1/runtime/scripts/verify-scheduler-certification-ledger.ts`

Terminal machine state after G2-S9 promotion:

```text
G2-S0..G2-S9 = CERTIFIED
currentNext  = null
```

## Track A — Services completion

**CLOSED.**

```text
S6 Multi-business generality                     ✅ CERTIFIED
S7 Appointment integration with Services         ✅ CERTIFIED
S8 Final clean G1 certification                  ✅ CERTIFIED
G1 Services Engine                               ✅ CERTIFIED
```

## Track B — Scheduler design/build

**CLOSED after G2-S9 exact-final-head certification.**

Scheduler owns concrete time/resource allocation; Services owns catalog/commercial and abstract scheduling semantics; Temporal owns durable orchestration.

```text
G2-S0 Contract + persistence foundation                         ✅ CERTIFIED
G2-S1 Resource/capability/schedule management                   ✅ CERTIFIED
G2-S2 Deterministic availability engine                        ✅ CERTIFIED
G2-S3 Atomic reservation + concurrency conflict                ✅ CERTIFIED
G2-S4 Holds + expiry + replay                                   ✅ CERTIFIED
G2-S5 Multi-business generality                                 ✅ CERTIFIED
G2-S6 Services snapshot/demand integration                      ✅ CERTIFIED
G2-S7 Appointment Workflow integration                          ✅ CERTIFIED
G2-S8 Multi-resource assignment + atomicity                     ✅ CERTIFIED
G2-S9 Final clean Scheduler certification                       ✅ CERTIFIED
```

### G2-S0 — CERTIFIED

Frozen contracts, PostgreSQL Scheduler schema, immutable `SchedulingDemand`, resource/schedule/override persistence, hold/reservation assignment schema, operation identity ledger and provider-agnostic boundaries.

### G2-S1 — CERTIFIED

Versioned/idempotent resource and schedule management with optimistic revision checks and business-scoped mutation safety.

### G2-S2 — CERTIFIED

Deterministic one-resource availability over ACTIVE resources, capability/resource-kind matching, recurring schedules, overrides, segment-wise capacity, reservations, logically-unexpired holds, buffers and deterministic candidate ordering.

### G2-S3 — CERTIFIED

```text
two concurrent confirmations for final capacity
→ exactly one RESERVED success
→ exactly one CAPACITY_CONFLICT / stale-capacity loser
→ exactly one persisted reservation + assignment + successful command
→ loser commits zero business effect
```

Stale candidates are revalidated at commit; replay/idempotency is preserved.

### G2-S4 — CERTIFIED

Durable one-resource hold create/release/replay, persisted-time logical expiry independent of cleanup timing, restart/re-entry correctness and atomic hold consumption into reservation.

### G2-S5 — CERTIFIED

Same implementation, materially different businesses, strict isolation for resource/schedule/availability/hold/reservation/idempotency state, cross-business references fail closed and no customer/provider forks in Scheduler core.

### G2-S6 — CERTIFIED

```text
frozen ServicesSelectionSnapshot
→ materialize SchedulingDemand by value
→ validate
→ persist scheduler_demands + snapshot_hash
→ Scheduler executes from persisted demand
```

Demand N remains unchanged after Services publishes materially different N+1; new demand sees N+1. Same demand/material replays, changed immutable material fails closed.

### G2-S7 — CERTIFIED

```text
Services exact selection
→ frozen SchedulingDemand
→ QueryAvailability
→ advisory SlotCandidate
→ explicit Finalize
→ atomic ConfirmReservation
→ Appointment.scheduler_reservation_id
→ terminal CTA/domain projection
```

Temporal remains orchestration authority; Scheduler remains capacity authority. Current Appointment uses one concrete Scheduler resource, writes no legacy `ResourceReservation` shadow, replays durable reservation on retry, and executes bounded orphan-capacity compensation only after downstream persistence exhausts its retry budget.

That compensation is not a generalized cancellation lifecycle.

### G2-S8 — CERTIFIED

G2-S8 chose implementation rather than deferral. It certifies bounded real multi-resource scheduling:

```text
SchedulingDemand
  ├── BAY_ACCESS → BAY
  └── TECHNICIAN → TECHNICIAN
       ↓
intersect per-capability deterministic availability
       ↓
joint SlotCandidate with distinct concrete resources
       ↓
sort assignments by resourceId
       ↓
lock all capacity keys/resources in deterministic order
       ↓
revalidate complete joint candidate
       ↓
commit one reservation + all assignments + command atomically
```

Certified invariants:

```text
one distinct concrete resource per capability demand
common canonical query timezone across selected set
capacityUnits applied to every selected assignment
same operation/material replays durable result before availability lookup
concurrent final-pair race → one winner / one zero-effect loser
reservation + N assignments + command are all-or-nothing
provider/channel and Appointment-specific mechanics remain outside Scheduler core
```

Explicit non-claims retained by G2-S8:

```text
multi-resource holds
solver / optimizer / best-fit / scoring / routing
heterogeneous candidate display timezones
general staff shift/travel/sequence planning
Appointment consuming multi-resource demands
general reservation cancellation/completion lifecycle
```

### G2-S9 — CERTIFIED TERMINAL CLOSURE

G2-S9 adds no normal feature scope. It re-proves the complete Scheduler G2 graph from pristine persistence and then audits the combined durable state.

Candidate proof head:

```text
3ad95d39d69c39c0ff8bc44f959f4087d75cc52c
```

Candidate dedicated runs:

```text
Push 35129373821  SUCCESS
PR   35129379874  SUCCESS
```

The terminal gate verifies:

```text
fresh PostgreSQL/Mongo laboratory
full migration chain
ledger/receipt/design consistency
G2-S0 foundation
G2-S1 management
G2-S2 availability
G2-S3 one-resource atomic reservation
G2-S4 holds
G2-S5 multi-business
G2-S6 frozen Services handoff
G2-S8 multi-resource atomicity
Temporal + worker + CTA + channel runtime
G2-S7 Appointment orchestration
CTA orchestration regression
final relational truth audit
final evidence artifact + terminal seal
```

The final relational audit additionally requires zero orphan reservation assignments, zero legacy Appointment capacity shadows, one-resource integrity on the protected G2-S7 Appointment path, BAY+TECHNICIAN integrity on G2-S8 reservations, multi-business fixture survival, and command-ledger identity integrity.

G2-S9 preserves all prior non-claims. It does not widen Scheduler into an optimizer, multi-resource hold engine, workforce planner, generalized cancellation engine, production SLA claim or whole-platform release certification.

### Forward-compatible predecessor regressions

Historical Scheduler workflows enforce the durable boundary:

```text
later consumers may use Scheduler
Scheduler producer/core layers may not import or branch on Appointment/provider-specific orchestration
```

G2-S9 also runs protected Services, Appointment, CTA/channel, Telegram and WhatsApp contract regressions and a full shared-persistence proof chain.

## Track C — Integration boundary

Integration remains separate from core scheduling.

Future Integration work may use the already-frozen boundary:

```text
I0 Integration command/event contracts
I1 connection/provider registry + secret references
I2 durable outbound command/retry ledger
I3 authenticated inbound webhook/idempotency ledger
I4 first real provider adapter
I5 Temporal composition + failure/recovery proof
```

No Integration gate is implied certified by Scheduler completion.

## Cross-track dependency rules

```text
Channel work must not wait for Scheduler.
Scheduler consumes frozen Services snapshots/demands, not channels.
Integration is not a prerequisite for core scheduling.
Appointment migration is complete at G2-S7.
Persistence ownership stays explicit across PostgreSQL / MongoDB / Object Store.
Agent/MCP waits until deterministic core gates are sufficiently mature.
Scheduler G2 is frozen after terminal certification except for explicitly scoped fixes/regressions.
```

## Frozen authority boundaries

```text
Services = commercial/catalog + abstract scheduling semantics
Scheduler = concrete time/resource allocation
Integration = external-system adapter/delivery mechanics
Channel interactive ingress = CTA, not Integration
PostgreSQL = transactional operational truth
Temporal = orchestration authority
MongoDB = operational document/audit/semantic evidence
Object Store = attachment bytes/content integrity
```

## Next executable work

Before any new platform track begins:

```text
1. Re-run the dedicated G2-S9 gate on the exact documentation-complete head for push + PR.
2. Require the terminal machine ledger to pass with currentNext = null.
3. Preserve final G2-S9 run IDs/artifact digests on PR #32 without mutating the sealed head.
4. Keep PR #32 draft/unmerged; certification does not authorize merge.
5. Do not add normal Scheduler features after closure without opening a separately scoped post-G2 change.
6. Only after owner direction choose merge/review disposition for PR #32 or start the next platform track.
```
