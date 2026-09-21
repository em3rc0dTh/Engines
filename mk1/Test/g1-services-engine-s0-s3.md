# G1 Services Engine — Verification Ledger through S3

## Status

**S0–S3 VERIFIED / G1 NOT YET COMPLETE**

This document is the consolidated test/evidence ledger for the Services Engine build through S3. It does not replace individual certification receipts; it indexes what was executed, what passed, and what remains outside the current claim.

## Evidence rule

```text
UNKNOWN != PASS
documented != verified
unit test != runtime integration proof
CI green != broader gate certification unless the job proves the gate contract
failed attempt remains part of provenance
```

Each gate below points to an identified source revision and GitHub Actions execution.

---

## S0 — Runtime promotion

Verdict: **PASS / CERTIFIED**

Purpose: prove `mk1/runtime` begins from the exact certified MK0 runtime tree and remains executable from its new path.

```text
Source SHA       6dcafa0f5b5704cb9a3a9bcbdaef25fe368006b1
Run              33461008031
Job              99710964036
Artifact         9783188036
Artifact SHA256  69a895416918dfb163be680f55c9a6dae2bda35fa60a6dd5107c93e971045958
Runtime tree     82dcec4a61ea28283537a2993d047b3bd444edef
Fast tests       42 / 42 PASS
B7 runtime       4 / 4 PASS
Appointment      PASS
```

Assertions proven:

- `mk0/runtime` and promoted `mk1/runtime` started from the same Git tree;
- inherited TypeScript/runtime surface executed from `mk1/runtime`;
- Customer, CTA, AttachmentStore and Appointment regressions remained green;
- clean laboratory startup remained viable.

Receipt: [`../Build/evidence/s0-runtime-promotion-certification-2026-08-31.md`](../Build/evidence/s0-runtime-promotion-certification-2026-08-31.md)

---

## S1 — Contracts and persistence

Verdict: **PASS / CERTIFIED**

Purpose: establish generic Services domain/persistence semantics without creating a second catalog truth.

```text
Source SHA       550cdca619856fe246ab569588f9036a7025e7a7
Run              33461510248
Job              99712416091
Artifact         9783331341
Artifact SHA256  7f69bf9d33b2e854d5cc4941b41059dc358437675cf0bbb6d102c29f129b2097
Services tests   10 / 10 PASS
Inherited tests  40 / 40 PASS
Combined         50 / 50 PASS
Probe            SERVICES_S1_PERSISTENCE_PASS
Appointment      PASS
```

Key executed contract families:

```text
PRC-* pricing / duration
REQ-* requirements / dependencies
ELG-* eligibility structure validation
CAT-* business scope / lifecycle / revision invariants
```

Assertions proven:

- typed pricing does not fabricate money for FREE/QUOTE_REQUIRED;
- duration validation is bounded and explicit;
- requirements are domain data rather than channel-form metadata;
- self-dependencies are rejected;
- malformed eligibility structures fail validation;
- Service/Offering revision and business scope are explicit;
- PostgreSQL constraints support the domain contract;
- inherited Appointment behavior remains intact.

Receipt: [`../Build/evidence/s1-services-contracts-certification-2026-08-31.md`](../Build/evidence/s1-services-contracts-certification-2026-08-31.md)

---

## S2 — Deterministic read engine

Verdict: **PASS / CERTIFIED**

Purpose: prove generic Services data can be read deterministically and safely across business scopes.

```text
Source SHA       cec97a2b90a7aee8ae1deb3660bad0d7a759ace6
Run              33461895218
Job              99713587556
Artifact         9783467265
Artifact SHA256  0b7c0addd1849da87fe03afc93053a5df7c3fddf674f9baf5a78e3400d9a3677
S1 tests         10 / 10 PASS
S2 tests          4 / 4 PASS
Customer tests   21 / 21 PASS
CLI tests          7 / 7 PASS
B7 tests           6 / 6 PASS
Appointment tests  6 / 6 PASS
Probe            SERVICES_S2_READ_ENGINE_PASS
Runtime Appointment certification PASS
```

