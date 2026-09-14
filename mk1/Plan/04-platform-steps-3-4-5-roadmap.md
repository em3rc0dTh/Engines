# MK1 — Steps 3–4–5 Execution Roadmap

## Status

**SCHEDULER G2-S1 CERTIFIED — G2-S2 NEXT**

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
  G2-S2 Deterministic availability      ⏭️ NEXT

Step 5 Integration Engine               BOUNDARY DESIGN / BUILD LATER
```

The exact current Scheduler branch head, workflow runs and artifact digests are recorded in the active PR and gate evidence receipt rather than pinned here, because documentation commits themselves change the branch head and must be re-certified.

## Mandatory Scheduler certification rule

Scheduler is governed by a sequential hard-gate policy:

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

The ledger must always expose a contiguous `CERTIFIED` prefix, at most one `NEXT` gate immediately after it, and only `OPEN` gates after that. Every certified gate must retain its own workflow, receipt and terminal marker.

## Track A — Services completion

**CLOSED.**

```text
S6 Multi-business generality                     ✅ CERTIFIED
S7 Appointment integration with Services         ✅ CERTIFIED
S8 Final clean G1 certification                  ✅ CERTIFIED
G1 Services Engine                               ✅ CERTIFIED
```

The Appointment flow consumes canonical Services snapshots rather than bypassing Services authority.

## Track B — Scheduler design/build

Scheduler owns concrete time/resource allocation; it does not own catalog/commercial semantics.

```text
G2-S0 Contract + persistence foundation                         ✅ CERTIFIED
G2-S1 Resource/capability/schedule management                   ✅ CERTIFIED
G2-S2 Deterministic availability engine                        ⏭️ NEXT
G2-S3 Atomic reservation + concurrency conflict                OPEN
G2-S4 Holds + expiry + replay                                   OPEN
G2-S5 Multi-business generality                                 OPEN
G2-S6 Services snapshot/demand integration                      OPEN
G2-S7 Appointment Workflow integration                          OPEN
G2-S8 Multi-resource assignment proof or explicit deferral      OPEN
G2-S9 Final clean Scheduler certification                       OPEN
```

### G2-S0 — CERTIFIED

Frozen foundation:

```text
Scheduler contracts and validation
PostgreSQL Scheduler schema
immutable SchedulingDemand persistence
resource/capability/schedule/override persistence
hold/reservation assignment schema
scheduler_commands operation identity ledger
provider-agnostic boundary guards
Appointment remains outside Scheduler
```

### G2-S1 — CERTIFIED

Executable management surface:

```text
CreateResource
UpdateResource
SetResourceStatus
SetScheduleTemplate
PutScheduleOverride
DeleteScheduleOverride
```

Certified semantics:

```text
resource revision control                       PASS
capability replacement management               PASS
schedule template revision control              PASS
override create/update/delete lifecycle          PASS
same operation + same material replay           PASS
same operation + different material rejection   PASS
cross-business mutation isolation               PASS
G2-S0 predecessor regression                    PASS
inherited CTA/Temporal path regression           PASS
SCHEDULER_G2_S1_CERTIFICATION_PASS               PRESENT
```

A failed first candidate exposed an order-sensitive capability round-trip assertion; the gate was not promoted. The probe was corrected to use canonical capability ordering and the replacement candidate passed from a clean lab. This failure remains part of the evidence history.

### G2-S2 — NEXT

Certify **deterministic read-only availability generation** from immutable `SchedulingDemand` plus current Scheduler truth.

Required first slice:

```text
one-resource demand first
business scope
ACTIVE resource filtering
capability + resource-kind matching
weekly schedules
schedule overrides
capacity constraints
active reservations
active holds as current persisted blocking truth
pre/post buffers
deterministic candidate IDs
deterministic stable ordering
SlotCandidate remains advisory/non-persisted
```

Stable ordering remains:

```text
startAt ASC
endAt ASC
assignment resource IDs ASC
candidateId ASC
```

G2-S2 must not claim reservation atomicity, stale-candidate revalidation at commit time, or logical hold-expiry semantics; those belong to G2-S3/G2-S4.

### G2-S3

Certify the critical conflict invariant:

```text
two concurrent confirmations for last capacity
→ exactly one success
→ exactly one typed conflict
→ no partial second business effect
```

Only after G2-S3 may Appointment reservation logic migrate to Scheduler.

### G2-S4

Add expiring holds and prove logical expiry, replay and restart semantics. Cleanup is housekeeping; expired holds must not remain blocking truth.

### G2-S5

Run materially different business fixtures through the same Scheduler implementation with zero vertical branches.

### G2-S6

Feed Scheduler from immutable Services `SchedulingDemand` derived from frozen Offering revisions. Prove catalog head N+1 cannot silently mutate an active demand from N.

### G2-S7

Migrate `RegisterNewAppointment` only after G2-S3 conflict correctness is certified:

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

Preserve the invariant:

```text
availability shown != reservation persisted
```

### G2-S8

Prove multi-resource assignment if required by the first product slice; otherwise record an explicit testable deferral instead of implying support.

### G2-S9

Run one clean Scheduler closure suite over G2-S0–G2-S8 plus protected CTA/Temporal/Services/Persistence regressions and emit the final Scheduler receipt.

## Track C — Integration boundary

Do not build a broad provider platform yet. Prepare common contracts, then choose the first concrete integration from product need.

```text
I0 Integration command/event contracts
I1 connection/provider registry + secret references
I2 durable outbound command/retry ledger
I3 authenticated inbound webhook/idempotency ledger
I4 first real provider adapter
I5 Temporal composition + failure/recovery proof
```

## Track D — channel evolution

Channel work can proceed independently of Scheduler. Channel/provider mechanics terminate at the canonical compatibility/domain boundary and must not leak provider-specific branches into Temporal business workflows or Scheduler.

## Cross-track dependency rules

```text
Channel work must not wait for Scheduler.
Scheduler consumes Services snapshots, not channels.
Integration is not a prerequisite for core scheduling.
Appointment may migrate to Scheduler only after G2-S3 conflict correctness.
Persistence ownership remains explicit across PostgreSQL / MongoDB / Object Store.
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
1. Re-certify G2-S1 on the exact final documentation/ledger head.
2. Keep PR #30 draft/unmerged; certification does not authorize merge.
3. Only after exact-head G2-S1 PASS, branch G2-S2 from that head.
4. Build deterministic read-only availability for the one-resource baseline.
5. Prove schedules + overrides + capabilities + capacity + allocations + buffers.
6. Preserve SlotCandidate as advisory and non-persisted.
7. Do not build reservation confirmation until G2-S2 is independently certified.
8. Do not migrate Appointment until G2-S3 is independently certified.
```
