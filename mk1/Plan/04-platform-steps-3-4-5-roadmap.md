# MK1 — Steps 3–4–5 Execution Roadmap

## Status

**SCHEDULER G2-S0 CERTIFIED — G2-S1 NEXT**

This roadmap advances the architecture shown in the platform diagram while preserving the certified platform slice. Scheduler and Integration remain separate engines; later Scheduler gates do not inherit claims merely because the persistence foundation exists.

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
  G2-S1 Resource/schedule management    ⏭️ NEXT

Step 5 Integration Engine               BOUNDARY DESIGN / BUILD LATER
```

Current pre-Scheduler seal:

```text
branch  feature/pre-scheduler-node-edge-certification
head    7051dd2207545239563febfd9d1b44330c11da35
push    34880458134  SUCCESS
PR      34880461850  SUCCESS
marker  PRE_SCHEDULER_NODE_EDGE_CERTIFICATION_PASS
```

Current Scheduler certification is branch-head based. The active Scheduler branch must pass its dedicated gate workflow after any implementation, contract, receipt, roadmap, ledger, policy or workflow change. The exact current head/run/artifact digests are recorded in the active PR; this committed roadmap intentionally does not pin a mutable branch head and thereby make itself stale on the next documentation commit.

## Mandatory Scheduler certification rule

Scheduler is now governed by a sequential hard-gate policy:

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

No Scheduler step may be skipped, inferred from a later step, or batch-certified retroactively.

Canonical policy:

`mk1/Test/g2-scheduler-certification-policy.md`

Machine-readable state:

`mk1/Test/g2-scheduler-certification-ledger.json`

Executable verifier:

`mk1/runtime/scripts/verify-scheduler-certification-ledger.ts`

The ledger must always represent a contiguous `CERTIFIED` prefix, at most one `NEXT` gate immediately after that prefix, and only `OPEN` gates after it. Every certified gate must have its own workflow, receipt and terminal marker.

## Track A — Services completion

**CLOSED.**

```text
S6 Multi-business generality                     ✅ CERTIFIED
S7 Appointment integration with Services         ✅ CERTIFIED
S8 Final clean G1 certification                  ✅ CERTIFIED
G1 Services Engine                               ✅ CERTIFIED
```

The Appointment flow consumes canonical Services snapshots rather than bypassing Services authority. The pre-Scheduler closure also guards this boundary statically and reruns S7 from a pristine laboratory.

## Track B — Scheduler design/build

Scheduler owns concrete time/resource allocation; it does not own catalog/commercial semantics.

Frozen build gates:

```text
G2-S0 Contract + persistence foundation                         ✅ CERTIFIED
G2-S1 Resource/capability/schedule management                   ⏭️ NEXT
G2-S2 Deterministic availability engine                        OPEN
G2-S3 Atomic reservation + concurrency conflict                OPEN
G2-S4 Holds + expiry + replay                                   OPEN
G2-S5 Multi-business generality                                 OPEN
G2-S6 Services snapshot/demand integration                      OPEN
G2-S7 Appointment Workflow integration                          OPEN
G2-S8 Multi-resource assignment proof or explicit deferral      OPEN
G2-S9 Final clean Scheduler certification                       OPEN
```

### G2-S0 — CERTIFIED

Delivered and executable:

```text
SchedulerResource
ResourceCapability
WeeklyAvailabilityWindow
ScheduleTemplate
ScheduleOverride
SchedulingDemand
QueryAvailabilityInput / AvailabilityResult
SlotCandidate
CreateHoldInput / SchedulerHold
ConfirmReservationInput / SchedulerReservation
SchedulerFailureCode
PostgreSQL Scheduler schema
Scheduler command identity ledger foundation
contract tests
persistence certification
sequential certification ledger/policy guard
```

Foundation invariants now frozen:

```text
Services commercial semantics remain outside Scheduler.
SchedulingDemand stores immutable selected Service/Offering revisions.
PostgreSQL is Scheduler transactional truth.
SlotCandidate is advisory and not persisted as reservation truth.
All persisted instants are offset-aware; time zones are explicit.
Cross-business resource references are rejected.
Persistence supports multiple assignments without claiming multi-resource search.
Appointment is not rewritten against Scheduler yet.
Every later G2 gate must be independently certified before advancement.
```

### G2-S1 — NEXT

Certify versioned/idempotent management of resources and schedule definitions. This is the first gate allowed to add executable management operations such as Create/Update Resource, SetResourceStatus, SetScheduleTemplate and schedule-override lifecycle behavior. It must preserve the G2-S0 contracts and command identity foundation.

Minimum certification requirement before G2-S2 may become NEXT:

```text
Dedicated G2-S1 workflow                         PASS
G2-S0 ledger + contract regression               PASS
resource CRUD/version semantics                  PASS
capability management                            PASS
schedule-template management                     PASS
override lifecycle                               PASS
same operation replay                            PASS
same operation id + different material conflict  PASS
business isolation                               PASS
artifact + digest                                PRESENT
SCHEDULER_G2_S1_CERTIFICATION_PASS                PRESENT
final branch head                                RE-CERTIFIED
```

### G2-S2

Certify deterministic read-only availability generation from schedules, overrides, capabilities, capacity and existing allocations. It may become NEXT only after G2-S1 is certified.

### G2-S3

Certify the critical invariant:

```text
two concurrent confirmations for last capacity
→ exactly one success
→ exactly one typed conflict
→ no partial second business effect
```

### G2-S4

Add expiring holds and prove replay/restart semantics.

### G2-S5

Run materially different business fixtures through the same Scheduler implementation with zero vertical branches.

### G2-S6

Feed Scheduler from immutable Services `SchedulingDemand` derived from frozen Offering revisions. Prove catalog head N+1 does not silently change an active scheduling demand from N.

### G2-S7

Only after Scheduler conflict correctness is certified, migrate `RegisterNewAppointment`:

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

Preserve:

```text
availability shown != reservation persisted
```

### G2-S8

Prove multi-resource assignment if the first Scheduler product slice requires it; otherwise record an explicit, testable deferral rather than implying support.

### G2-S9

Run one clean Scheduler closure suite over G2-S0–G2-S8 plus protected CTA/Temporal/Services/Persistence regressions and emit the final Scheduler receipt.

## Track C — Integration boundary

Do not build a broad provider platform yet.

Prepare common contracts first, then choose the first concrete integration from actual product need.

Likely first implementations:

```text
payment provider
or
notification provider
```

Future gate shape:

```text
I0 Integration command/event contracts
I1 connection/provider registry + secret references
I2 durable outbound command/retry ledger
I3 authenticated inbound webhook/idempotency ledger
I4 first real provider adapter
I5 Temporal composition + failure/recovery proof
```

## Track D — channel evolution

Channel work can proceed independently of Scheduler when a concrete product need exists. Channel/provider mechanics must continue to terminate at the canonical compatibility/domain boundary; they must not leak provider-specific branches into Temporal business workflows.

The pre-Scheduler certification guards:

```text
provider → adapter → compatibility → canonical CTA → router → Temporal
```

and the Scheduler G2-S0 gate independently protects provider-agnostic Scheduler contracts while re-certifying the inherited CTA orchestration path.

## Cross-track dependency rules

```text
Channel work must not wait for Scheduler.
Scheduler must consume Services snapshots, not channels.
Integration must not become a prerequisite for core scheduling.
Appointment may migrate to Scheduler only after G2-S3 conflict correctness is proven.
Persistence ownership remains explicit across PostgreSQL / MongoDB / Object Store.
Agent/MCP waits until deterministic Steps 1–7 are sufficiently mature.
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

Recommended sequence:

```text
1. Keep the stacked PR chain unmerged until explicit authorization.
2. Treat G2-S0 contract/schema/policy/ledger as frozen regression surface.
3. Implement G2-S1 management operations over SchedulerResource, capabilities, ScheduleTemplate and ScheduleOverride.
4. Prove version/replay/material-conflict semantics through scheduler_commands.
5. Certify G2-S1 on its exact final head before changing the ledger to G2-S2 NEXT.
6. Do not implement availability generation until G2-S1 is certified.
7. Do not migrate Appointment reservation logic until G2-S3 is independently certified.
```
