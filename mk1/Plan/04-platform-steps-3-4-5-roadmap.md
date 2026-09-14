# MK1 — Steps 3–4–5 Execution Roadmap

## Status

**SCHEDULER G2-S2 CERTIFIED — G2-S3 NEXT**

This roadmap advances the platform while preserving already certified authority boundaries. Scheduler and Integration remain separate engines; later gates never inherit claims simply because an earlier schema or contract exists.

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
  G2-S3 Atomic reservation conflict     ⏭️ NEXT

Step 5 Integration Engine               BOUNDARY DESIGN / BUILD LATER
```

Exact branch heads, workflow runs and artifact digests live in gate receipts/evidence because documentation commits themselves change the head and therefore must be re-certified.

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
G2-S3 Atomic reservation + concurrency conflict                ⏭️ NEXT
G2-S4 Holds + expiry + replay                                   OPEN
G2-S5 Multi-business generality                                 OPEN
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

Certified deterministic read-only availability for the first one-resource demand slice:

```text
business scope
ACTIVE resource filtering
capability + resource-kind matching
weekly schedules
AVAILABLE / UNAVAILABLE / CAPACITY overrides
segment-wise effective capacity
RESERVED allocations
persisted ACTIVE holds
pre/post buffers
configurable granularity
deterministic candidate IDs
stable candidate ordering
SlotCandidate advisory/non-persisted
```

Stable ordering:

```text
startAt ASC
endAt ASC
assignment resource IDs ASC
candidateId ASC
```

G2-S2 deliberately does not claim logical hold expiry or atomic commit-time conflict correctness.

### G2-S3 — NEXT

Certify `ConfirmReservation` as the first atomic allocation mutation and prove the critical invariant:

```text
two concurrent confirmations for last capacity
→ exactly one success
→ exactly one typed conflict
→ exactly one persisted reservation
→ no partial second business effect
```

Required G2-S3 properties:

```text
business-scoped reservation command
same-operation replay idempotency
same-operation different-material rejection
commit-time resource/status/schedule/override revalidation
commit-time capacity revalidation
stale SlotCandidate cannot be trusted as authority
deterministic lock ordering / serialization for resource capacity
reservation + assignment atomic insert
typed SCHEDULER_CAPACITY_CONFLICT race loser
G2-S0/S1/S2 predecessor regressions
Appointment remains outside Scheduler during the gate
```

Passing G2-S3 establishes conflict correctness but does not itself migrate Appointment; Appointment migration remains G2-S7.

### G2-S4

Add expiring holds and prove logical expiry, replay and restart semantics. Cleanup is housekeeping; expired holds must not remain blocking truth.

### G2-S5

Run materially different business fixtures through the same Scheduler implementation with zero vertical branches.

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
Appointment migration remains a later dedicated gate.
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
1. Re-certify G2-S2 on the exact final documentation/ledger head.
2. Keep PR #31 draft/unmerged; certification does not authorize merge.
3. Only after exact-head G2-S2 PASS, branch G2-S3 from that head.
4. Implement atomic one-resource ConfirmReservation.
5. Revalidate scheduling truth inside the reservation transaction.
6. Prove concurrent last-capacity winner/loser behavior.
7. Preserve operation-id replay and material-conflict semantics.
8. Do not migrate Appointment in G2-S3.
```
