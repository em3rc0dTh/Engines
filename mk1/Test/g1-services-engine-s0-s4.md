# G1 Services Engine — Verification Ledger through S4

## Status

**S0–S4 VERIFIED / G1 NOT YET COMPLETE**

This ledger indexes the executable evidence for the Services Engine through S4. Individual Build receipts remain the certification authority for each gate.

## Evidence rule

```text
UNKNOWN != PASS
documented != verified
unit test != runtime integration proof
CI green != broader gate certification unless the job proves the gate contract
failed/superseded attempts remain provenance
```

## S0 — Runtime promotion

Verdict: **PASS / CERTIFIED**

```text
Source SHA       6dcafa0f5b5704cb9a3a9bcbdaef25fe368006b1
Run              33461008031
Job              99710964036
Artifact         9783188036
Artifact SHA256  69a895416918dfb163be680f55c9a6dae2bda35fa60a6dd5107c93e971045958
```

Proves the MK1 executable line began from the exact certified MK0 runtime tree and reran inherited Customer/CTA/AttachmentStore/Appointment behavior.

## S1 — Contracts and persistence

Verdict: **PASS / CERTIFIED**

```text
Source SHA       550cdca619856fe246ab569588f9036a7025e7a7
Run              33461510248
Job              99712416091
Artifact         9783331341
Artifact SHA256  7f69bf9d33b2e854d5cc4941b41059dc358437675cf0bbb6d102c29f129b2097
```

Proves generic Service/Offering identities, business scope, lifecycle/revision, duration, pricing, requirements, dependencies, eligibility structures and PostgreSQL constraints while inherited Appointment behavior remains intact.

## S2 — Deterministic read engine

Verdict: **PASS / CERTIFIED**

```text
Source SHA       cec97a2b90a7aee8ae1deb3660bad0d7a759ace6
Run              33461895218
Job              99713587556
Artifact         9783467265
Artifact SHA256  0b7c0addd1849da87fe03afc93053a5df7c3fddf674f9baf5a78e3400d9a3677
Probe            SERVICES_S2_READ_ENGINE_PASS
```

Proves deterministic Service/Offering reads, business isolation, lifecycle-aware lists, explicit historical lookup, full Offering hydration, revision visibility and Appointment compatibility.

## S3 — Eligibility and recommendation

Verdict: **PASS / CERTIFIED**

```text
Source SHA       a6974cdbb669b66a07b8780d5e20c960d6a0cd64
Run              33531884206
Job              99936776923
Artifact         9810084527
Artifact SHA256  fa6a9efaa67309a4255dbce62fe362402ff453643e90f63c82c1457099e9de60
Probe            SERVICES_S3_RECOMMENDATION_PASS
```

Proves deterministic eligibility/recommendation, stable ranking, explicit failure reasons, fail-closed malformed rules, requirements/dependencies evaluation and no Agent/LLM dependency.

Failure provenance: run `33531803288` failed strict TypeScript because the test helper violated `exactOptionalPropertyTypes`; the helper was corrected without relaxing domain behavior.

## S4 — Versioned management mutations

Verdict: **PASS / CERTIFIED**

### Final certification authority

```text
Source SHA       f3e54b853af5f01fb2e9ed7d032f784e3cffb81e
Run              33538554471
Job              99959020329
Result           SUCCESS
Artifact         9812703293
Artifact SHA256  275dd054247a89f0f4f8fe6c9244685d06cdd72117408c5282acbf6139b67a9c
```

All CI steps passed, including strict typecheck, Services tests, inherited regressions, clean Compose boot, S3 recommendation regression, S4 mutation proof, S4 rejection-safety proof, Appointment certification, evidence capture and teardown.

### Operations exercised

```text
CreateService
UpdateService
SetServiceStatus
CreateOffering
UpdateOffering
SetOfferingStatus
```

### Idempotency behavior

Executed proof:

```text
CreateService business A / key K   -> APPLIED revision 1
same command / same key K          -> REPLAYED revision 1
same identity / different material -> REJECTED IDEMPOTENCY_CONFLICT
CreateService business B / key K   -> APPLIED revision 1
```

Therefore the key is business-scoped, replay safe and material-conflict protected.

The PostgreSQL evidence contains only one command row for the original business-A create identity despite replay/conflict executions.

### Revision behavior

Executed proof:

```text
Service
1 --UpdateService--> 2 --SetServiceStatus--> 3
stale expectedRevision=1 after revision 2 -> REVISION_CONFLICT

Offering
1 --UpdateOffering--> 2 --SetOfferingStatus--> 3
stale expectedRevision=1 after revision 2 -> REVISION_CONFLICT
```

Final PostgreSQL state preserved the successful revision-2 mutations and rejected stale material rather than applying last-write-wins.

### Lifecycle behavior

Service and Offering were transitioned to `INACTIVE` through explicit status commands. Rows remained canonical and revisions incremented; no deletion-based lifecycle was introduced.

### Rejection safety

A separate runtime probe created a valid parent Service and then attempted an Offering whose `REQUIRES` dependency targeted a missing Offering.

Expected and observed:

```text
outcome                         REJECTED / NOT_FOUND
partial Offering persisted      false
mutation command row persisted  false
terminal Mongo audit persisted  true
```

This covers the supported orchestration path for invalid dependency references.

### Audit behavior

The final artifact contains terminal `services_mutation_audit` entries for:

```text
APPLIED
REPLAYED
REJECTED / IDEMPOTENCY_CONFLICT
REJECTED / REVISION_CONFLICT
REJECTED / NOT_FOUND
```

The Workflow awaits audit persistence before returning its result.

### Inherited regression

The same final run re-executed the inherited Appointment certification after S4 management changes and it passed.

### Superseded S4 run

Run `33538120900` was already green before the dependency-reference hardening. It remains historical evidence, but run `33538554471` supersedes it as final S4 authority.

## Current unsupported claims

This ledger does not certify:

```text
S5 running-Workflow snapshot semantics
S6 broad multi-business generality
S7 full Appointment-to-Services integration
S8 final G1 closure
Scheduler Engine
WebChat / Telegram / WhatsApp adapters
Agent / LLM policy authority
production deployment
```

## Next verification target

S5 must prove one running Workflow freezes Service/Offering revision `N`, survives a catalog update to `N+1`, continues with `N`, while a new Workflow observes `N+1`.

## Receipts

- [`../Build/evidence/s0-runtime-promotion-certification-2026-08-31.md`](../Build/evidence/s0-runtime-promotion-certification-2026-08-31.md)
- [`../Build/evidence/s1-services-contracts-certification-2026-08-31.md`](../Build/evidence/s1-services-contracts-certification-2026-08-31.md)
- [`../Build/evidence/s2-services-read-engine-certification-2026-08-31.md`](../Build/evidence/s2-services-read-engine-certification-2026-08-31.md)
- [`../Build/evidence/s3-services-eligibility-certification-2026-09-01.md`](../Build/evidence/s3-services-eligibility-certification-2026-09-01.md)
- [`../Build/evidence/s4-services-management-certification-2026-09-01.md`](../Build/evidence/s4-services-management-certification-2026-09-01.md)
