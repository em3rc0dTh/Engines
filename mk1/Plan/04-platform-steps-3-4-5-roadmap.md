# MK1 — Steps 3–4–5 Execution Roadmap

## Status

**PRE-SCHEDULER BASELINE CERTIFIED — SCHEDULER BUILD NEXT**

This roadmap advances the architecture shown in the platform diagram while preserving the certified platform slice. Scheduler and Integration remain separate future engines; the pre-Scheduler closure does not silently absorb their responsibilities.

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

Step 4 Scheduler Engine                 ⏭️ NEXT — BUILD NOT STARTED BY CLOSURE

Step 5 Integration Engine               BOUNDARY DESIGN / BUILD LATER
```

Current pre-Scheduler seal:

```text
branch  feature/pre-scheduler-node-edge-certification
head    06d5e0289ca1cff7b24826f06af2a61bf0a45a76
push    34879640428  SUCCESS
PR      34879680774  SUCCESS
marker  PRE_SCHEDULER_NODE_EDGE_CERTIFICATION_PASS
```

The documentation-only seal update may advance the branch head after this receipt; the certification workflow must pass again on that final documentation head before it becomes the new candidate.

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

Scheduler is now the next engine to build. It owns concrete time/resource allocation; it does not own catalog/commercial semantics.

Frozen build gates:

```text
G2-S0 Contract + persistence foundation
G2-S1 Resource/capability/schedule management
G2-S2 Deterministic availability engine
G2-S3 Atomic reservation + concurrency conflict
G2-S4 Holds + expiry + replay
G2-S5 Multi-business generality
G2-S6 Services snapshot/demand integration
G2-S7 Appointment Workflow integration
G2-S8 Multi-resource assignment proof or explicit deferral
G2-S9 Final clean Scheduler certification
```

### G2-S0

Deliver:

```text
SchedulerResource
ResourceCapability
ScheduleTemplate
ScheduleOverride
SchedulingDemand
SlotCandidate
Hold
Reservation
PostgreSQL schema
contract tests
```

No Appointment rewrite yet.

### G2-S1

Certify versioned/idempotent management of resources and schedule definitions.

### G2-S2

Certify deterministic read-only availability generation from schedules, overrides, capabilities, capacity and existing allocations.

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

The pre-Scheduler certification now guards:

```text
provider → adapter → compatibility → canonical CTA → router → Temporal
```

and independently re-certifies the real orchestration/persistence composition.

## Cross-track dependency rules

```text
Channel work must not wait for Scheduler.
Scheduler must consume Services snapshots, not channels.
Integration must not become a prerequisite for core scheduling.
Appointment may migrate to Scheduler only after G2-S3 conflict correctness is proven.
Persistence ownership remains explicit across PostgreSQL / MongoDB / Object Store.
Agent/MCP waits until deterministic Steps 1–7 are sufficiently mature.
```

## Frozen authority boundaries

```text
Services = commercial/catalog semantics
Scheduler = concrete time/resource allocation
Integration = external-system adapter/delivery mechanics
Channel interactive ingress = CTA, not Integration
PostgreSQL = transactional operational truth for the current slice
Temporal = orchestration authority
MongoDB = operational document/audit/semantic evidence
Object Store = attachment bytes/content integrity
```

## Next executable work

Recommended sequence:

```text
1. Keep the pre-Scheduler certification PR stacked and unmerged until explicit authorization.
2. After the authorized merge sequence establishes the certified baseline, open a dedicated Scheduler branch from that exact compatible head.
3. Implement G2-S0 contracts + PostgreSQL persistence only.
4. Do not rewrite Appointment availability/reservation against Scheduler before G2-S3 conflict correctness is independently certified.
5. Preserve the pre-Scheduler node/edge gate as a protected regression boundary while Scheduler evolves.
```