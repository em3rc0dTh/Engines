# G1 — Services Engine Execution Plan

## Status

**S0–S4 CERTIFIED — S5 RUNNING-WORKFLOW SNAPSHOT SEMANTICS NEXT**

## Objective

Promote the MK0 Service/Product catalog seed into an independently certifiable Services Engine without modifying the frozen MK0 runtime, moving business authority into a channel, or mixing Scheduler responsibilities into the catalog.

## Branch discipline

Stage-2 integration base remains `developer`; the work lineage preserves exact ancestry:

```text
main / developer stable MK0 base
        ↓
audit/stage2-core-126-completeness      G0 closed
        ↓
design/mk1-services-engine              G1 design + Golden expectations
        ↓
build/mk1-s0-runtime-promotion          S0 certified baseline
        ↓
build/mk1-s1-services-contracts         S1 contracts/persistence
        ↓
build/mk1-s2-services-read-engine       S2 deterministic reads
        ↓
build/mk1-s3-services-eligibility       S3 eligibility/recommendation
        ↓
build/mk1-s4-services-management        S4 versioned management
```

No MK1 branch rewrites the certified `mk0/runtime` specimen.

---

# Gate sequence

## S0 — Promote certified MK0 runtime snapshot — ✅ PASS

```text
Source SHA       6dcafa0f5b5704cb9a3a9bcbdaef25fe368006b1
Run              33461008031
Job              99710964036
Artifact ID      9783188036
Artifact SHA256  69a895416918dfb163be680f55c9a6dae2bda35fa60a6dd5107c93e971045958
```

Verdict: `S0 PASS`.

Receipt: [`../Build/evidence/s0-runtime-promotion-certification-2026-08-31.md`](../Build/evidence/s0-runtime-promotion-certification-2026-08-31.md)

## S1 — Services contracts + persistence — ✅ PASS

Certified surface:

- Service revision/lifecycle;
- Offering-compatible evolution of `service_products`;
- typed pricing;
- requirements;
- dependencies;
- eligibility-rule persistence;
- relational constraints and business scoping.

```text
Source SHA       550cdca619856fe246ab569588f9036a7025e7a7
Run              33461510248
Job              99712416091
Artifact ID      9783331341
Artifact SHA256  7f69bf9d33b2e854d5cc4941b41059dc358437675cf0bbb6d102c29f129b2097
```

Verdict: `S1 PASS`.

Receipt: [`../Build/evidence/s1-services-contracts-certification-2026-08-31.md`](../Build/evidence/s1-services-contracts-certification-2026-08-31.md)

## S2 — Deterministic read engine — ✅ PASS

Certified operations:

```text
ListServices
GetService
ListOfferings
GetOffering
```

Certified proofs include deterministic ordering, business isolation, lifecycle-aware lists, explicit historical lookup, revision visibility, complete Offering hydration and Appointment compatibility.

```text
Source SHA       cec97a2b90a7aee8ae1deb3660bad0d7a759ace6
Run              33461895218
Job              99713587556
Artifact ID      9783467265
Artifact SHA256  0b7c0addd1849da87fe03afc93053a5df7c3fddf674f9baf5a78e3400d9a3677
```

Verdict: `S2 PASS`.

Receipt: [`../Build/evidence/s2-services-read-engine-certification-2026-08-31.md`](../Build/evidence/s2-services-read-engine-certification-2026-08-31.md)

## S3 — Eligibility + recommendation — ✅ PASS

Certified operations:

```text
EvaluateOfferingEligibility
RecommendOfferings
```

Certified proofs include deterministic evaluation, stable rank, explicit reason codes, fail-closed malformed rules, requirements/dependencies evaluation and no Agent/LLM dependency.

```text
Source SHA       a6974cdbb669b66a07b8780d5e20c960d6a0cd64
Run              33531884206
Job              99936776923
Artifact ID      9810084527
Artifact SHA256  fa6a9efaa67309a4255dbce62fe362402ff453643e90f63c82c1457099e9de60
```

Verdict: `S3 PASS`.

Receipt: [`../Build/evidence/s3-services-eligibility-certification-2026-09-01.md`](../Build/evidence/s3-services-eligibility-certification-2026-09-01.md)

## S4 — Versioned management mutations — ✅ PASS

Certified operations:

```text
CreateService
UpdateService
SetServiceStatus
CreateOffering
UpdateOffering
SetOfferingStatus
```

Implementation boundary:

```text
caller
  ↓
Temporal servicesManagementWorkflow
  ↓
deterministic command validation
  ↓
reference preflight Activity
  ↓
PostgreSQL mutation Activity
  ↓
service_mutation_commands + canonical catalog truth
  ↓
Mongo services_mutation_audit
  ↓
terminal result
```

Certified proofs:

