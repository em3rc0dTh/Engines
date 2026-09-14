# MK1 — Steps 3–4–5 Execution Roadmap

## Status

**SCHEDULER G2-S6 CERTIFIED — G2-S7 NEXT**

This roadmap advances the platform while preserving certified authority boundaries. Scheduler and Integration remain separate engines; later gates never inherit claims merely because earlier contracts or schema exist.

G2-S6 exact-final-head evidence is kept on PR #32 after the documentation-complete branch seal. The branch itself is not mutated merely to copy final run IDs/digests, because that would create a new unsealed head.

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

Scheduler owns concrete time/resource allocation; Services owns catalog/commercial and abstract scheduling semantics.

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

Frozen contracts, PostgreSQL Scheduler schema, immutable `SchedulingDemand`, resource/schedule/override persistence, hold/reservation assignment schema, operation identity ledger and provider-agnostic boundaries.

### G2-S1 — CERTIFIED

Versioned/idempotent resource and schedule management with optimistic revision checks and business-scoped mutation safety.

### G2-S2 — CERTIFIED

Deterministic one-resource availability over ACTIVE resources, capability/resource-kind matching, recurring schedules, overrides, segment-wise capacity, reservations, logically-unexpired holds, buffers and deterministic candidate ordering.

### G2-S3 — CERTIFIED

```text
two concurrent confirmations for final capacity
→ exactly one RESERVED success
→ exactly one CAPACITY_CONFLICT
→ exactly one persisted reservation + assignment + successful command
→ loser commits zero business effect
```

Stale candidates are revalidated at commit; replay/idempotency is preserved.

### G2-S4 — CERTIFIED

Durable hold create/release/replay, persisted-time logical expiry independent of cleanup timing, restart/re-entry correctness and atomic hold consumption into reservation.

### G2-S5 — CERTIFIED

Same implementation, materially different businesses, strict isolation for resource/schedule/availability/hold/reservation/idempotency state, cross-business references fail closed and no customer/provider forks in Scheduler core.

### G2-S6 — CERTIFIED

Services exposes a versioned abstract scheduling profile:

```text
capacityUnits
requiredCapabilities[].code
requiredCapabilities[].quantity
requiredCapabilities[].resourceKinds?
buffers.beforeMinutes
buffers.afterMinutes
```

No concrete Scheduler identity is embedded in that profile.

Runtime handoff:

```text
frozen ServicesSelectionSnapshot
→ materialize SchedulingDemand by value
→ validate
→ persist scheduler_demands + snapshot_hash
→ Scheduler executes from persisted demand
```

Certified N→N+1 invariant:

```text
Services N → demand N → Scheduler N semantics
Services publishes materially different N+1
demand N + hash remain unchanged
Scheduler still executes N semantics from demand N
new demand from N+1 sees N+1 semantics
same demand identity + same material replays
same demand identity + changed material fails closed
```

Candidate head `9d6af52e5749e83469e7d4aca89775753ea2f4e5` passed dedicated push `34908156644` and PR `34908161495`; exact documentation-complete seal evidence is maintained on PR #32.

### G2-S7 — NEXT

Migrate `RegisterNewAppointment` through the already-certified boundaries:

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

Mandatory G2-S7 invariants:

```text
Temporal remains orchestration authority
availability shown != reservation persisted
Scheduler does not become Appointment/Customer authority
Workflow retry/replay does not duplicate durable reservation
commit-time current capacity is revalidated
provider/channel mechanics remain outside workflow business logic
existing CTA compatibility and G2-S0..G2-S6 regressions remain green
```

### G2-S8

Prove multi-resource assignment if required by the first product slice; otherwise record an explicit executable deferral rather than implying support.

### G2-S9

Run one clean Scheduler closure over G2-S0–G2-S8 plus protected CTA/Temporal/Services/Persistence regressions and emit final Scheduler evidence.

## Track C — Integration boundary

```text
I0 Integration command/event contracts
I1 connection/provider registry + secret references
I2 durable outbound command/retry ledger
I3 authenticated inbound webhook/idempotency ledger
I4 first real provider adapter
I5 Temporal composition + failure/recovery proof
```

Integration remains separate from core scheduling.

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
1. Preserve G2-S6 exact-final-head proof on PR #32 without another branch mutation.
2. Keep PR #32 draft/unmerged; certification does not authorize merge.
3. Do NOT create a G2-S7 branch.
4. Begin G2-S7 from the sealed build/g2-scheduler head only.
5. Migrate RegisterNewAppointment through Services snapshot → SchedulingDemand → availability/hold/reservation.
6. Preserve Temporal authority and current CTA/provider boundaries.
7. Re-run all protected G2-S0..G2-S6 regressions under the dedicated G2-S7 gate.
```
