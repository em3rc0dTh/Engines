# G1 — Services Engine Execution Plan

## Status

**S0–S3 CERTIFIED — S4 VERSIONED MANAGEMENT MUTATIONS NEXT**

## Objective

Promote the MK0 Service/Product catalog seed into an independently certifiable Services Engine without modifying the frozen MK0 runtime, moving business authority into a channel, or mixing Scheduler responsibilities into the catalog.

## Branch discipline

Stage-2 integration branch:

```text
developer
```

G0 is closed at the foundation-audit level. Downstream work preserves exact ancestry while integration remains pending:

```text
main / developer stable MK0 base
        ↓
audit/stage2-core-126-completeness      G0 closed
        ↓
design/mk1-services-engine              G1 design + Golden expectations
        ↓
build/mk1-s0-runtime-promotion          S0 certified baseline
        ↓
build/mk1-s1-services-contracts         S1 certified contracts/persistence
        ↓
build/mk1-s2-services-read-engine       S2 certified deterministic reads
        ↓
build/mk1-s3-services-eligibility       S3 certified eligibility/recommendation
```

No direct ref movement is used to pretend an unreviewed integration occurred, and no MK1 branch rewrites `mk0/runtime`.

---

# Gate sequence

## S0 — Promote certified MK0 runtime snapshot — ✅ PASS

Purpose: create `mk1/runtime` as an exact executable starting snapshot of the stable `mk0/runtime` tree and independently rerun inherited certification from the MK1 path.

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

Receipt: [`../Build/evidence/s0-runtime-promotion-certification-2026-08-31.md`](../Build/evidence/s0-runtime-promotion-certification-2026-08-31.md)

Verdict: `S0 PASS`.

## S1 — Services contracts + persistence migration — ✅ PASS

Certified implementation:

- Service revision/lifecycle fields;
- Offering-compatible evolution of `service_products`;
- typed pricing descriptor persistence;
- requirements;
- dependencies;
- eligibility-rule persistence;
- relational constraints and business scoping;
- canonical TypeScript Services types and validation.

```text
Source SHA       550cdca619856fe246ab569588f9036a7025e7a7
Run              33461510248
Job              99712416091
Result           success
Services tests    10 / 10 PASS
Inherited tests   40 / 40 PASS
Persistence       SERVICES_S1_PERSISTENCE_PASS
Appointment       inherited full certification surface PASS
Artifact ID       9783331341
Artifact SHA-256  7f69bf9d33b2e854d5cc4941b41059dc358437675cf0bbb6d102c29f129b2097
```

Receipt: [`../Build/evidence/s1-services-contracts-certification-2026-08-31.md`](../Build/evidence/s1-services-contracts-certification-2026-08-31.md)

Verdict: `S1 PASS`.

## S2 — Deterministic read engine — ✅ PASS

Certified operations:

```text
ListServices
GetService
ListOfferings
GetOffering
```

Certified proofs:

- deterministic Service ordering;
- deterministic Offering ordering;
- business isolation for ids and codes;
- inactive definitions excluded from new-selection lists;
- explicit historical identity lookup remains available and business-scoped;
- Service/Offering revisions returned;
- full Offering projection includes pricing, requirements, dependencies and eligibility data;
- compatibility projections preserve inherited Appointment contracts;
- Service/Offering snapshot captures both revisions;
- Services repository contains no tested vertical branching.

```text
Source SHA       cec97a2b90a7aee8ae1deb3660bad0d7a759ace6
Run              33461895218
Job              99713587556
Result           success
Probe            SERVICES_S2_READ_ENGINE_PASS
Artifact ID       9783467265
Artifact SHA-256  0b7c0addd1849da87fe03afc93053a5df7c3fddf674f9baf5a78e3400d9a3677
Appointment       full inherited certification surface PASS
```

Receipt: [`../Build/evidence/s2-services-read-engine-certification-2026-08-31.md`](../Build/evidence/s2-services-read-engine-certification-2026-08-31.md)

Verdict: `S2 PASS`.

## S3 — Eligibility + recommendation — ✅ PASS

Certified operations:

```text
EvaluateOfferingEligibility
RecommendOfferings
```

Certified proofs:

- same Offering + same canonical context produces the same decision;
- recommendation is independent of input ordering;
- stable rank is `priority DESC`, `name ASC`, `offeringId ASC`;
- explicit configured reason codes survive evaluation;
- malformed eligibility rules fail closed;
- inactive Offerings fail closed;
- required Service requirements participate in eligibility;
- `REQUIRES` and `EXCLUDES` dependencies participate in eligibility;
- PostgreSQL-hydrated definitions flow into the pure evaluator;
- no Agent/LLM dependency;
- inherited Appointment certification remains passing.

