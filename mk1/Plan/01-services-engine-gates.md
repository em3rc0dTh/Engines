# G1 — Services Engine Execution Plan

## Status

**S0 CERTIFIED — S1 SERVICES CONTRACTS + PERSISTENCE NEXT**

## Objective

Promote the MK0 Service/Product catalog seed into an independently certifiable Services Engine without modifying the frozen MK0 runtime or mixing Scheduler responsibilities into the catalog.

## Branch discipline

Stage-2 integration branch:

```text
developer
```

G0 audit branch is closed at the documentation/evidence level. The GitHub integration PR could not be opened during this session, so downstream branches preserve exact ancestry from the G0 closure head rather than bypassing that integration boundary.

Current lineage:

```text
main / developer stable MK0 base
        ↓
audit/stage2-core-126-completeness      G0 closed
        ↓
design/mk1-services-engine              G1 design + Golden expectations
        ↓
build/mk1-s0-runtime-promotion          S0 certified baseline
```

No direct ref movement is used to pretend these branches were integrated into `developer`.

---

# Gate sequence

## S0 — Promote certified MK0 runtime snapshot — ✅ PASS

Purpose:

Create `mk1/runtime` as an exact starting snapshot of the stable `mk0/runtime` tree **without modifying `mk0/runtime`**.

Certified evidence:

```text
Source SHA       6dcafa0f5b5704cb9a3a9bcbdaef25fe368006b1
Run              33461008031
Job              99710964036
Result           success
mk0/runtime tree 82dcec4a61ea28283537a2993d047b3bd444edef
mk1/runtime tree 82dcec4a61ea28283537a2993d047b3bd444edef
Fast tests        42 / 42 PASS
B7 runtime        4 / 4 PASS
Appointment       full inherited certification surface PASS
Artifact ID       9783188036
Artifact SHA-256  69a895416918dfb163be680f55c9a6dae2bda35fa60a6dd5107c93e971045958
```

Receipt:

[`../Build/evidence/s0-runtime-promotion-certification-2026-08-31.md`](../Build/evidence/s0-runtime-promotion-certification-2026-08-31.md)

Verdict: `S0 PASS`.

## S1 — Services contracts + persistence migration — 🔧 NEXT

Implement:

- Service revision/lifecycle fields;
- Offering-compatible evolution of `service_products`;
- pricing descriptor persistence;
- requirements;
- dependencies;
- eligibility-rule persistence;
- relational constraints/business scoping;
- TypeScript canonical domain types.

Tests must cover invalid pricing, duration, references and business scope.

Verdict required: `S1 PASS`.

## S2 — Deterministic read engine

Implement/test:

```text
ListServices
GetService
ListOfferings
GetOffering
```

Required proofs:

- deterministic ordering;
- business isolation;
- inactive definitions excluded from new-selection lists;
- revision returned;
- no vertical branching;
- Appointment compatibility adapter can still resolve the old `AppointmentService` / `AppointmentProduct` projection.

Verdict required: `S2 PASS`.

## S3 — Eligibility + recommendation

Implement pure deterministic evaluation:

```text
EvaluateOfferingEligibility
RecommendOfferings
```

Required proofs:

- same input -> same output;
- stable ranking;
- explicit reason codes;
- malformed rule fails typed/closed;
- no Agent/LLM dependency;
- requirements/dependencies reflected in evaluation where applicable.

Verdict required: `S3 PASS`.

## S4 — Versioned management mutations

Implement management operations through the frozen orchestration authority:

```text
CreateService
UpdateService
SetServiceStatus
CreateOffering
UpdateOffering
SetOfferingStatus
```

Required proofs:

- channel/HTTP code does not write PostgreSQL directly;
- business-scoped idempotency;
- exact replay produces one business effect;
- same idempotency identity + different material -> typed conflict;
- optimistic revision check;
- revision conflict does not overwrite;
- audit evidence exists before terminal success where the mutation workflow contract requires it.

Verdict required: `S4 PASS`.

## S5 — Running-Workflow snapshot semantics

Prove that a Temporal consumer can select Offering revision `N`, wait durably, while catalog revision `N+1` is published, and still continue using the selected revision-`N` snapshot unless explicitly refreshed.

Required experiment:

```text
1. start consumer Workflow
2. read/select Offering revision N
3. persist selection in Workflow state
4. update catalog to N+1
5. query running Workflow -> still exposes N snapshot
6. continue/finalize consumer using N semantics
7. new Workflow read -> sees N+1
```

This is the key proof that catalog mutations do not silently rewrite durable business conversations.

Verdict required: `S5 PASS`.

## S6 — Multi-business generality

Seed at least two materially different synthetic business catalogs.

Required proof:

- same engine functions and database schema;
- same Temporal/Activity boundary;
- different pricing/duration/requirements;
- one eligibility/recommendation scenario;
- no business/vertical-specific conditional branch in Services Engine implementation.

Verdict required: `S6 PASS`.

## S7 — Appointment regression integration

Adapt `RegisterNewAppointment` in MK1 runtime to consume Services Engine projections while preserving the certified orchestration behavior:

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

- existing appointment catalog happy path remains functional;
- Service/Offering snapshot is revision-aware;
- pricing/requirements may be displayed/evaluated without changing the Scheduler fixture;
- slot-race regression remains passing.

Verdict required: `S7 PASS`.

## S8 — Clean Compose Services certification

From a clean environment:

```text
npm ci
strict typecheck/tests
Docker Compose clean boot
migrations
Services management Workflow
Services read/recommendation consumers
PostgreSQL verification
Mongo audit verification where required
MK0 regression subset
```

Produce:

- source SHA;
- run ID;
- job ID;
- artifact ID + SHA-256;
- human-readable receipt;
- Golden case accounting.

Verdict required: `G1 SERVICES ENGINE CERTIFIED`.

---

# Golden case families

The frozen Golden dataset includes:

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

---

# Build-stop conditions

Stop and redesign before continuing if any gate requires:

- channel code to implement Service business policy;
- Workflow code to use a DB driver directly;
- arbitrary executable JavaScript/SQL stored as eligibility rules;
- vertical-name branching;
- mutable catalog semantics to leak silently into an already-running Workflow;
- Scheduler capacity/slot logic to become Services authority;
- MongoDB to become canonical catalog truth.

---

# Exit criteria

G1 is not complete because a migration exists or a catalog endpoint returns data.

All S0–S8 gates must be closed or explicitly removed by a documented design decision with corresponding revised closure claim.