- no channel/HTTP direct PostgreSQL mutation path was introduced;
- mutation commands are explicitly business-scoped;
- idempotency identity is scoped by operation + business + idempotency key hash;
- exact replay returns one business effect and a `REPLAYED` outcome;
- same idempotency identity with different material returns `IDEMPOTENCY_CONFLICT`;
- the same external idempotency key may be used independently by two businesses;
- updates require `expectedRevision`;
- stale Service/Offering updates return `REVISION_CONFLICT` and do not overwrite newer truth;
- lifecycle changes use ACTIVE/INACTIVE state and increment revision rather than deleting rows;
- PostgreSQL mutation occurs through Activities, not a DB driver inside Workflow code;
- Mongo semantic audit is awaited before terminal Workflow return;
- missing dependency references are rejected before mutation;
- missing-dependency safety proof confirms no partial Offering and no command-ledger row are left behind;
- inherited Appointment certification remains passing.

Final certification authority:

```text
Source SHA       f3e54b853af5f01fb2e9ed7d032f784e3cffb81e
Run              33538554471
Job              99959020329
Result           success
Artifact ID      9812703293
Artifact SHA256  275dd054247a89f0f4f8fe6c9244685d06cdd72117408c5282acbf6139b67a9c
```

The earlier green run `33538120900` is retained as historical implementation evidence. After review, dependency-reference rejection was hardened and separately proven; only run `33538554471` is the final S4 authority.

Verdict: `S4 PASS`.

Receipt: [`../Build/evidence/s4-services-management-certification-2026-09-01.md`](../Build/evidence/s4-services-management-certification-2026-09-01.md)

## S5 — Running-Workflow snapshot semantics — 🔧 NEXT

Purpose: prove a long-running Temporal consumer cannot silently change Service/Offering semantics when the catalog head changes underneath it.

Required experiment:

```text
1. start consumer Workflow
2. load/select Offering revision N
3. persist the complete selected Service/Offering snapshot in Workflow state
4. enter a durable waiting phase
5. publish catalog revision N+1 through the certified S4 management Workflow
6. query the waiting consumer -> selected snapshot is still N
7. continue/finalize the original consumer -> uses N semantics
8. start a new consumer -> reads N+1
```

Required proofs:

- snapshot contains stable Service + Offering identities and both revisions;
- mutable repository/catalog head is never reinterpreted as the selected snapshot;
- Workflow Query exposes the frozen snapshot while waiting;
- Worker restart/replay does not refresh the snapshot silently;
- S4 mutations remain the only supported management path during the experiment;
- new Workflow reads see N+1 while existing Workflow remains at N;
- deterministic replay remains valid;
- no Agent/LLM is required for snapshot correctness.

Verdict required: `S5 PASS`.

## S6 — Multi-business generality

Seed at least two materially different synthetic business catalogs.

Required proof:

- same engine functions/schema/Temporal boundaries;
- materially different duration/pricing/requirements/policies;
- eligibility/recommendation scenarios;
- versioned management scenario;
- no business/vertical-specific conditional branch in Services Engine implementation.

Verdict required: `S6 PASS`.

## S7 — Appointment regression integration

Adapt MK1 `RegisterNewAppointment` to consume Services Engine projections while preserving the certified orchestration behavior:

```text
Customer
→ Service
→ Offering
→ Date
→ Slot
→ explicit finalize
→ atomic booking
```

G1 must not redesign Scheduler here.

Required proofs:

- inherited Appointment happy path remains functional;
- selection captures revision-aware Service/Offering snapshot;
- pricing/requirements may be exposed without moving Scheduler semantics into Services;
- slot-race regression remains passing;
- catalog head changes cannot mutate an already-selected Offering snapshot.

Verdict required: `S7 PASS`.

## S8 — Final clean Compose Services certification

From a clean environment execute the complete G1 surface:

```text
npm ci
strict typecheck/tests
clean Docker Compose boot
migrations
S1 persistence checks
S2 reads
S3 eligibility/recommendation
S4 versioned management
S5 snapshot semantics
S6 multi-business proof
S7 Appointment integration/regression
PostgreSQL verification
Mongo audit verification
MK0 regression subset
```

Produce source SHA, run/job, artifact digest, Golden case accounting, closure receipt and explicit non-claims.

Verdict required: `G1 SERVICES ENGINE CERTIFIED`.

---

# Golden case families

```text
CAT-*   catalog identity/lifecycle/read behavior
PRC-*   pricing and duration validation
REQ-*   requirements/dependencies
ELG-*   eligibility evaluation
REC-*   deterministic recommendation
REV-*   revisions/snapshot semantics
IDM-*   mutation idempotency/conflict
ISO-*   multi-business isolation
CMP-*   compatibility/Appointment regression
```

No case may be counted PASS without executable evidence or a clearly classified static contract check.

# Build-stop conditions

Stop and redesign if a gate requires:

- channel code to implement Service business policy;
- Workflow code to use a DB driver directly;
- arbitrary executable JavaScript/SQL as eligibility rules;
- vertical-name branching;
- mutable catalog semantics to leak into a running Workflow;
- Scheduler capacity/slot logic to become Services authority;
- MongoDB to become canonical catalog truth;
- last-write-wins updates that bypass revision conflict detection.

# Exit criteria

G1 is not complete because management mutations now work. S0–S8 must all be closed or explicitly removed by a documented design decision with a correspondingly reduced closure claim.