```text
Source SHA       a6974cdbb669b66a07b8780d5e20c960d6a0cd64
Run              33531884206
Job              99936776923
Result           success
Probe            SERVICES_S3_RECOMMENDATION_PASS
Artifact ID       9810084527
Artifact SHA-256  fa6a9efaa67309a4255dbce62fe362402ff453643e90f63c82c1457099e9de60
```

Failure provenance is retained: run `33531803288` failed strict typecheck because the test fixture assigned `undefined` to exact optional fields. The helper was corrected without weakening a runtime/domain invariant; only run `33531884206` is certification authority.

Receipt: [`../Build/evidence/s3-services-eligibility-certification-2026-09-01.md`](../Build/evidence/s3-services-eligibility-certification-2026-09-01.md)

Verdict: `S3 PASS`.

## S4 — Versioned management mutations — 🔧 NEXT

Implement management operations through the orchestration authority:

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
- mutation intent is business-scoped before persistence;
- business-scoped idempotency;
- exact replay produces one business effect;
- same idempotency identity + different material produces a typed conflict;
- optimistic revision check;
- stale revision conflict does not overwrite newer business truth;
- lifecycle transitions are explicit rather than row deletion masquerading as state;
- persistence occurs through Activities/ports, not a DB driver inside Workflow code;
- audit evidence exists before terminal success where the mutation Workflow contract requires it;
- failures/retries cannot create duplicate Service or Offering business effects.

Verdict required: `S4 PASS`.

## S5 — Running-Workflow snapshot semantics

Prove that a Temporal consumer can select Offering revision `N`, wait durably while catalog revision `N+1` is published, and continue using the selected revision-`N` snapshot unless explicitly refreshed.

Required experiment:

```text
1. start consumer Workflow
2. read/select Offering revision N
3. persist selection snapshot in Workflow state
4. update catalog to N+1 through S4 authority
5. query running Workflow -> still exposes N snapshot
6. continue/finalize consumer using N semantics
7. new Workflow read -> sees N+1
```

Required negative proof: mutable catalog head must not silently replace an already-selected durable snapshot.

Verdict required: `S5 PASS`.

## S6 — Multi-business generality

Seed at least two materially different synthetic business catalogs.

Required proof:

- same engine functions and database schema;
- same Temporal/Activity boundary;
- different pricing/duration/requirements;
- at least one eligibility/recommendation scenario per material model difference;
- same Service/Offering lifecycle and revision contract;
- no business/vertical-name conditional branch in Services Engine implementation.

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

- existing Appointment happy path remains functional;
- Service/Offering selection is revision-aware;
- pricing/requirements can be displayed/evaluated without changing Scheduler authority;
- selected Service/Offering snapshot is durable enough for S5 semantics;
- idempotency replay remains exact;
- slot-race regression remains passing.

Verdict required: `S7 PASS`.

## S8 — Clean Compose Services certification

From a clean environment:

```text
npm ci
strict typecheck/tests
Docker Compose clean boot
migrations
Services management Workflows
Services read/recommendation consumers
running-Workflow snapshot proof
multi-business proof
PostgreSQL verification
Mongo audit verification where required
MK0 regression subset
Appointment integration regression
```

Produce:

- source SHA;
- run ID;
- job ID;
- artifact ID + SHA-256;
- human-readable receipt;
- Golden case accounting;
- explicit remaining non-claims.

Verdict required: `G1 SERVICES ENGINE CERTIFIED`.

---

# Golden case families

The frozen Golden dataset families are:

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

Stop and redesign before continuing if any gate requires:

- channel code to implement Service business policy;
- Workflow code to use a DB driver directly;
- arbitrary executable JavaScript/SQL stored as eligibility rules;
- vertical-name branching;
- mutable catalog semantics to leak silently into an already-running Workflow;
- Scheduler capacity/slot logic to become Services authority;
- MongoDB to become canonical catalog truth;
- bypassing optimistic revision control to make a test pass;
- relabeling a failed or unexecuted gate as certified.

# Manual-test boundary

The owner is **not** required for a manual test during S0–S3. Automated contract, persistence, clean-Compose and inherited runtime evidence are sufficient for those gates.

A manual test should be requested only when it can add evidence not already supplied by deterministic CI/laboratory execution. When that boundary is reached, the project status must explicitly say:

```text
🧪 READY FOR YOUR TEST
```

# Exit criteria

G1 is not complete because a migration exists, a catalog endpoint returns data, or recommendation tests pass.

All S0–S8 gates must be closed, or explicitly removed by a documented design decision with corresponding revised closure claim, before the repository may state `G1 SERVICES ENGINE CERTIFIED`.
