# G1 — Services Engine Execution Plan

## Status

**PRE-BUILD PLAN — DESIGN BASELINE ESTABLISHED**

## Objective

Promote the MK0 Service/Product catalog seed into an independently certifiable Services Engine without modifying the frozen MK0 runtime or mixing Scheduler responsibilities into the catalog.

## Branch discipline

Stage-2 integration branch:

```text
developer
```

G0 audit branch is closed at the documentation level. The GitHub connector was unable to open the integration PR during this session, so the Services design branch was created from the exact G0 closure head to preserve the intended ancestry:

```text
design/mk1-services-engine
```

No runtime build should be merged to `developer` until the G0 integration path is available and the design/golden expectations below are frozen.

---

# Gate sequence

## S0 — Promote certified MK0 runtime snapshot

Purpose:

Create `mk1/runtime` as an exact starting snapshot of the stable `mk0/runtime` tree **without modifying `mk0/runtime`**.

Required evidence:

```text
mk0/runtime tree SHA == initial mk1/runtime tree SHA
```

The promoted snapshot must pass the existing MK0 regression checks before new Services behavior is introduced.

Verdict required: `S0 PASS`.

## S1 — Services contracts + persistence migration

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

The frozen Golden dataset should include at least:

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
