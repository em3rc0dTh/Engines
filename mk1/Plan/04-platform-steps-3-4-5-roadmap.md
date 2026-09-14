# MK1 — Steps 3–4–5 Execution Roadmap

## Status

**SCHEDULER G2-S6 CERTIFIED — G2-S7 NEXT**

This roadmap advances the platform while preserving certified authority boundaries. Scheduler and Integration remain separate engines; later gates never inherit claims merely because earlier contracts or schema exist.

G2-S6 candidate proof has passed in independent push and PR contexts. This documentation-complete head must still pass the mandatory same-workflow exact-final-head seal before any G2-S7 implementation begins. Final exact-head run IDs/artifact digests are recorded on PR #32 after the seal so the branch itself is not mutated afterward.

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
  G2-S5 Multi-business generality       ✅ CERTIFIED
  G2-S6 Services snapshot integration   ✅ CERTIFIED
  G2-S7 Appointment integration         ⏭️ NEXT

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

From G2-S3 onward, normal Scheduler development stays on `build/g2-scheduler`. No normal per-gate branch is created. Each gate still receives its own workflow, executable proof, receipt, machine-ledger transition, artifact evidence and exact-final-head rerun. Exceptional recovery/isolation is the only reason to create another branch.

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
→ ONLY THEN EXECUTE THE NEXT GATE
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
G2-S5 Multi-business generality                                 ✅ CERTIFIED
G2-S6 Services snapshot/demand integration                      ✅ CERTIFIED
G2-S7 Appointment Workflow integration                          ⏭️ NEXT
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

Critical invariant:

```text
two concurrent confirmations for the final unit of capacity
→ exactly one RESERVED success
→ exactly one typed CAPACITY_CONFLICT
→ exactly one persisted reservation + assignment + successful command result
→ loser commits zero reservation / assignment / command effect
```

Also certified: replay/idempotency, stale-candidate revalidation, deterministic capacity serialization, predecessor/platform regressions, and Appointment remaining outside Scheduler.

### G2-S4 — CERTIFIED

Certified persisted hold lifecycle:

```text
CreateHold durable persistence
ReleaseHold durable transition
same-operation replay
changed-material conflict
persisted expiresAt
logical expiry independent of cleanup timing
restart/re-entry correctness through a fresh PostgreSQL Pool
valid hold atomic consumption into reservation
expired hold → HOLD_EXPIRED with zero reservation/command effect
```

### G2-S5 — CERTIFIED

The same Scheduler implementation is proven against materially different businesses with strict isolation of resources, capabilities, schedules, availability, holds, reservations and business-scoped idempotency. Cross-business references fail closed and no fixture/provider/customer branch exists in Scheduler core.

### G2-S6 — CERTIFIED

Services now has an explicit versioned abstract `ServiceSchedulingProfile` for schedulable Offerings:

```text
capacityUnits
requiredCapabilities[].code
requiredCapabilities[].quantity
requiredCapabilities[].resourceKinds?
buffers.beforeMinutes
buffers.afterMinutes
```

The profile contains no concrete Scheduler resource identity.

Canonical runtime handoff:

```text
frozen ServicesSelectionSnapshot
→ materialize SchedulingDemand by value
→ validate immutable demand
→ persist scheduler_demands + snapshot_hash
→ Scheduler reads/executes from persisted demand
```

Executable N→N+1 proof establishes:

```text
Services revision N produces demand N
Scheduler availability loaded from demand N uses N semantics
Services head advances to materially different N+1
demand N + snapshot_hash remain unchanged
Scheduler still uses N semantics for persisted demand N
new demand from N+1 contains N+1 semantics
Scheduler uses N+1 semantics for persisted N+1 demand
same demandId + same material replays
same demandId + changed material → DEMAND_MATERIAL_CONFLICT with no overwrite
G2-S0..G2-S5 and inherited CTA/Temporal regressions remain green
```

The candidate implementation head `9d6af52e5749e83469e7d4aca89775753ea2f4e5` passed dedicated push run `34908156644` and PR run `34908161495`. Documentation/evidence/ledger commits now form the head that must receive the mandatory final same-workflow seal before G2-S7 starts.

### G2-S7 — NEXT

Only after the exact-final-head G2-S6 seal, migrate `RegisterNewAppointment` through certified Services and Scheduler boundaries:

```text
Services selection snapshot
→ SchedulingDemand
→ QueryAvailability
→ selected SlotCandidate
→ optional CreateHold
→ explicit Finalize
→ ConfirmReservation
→ Appointment result references Scheduler reservation
```

Required principles:

```text
Temporal remains orchestration authority
availability shown != reservation persisted
Scheduler never becomes Appointment/Customer authority
replay/idempotency survives workflow retry
current capacity is revalidated at confirmation
provider/channel mechanics remain outside workflow business logic
existing CTA compatibility/regressions stay green
```

### G2-S8

Prove multi-resource assignment if required by the first product slice; otherwise record an explicit, executable deferral rather than implying support.

### G2-S9

Run one clean Scheduler closure over G2-S0–G2-S8 plus protected CTA/Temporal/Services/Persistence regressions and emit final Scheduler evidence.

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

Channel work proceeds independently of Scheduler. Provider mechanics terminate at the canonical compatibility/domain boundary and must not leak provider branches into Temporal workflows or Scheduler.

## Cross-track dependency rules

```text
Channel work must not wait for Scheduler.
Scheduler consumes frozen Services snapshots/demands, not channels.
Integration is not a prerequisite for core scheduling.
Appointment migration is G2-S7.
Persistence ownership stays explicit across PostgreSQL / MongoDB / Object Store.
Agent/MCP waits until deterministic core gates are sufficiently mature.
No Scheduler gate executes until predecessor exact-final-head certification is complete.
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

```text
1. Finish branch documentation/evidence/ledger for G2-S6.
2. Re-run the SAME G2-S6 workflow on the exact final branch head in push + PR contexts.
3. Require all three G2-S6 jobs green in both contexts and preserve artifact digests.
4. Keep PR #32 draft/unmerged; certification does not authorize merge.
5. Do NOT create a G2-S7 branch.
6. Only after G2-S6 exact-final-head seal, implement G2-S7 on build/g2-scheduler.
7. Preserve all G2-S0..G2-S6 and CTA/Temporal/Services regressions during Appointment migration.
```
