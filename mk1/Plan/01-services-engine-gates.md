# G1 — Services Engine Execution Plan

## Status

**S0–S6 CERTIFIED — S7 APPOINTMENT INTEGRATION NEXT**

## Objective

Promote the MK0 Service/Product seed into an independently certifiable, business-scoped Services Engine without modifying frozen `mk0/runtime`, moving business authority into a channel, or absorbing Scheduler responsibilities into the catalog.

## Active branch discipline

Historical intermediate branches may be removed after terminal evidence is retained. Meaningful terminal/version branches remain visible.

Current Services narrative:

```text
release/mk0-complete
        ↓
... certified Services S0–S5 history ...
        ↓
build/mk1-s5-services-snapshots
        ↓
design/mk1-services-scheduler-integration
        ↓
build/mk1-s6-services-multibusiness       ✅ CERTIFIED
        ↓
build/mk1-s7-appointment-services-integration   NEXT
```

No MK1 branch rewrites the certified `mk0/runtime` specimen.

---

# Gate sequence

## S0 — Runtime promotion — ✅ PASS

```text
Source SHA       6dcafa0f5b5704cb9a3a9bcbdaef25fe368006b1
Run              33461008031
Job              99710964036
Artifact         9783188036
SHA256           69a895416918dfb163be680f55c9a6dae2bda35fa60a6dd5107c93e971045958
```

Receipt: [`../Build/evidence/s0-runtime-promotion-certification-2026-08-31.md`](../Build/evidence/s0-runtime-promotion-certification-2026-08-31.md)

## S1 — Contracts + persistence — ✅ PASS

Certified: Service/Offering identities, lifecycle, typed pricing, duration, requirements, dependencies, deterministic eligibility-rule persistence, revisions and business scoping.

```text
Source SHA       550cdca619856fe246ab569588f9036a7025e7a7
Run              33461510248
Job              99712416091
Artifact         9783331341
SHA256           7f69bf9d33b2e854d5cc4941b41059dc358437675cf0bbb6d102c29f129b2097
```

Receipt: [`../Build/evidence/s1-services-contracts-certification-2026-08-31.md`](../Build/evidence/s1-services-contracts-certification-2026-08-31.md)

## S2 — Deterministic read engine — ✅ PASS

Certified operations:

```text
ListServices
GetService
ListOfferings
GetOffering
```

Proof includes stable ordering, lifecycle-aware lists, revision visibility, full Offering hydration and business isolation.

```text
Source SHA       cec97a2b90a7aee8ae1deb3660bad0d7a759ace6
Run              33461895218
Job              99713587556
Artifact         9783467265
SHA256           0b7c0addd1849da87fe03afc93053a5df7c3fddf674f9baf5a78e3400d9a3677
```

Receipt: [`../Build/evidence/s2-services-read-engine-certification-2026-08-31.md`](../Build/evidence/s2-services-read-engine-certification-2026-08-31.md)

## S3 — Eligibility + recommendation — ✅ PASS

Certified deterministic evaluation, explicit reason codes, fail-closed malformed rules, requirements/dependencies and stable recommendation order `priority DESC, name ASC, offeringId ASC`.

```text
Source SHA       a6974cdbb669b66a07b8780d5e20c960d6a0cd64
Run              33531884206
Job              99936776923
Artifact         9810084527
SHA256           fa6a9efaa67309a4255dbce62fe362402ff453643e90f63c82c1457099e9de60
```

Receipt: [`../Build/evidence/s3-services-eligibility-certification-2026-09-01.md`](../Build/evidence/s3-services-eligibility-certification-2026-09-01.md)

## S4 — Versioned management — ✅ PASS

Certified operations:

```text
CreateService
UpdateService
SetServiceStatus
CreateOffering
UpdateOffering
SetOfferingStatus
```

Key proofs: business-scoped idempotency, exact replay, material conflict, optimistic revision conflict, dependency-reference preflight, no partial mutation on rejection, PostgreSQL canonical truth and awaited Mongo semantic audit.

```text
Source SHA       f3e54b853af5f01fb2e9ed7d032f784e3cffb81e
Run              33538554471
Job              99959020329
Artifact         9812703293
SHA256           275dd054247a89f0f4f8fe6c9244685d06cdd72117408c5282acbf6139b67a9c
```

Receipt: [`../Build/evidence/s4-services-management-certification-2026-09-01.md`](../Build/evidence/s4-services-management-certification-2026-09-01.md)

## S5 — Running-Workflow snapshot semantics — ✅ PASS

Certified experiment:

```text
consumer selects Service/Offering revision N
→ complete snapshot enters Workflow state
→ catalog publishes N+1 through S4
→ Worker restarts
→ waiting Workflow still exposes/uses N
→ new Workflow sees N+1
```

```text
Source SHA       7568618062f4192b34caf6e916b58534f304ad3f
Run              33539683548
Job              99962550022
Artifact         9813129778
SHA256           22f823b50babf13691c12d6c5783619568d2198d1123f2fa7c9c22fcf218a708
```