Runtime proof flags returned by the S2 probe:

```text
businessIsolation          true
inactiveListFiltering      true
explicitHistoricalLookup  true
fullOfferingHydration      true
appointmentCompatibility  true
revisionSnapshot           true
verticalNeutralRepository true
```

Assertions proven:

- `ListServices` deterministic ordering;
- `GetService` business-scoped identity/code lookup;
- `ListOfferings` deterministic `priority DESC → name ASC → id ASC` ordering;
- `GetOffering` explicit historical lookup including lifecycle state;
- persisted pricing, requirements, dependencies and eligibility data hydrate into the generic Offering;
- current Service/Offering revisions are visible;
- Appointment compatibility projection preserves ids/duration;
- repository implementation is not branching on the tested vertical names;
- full inherited Appointment booking/idempotency/slot-conflict proof remains green.

Receipt: [`../Build/evidence/s2-services-read-engine-certification-2026-08-31.md`](../Build/evidence/s2-services-read-engine-certification-2026-08-31.md)

---

## S3 — Eligibility and recommendation

Verdict: **PASS / CERTIFIED**

Purpose: prove recommendation is a deterministic Services capability rather than Agent inference.

### Failure provenance

The first certification run is intentionally retained:

```text
Run              33531803288
Result           FAILURE
Failure gate     strict TypeScript typecheck
Cause            test helper violated exactOptionalPropertyTypes
Runtime weakened no
Domain weakened  no
```

The test fixture was corrected. No validation, eligibility or recommendation rule was relaxed.

### Certification authority

```text
Source SHA       a6974cdbb669b66a07b8780d5e20c960d6a0cd64
Run              33531884206
Job              99936776923
Result           SUCCESS
Artifact         9810084527
Artifact SHA256  fa6a9efaa67309a4255dbce62fe362402ff453643e90f63c82c1457099e9de60
Probe            SERVICES_S3_RECOMMENDATION_PASS
Appointment      PASS
```

Golden behavior exercised:

```text
ELG-001 same input -> same eligibility decision
ELG-002 configured failure reason is explicit
ELG-004 malformed rule fails closed
REQ-004 requirements/dependencies participate
REC-001 deterministic stable rank
REC-002 inactive/ineligible Offerings excluded
REC-003 recommendation independent of input order
```

Assertions proven:

- pure `evaluateOfferingEligibility` behavior;
- pure `recommendOfferings` behavior;
- deterministic ranking;
- fail-closed malformed rules;
- inactive Offering exclusion;
- explicit reason codes;
- required requirements participate in eligibility;
- `REQUIRES` and `EXCLUDES` dependencies participate;
- persisted PostgreSQL catalog data reaches the pure evaluator;
- no Agent/LLM dependency is required;
- full inherited Appointment path still passes after S3.

Receipt: [`../Build/evidence/s3-services-eligibility-certification-2026-09-01.md`](../Build/evidence/s3-services-eligibility-certification-2026-09-01.md)

---

## Cumulative verified boundary after S3

Verified:

```text
certified MK1 executable baseline
Service / Offering canonical contracts
PostgreSQL catalog authority
revision + lifecycle fields
pricing / duration semantics
requirements / dependencies
eligibility-rule persistence
business-scoped deterministic reads
historical explicit lookup
Service/Offering compatibility projection
revision-aware snapshot value construction
pure eligibility evaluation
pure deterministic recommendation
inherited Appointment regression
```

Not yet verified by G1:

```text
versioned management mutations
mutation idempotency/conflict
optimistic revision write protection
management audit finalization
running Temporal Workflow snapshot isolation across catalog revision change
multi-business material generality gate
Appointment consuming the final G1 Services integration contract
final clean S8 certification
```

Therefore the only valid cumulative claim is:

> **Services Engine S0–S3 are certified. G1 Services Engine as a whole is not yet certified.**

## Next test gate

`S4 — Versioned management mutations` must prove creation/update/status mutation through Temporal/Activities with business-scoped idempotency and optimistic revision control before the ledger can advance.