Receipt: [`../Build/evidence/s5-services-snapshot-certification-2026-09-01.md`](../Build/evidence/s5-services-snapshot-certification-2026-09-01.md)

## S6 — Multi-business generality — ✅ PASS

S6 certifies two materially different business catalogs through the same Services implementation and Temporal boundary.

Certified specimens:

```text
automotive
  Basic Wash / 30m / FIXED PEN 3000 / vehicle-profile

veterinary
  General Consultation / 45m / FIXED PEN 7000 / pet-profile
```

The same `primary-service` Service code, `standard` Offering code and an intentionally shared external idempotency key are legal because identity is business-scoped.

Certified proofs:

- same management Workflow and repository path for both businesses;
- cross-business Service/Offering reads do not resolve;
- cross-business Offering dependency is rejected before partial persistence;
- exact replay remains one effect;
- idempotency identity is independently scoped per business;
- deterministic eligibility/recommendation for both specimens;
- no S6 vertical fixture identity appears in implementation files;
- Mongo audit covers all S6 management Workflows;
- dynamic S4 management/rejection regressions remain passing;
- inherited Appointment happy path/idempotency/slot-race remains passing.

Authority:

```text
Source SHA       3eed68b45036154bcf1776564f479cd02e30d0d4
Run              33666790884
Job              100370414068
Result           SUCCESS
Artifact         9860927146
SHA256           543feab917c80dfd3a9cecbff7db15170d82cc66a621b837616d73a798b57564
```

Receipt: [`../Build/evidence/s6-services-multibusiness-certification-2026-09-02.md`](../Build/evidence/s6-services-multibusiness-certification-2026-09-02.md)

Verification: [`../Test/g1-services-engine-s0-s6.md`](../Test/g1-services-engine-s0-s6.md)

### S6 failure provenance

Run `33666702773` failed before Compose/runtime because the initial anti-hardcoding guard matched an existing unit-test fixture. The guard was corrected to exclude `*.test.ts`; no runtime/domain behavior was weakened.

## S7 — Appointment → canonical Services integration — 🔧 NEXT

Purpose: stop treating the inherited Appointment catalog projection as the long-term authority and make `RegisterNewAppointment` consume canonical Services reads/snapshots while preserving its already-certified orchestration behavior.

Target flow:

```text
RegisterNewAppointment
        ↓
resolve Customer
        ↓
Services.ListServices / GetService
        ↓
Services.ListOfferings / GetOffering
        ↓
freeze revision-aware OfferingSnapshot in Workflow state
        ↓
legacy date / availability compatibility boundary
        ↓
slot selection
        ↓
explicit finalize
        ↓
atomic inherited booking
```

### Required S7 proofs

- Appointment Service choices originate from canonical Services reads;
- Offering choices originate from canonical Services reads;
- selection freezes Service/Offering IDs, revisions and commercial/requirement semantics in Workflow state;
- catalog revision N+1 after selection cannot mutate the active Appointment snapshot N;
- a new Appointment after publication sees N+1;
- inherited happy path remains functional;
- existing-customer and Child `RegisterNewCustomer` paths remain functional;
- human date normalization remains functional;
- exact Appointment replay remains functional;
- same-slot race remains one winner / one durable loser;
- Scheduler is **not** redesigned inside S7;
- no channel-specific Services policy appears.

### S7 stop condition

If canonical Services integration requires moving availability/capacity/reservation authority into Services, stop. That behavior belongs to G2 Scheduler.

Verdict required: `S7 PASS`.

## S8 — Final clean G1 certification

From a clean environment execute the complete G1 surface:

```text
npm ci
strict typecheck/tests
clean Docker Compose boot
migrations
S1 persistence
S2 reads
S3 eligibility/recommendation
S4 management
S5 snapshot semantics
S6 multi-business
S7 Appointment integration
PostgreSQL verification
Mongo audit verification
frozen MK0 regression subset
```

Produce exact source SHA, run/job, artifact digest, case accounting, closure receipt and explicit non-claims.

Verdict required: `G1 SERVICES ENGINE CERTIFIED`.

---

# Golden case families

```text
CAT-*   catalog identity/lifecycle/read behavior
PRC-*   pricing/duration validation
REQ-*   requirements/dependencies
ELG-*   eligibility evaluation
REC-*   deterministic recommendation
REV-*   revisions/snapshot semantics
IDM-*   mutation idempotency/conflict
ISO-*   multi-business isolation
CMP-*   compatibility/Appointment regression
```

# Build-stop conditions

Stop and redesign if a gate requires:

- channel code to implement Service business policy;
- Workflow code to use a DB driver directly;
- arbitrary executable JavaScript/SQL as eligibility rules;
- vertical-name branching;
- mutable catalog head to replace a selected Workflow snapshot;
- Scheduler capacity/slot logic to become Services authority;
- MongoDB to become canonical catalog truth;
- last-write-wins mutation that bypasses revision conflict detection.

# Exit criteria

G1 remains open until S7 and S8 close. `S0–S6 certified` is the strongest current Services claim.
