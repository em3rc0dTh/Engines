# MK1 — Stage 2 Certification Program

## Status

**G0 CLOSED — G1 SERVICES ENGINE / S0–S3 CERTIFIED — S4 NEXT**

MK1 starts from the frozen MK0 architecture laboratory and must not weaken or silently reinterpret any MK0 invariant.

Canonical stable base:

```text
main
9c0fab032461e889f3d9d297b2d2b375288afda3
```

`main` carries the stable MK0 closure. The MK1 line preserves exact ancestry while work remains outside the integration branch until its gates are ready to integrate.

Current Stage-2 lineage:

```text
main / developer                        stable MK0 base
        ↓
audit/stage2-core-126-completeness      G0 foundation audit
        ↓
design/mk1-services-engine              G1 design / Golden expectations
        ↓
build/mk1-s0-runtime-promotion          S0 executable baseline
        ↓
build/mk1-s1-services-contracts         S1 contracts / persistence
        ↓
build/mk1-s2-services-read-engine       S2 deterministic reads
        ↓
build/mk1-s3-services-eligibility       S3 eligibility / recommendation
```

No MK1 gate is allowed to rewrite the frozen `mk0/runtime` certification specimen.

## G0 result — foundation boundary

Approved classification:

```text
1 — CTA / Channel Adapter core             ✅ CERTIFIED FOUNDATION
2 — Temporal orchestration core            ✅ CERTIFIED FOUNDATION
6 — Persistence authority model            ✅ CERTIFIED FOUNDATION

full omnichannel breadth                    ❌ OPEN
natural-language/general intent router      ❌ OPEN
full target Workflow Library                ❌ OPEN
production S3/MinIO storage                 ❌ OPEN
```

Foundation artifacts:

- [`Design/00-foundation-contract.md`](Design/00-foundation-contract.md)
- [`Plan/00-core-126-completeness-audit.md`](Plan/00-core-126-completeness-audit.md)
- [`Test/g0-core-126-audit.md`](Test/g0-core-126-audit.md)
- [`golden-dataset/g0-foundation-closure-manifest-v0.json`](golden-dataset/g0-foundation-closure-manifest-v0.json)
- [`Build/evidence/g0-core-126-audit-closure-2026-08-31.md`](Build/evidence/g0-core-126-audit-closure-2026-08-31.md)

## G1 — Services Engine

Canonical documentation baseline:

- [`Brainstorming/02-services-engine.md`](Brainstorming/02-services-engine.md)
- [`mining-site/quarries/quarry-01-mk0-services-seed.md`](mining-site/quarries/quarry-01-mk0-services-seed.md)
- [`Design/01-services-engine-contract.md`](Design/01-services-engine-contract.md)
- [`Plan/01-services-engine-gates.md`](Plan/01-services-engine-gates.md)
- [`golden-dataset/services-engine-v0.json`](golden-dataset/services-engine-v0.json)
- [`Test/g1-services-engine-s0-s3.md`](Test/g1-services-engine-s0-s3.md)
- [`Build/README.md`](Build/README.md)

### S0 — executable baseline promotion ✅ CERTIFIED

S0 promoted the exact certified MK0 runtime tree into `mk1/runtime`, along with the frozen fixture/Golden dependencies required by that runtime, then independently reran the inherited certification surface from the MK1 path.

```text
S0 source        6dcafa0f5b5704cb9a3a9bcbdaef25fe368006b1
GitHub run       33461008031
Job              99710964036
Result           SUCCESS
Runtime tree     82dcec4a61ea28283537a2993d047b3bd444edef
Fast tests       42 / 42 PASS
B7 runtime       4 / 4 PASS
Artifact         9783188036
Artifact SHA256  69a895416918dfb163be680f55c9a6dae2bda35fa60a6dd5107c93e971045958
```

Receipt: [`Build/evidence/s0-runtime-promotion-certification-2026-08-31.md`](Build/evidence/s0-runtime-promotion-certification-2026-08-31.md)

### S1 — Services contracts + persistence ✅ CERTIFIED

S1 evolved the inherited Service/Product catalog in place rather than creating a parallel truth model. It added lifecycle/revision semantics, a neutral Offering projection, typed pricing, requirements, dependencies and deterministic eligibility-rule persistence while preserving the inherited Appointment path.

```text
S1 source        550cdca619856fe246ab569588f9036a7025e7a7
GitHub run       33461510248
Job              99712416091
Result           SUCCESS
Services tests   10 / 10 PASS
Inherited tests  40 / 40 PASS
Combined         50 / 50 PASS
Persistence      SERVICES_S1_PERSISTENCE_PASS
Artifact         9783331341
Artifact SHA256  7f69bf9d33b2e854d5cc4941b41059dc358437675cf0bbb6d102c29f129b2097
```

Receipt: [`Build/evidence/s1-services-contracts-certification-2026-08-31.md`](Build/evidence/s1-services-contracts-certification-2026-08-31.md)

### S2 — deterministic read engine ✅ CERTIFIED

S2 established business-scoped deterministic reads over the generic Services model:

```text
ListServices
GetService
ListOfferings
GetOffering
```

Certified behavior includes deterministic ordering, business isolation, active-list filtering, explicit historical lookup, full Offering hydration, revision visibility, Appointment compatibility and a vertical-neutral repository implementation.

```text
S2 source        cec97a2b90a7aee8ae1deb3660bad0d7a759ace6
GitHub run       33461895218
Job              99713587556
Result           SUCCESS
Probe            SERVICES_S2_READ_ENGINE_PASS
Artifact         9783467265
Artifact SHA256  0b7c0addd1849da87fe03afc93053a5df7c3fddf674f9baf5a78e3400d9a3677
```

Receipt: [`Build/evidence/s2-services-read-engine-certification-2026-08-31.md`](Build/evidence/s2-services-read-engine-certification-2026-08-31.md)

### S3 — eligibility + recommendation ✅ CERTIFIED

S3 added a pure deterministic eligibility/recommendation layer over persisted Service Offerings without giving policy authority to an Agent or LLM.

```text
evaluateOfferingEligibility
recommendOfferings
```

Certified behavior includes stable ranking, explicit reason codes, fail-closed malformed rules, required-requirement evaluation, `REQUIRES` / `EXCLUDES` dependency evaluation, input-order independence and PostgreSQL-hydrated definitions flowing into the pure evaluator.

```text
S3 source        a6974cdbb669b66a07b8780d5e20c960d6a0cd64
GitHub run       33531884206
Job              99936776923
Result           SUCCESS
Probe            SERVICES_S3_RECOMMENDATION_PASS
Artifact         9810084527
Artifact SHA256  fa6a9efaa67309a4255dbce62fe362402ff453643e90f63c82c1457099e9de60
```

The earlier run `33531803288` failed strict TypeScript validation because the S3 test helper violated `exactOptionalPropertyTypes`. The helper was corrected without weakening any runtime or domain invariant. The successful run above is the certification authority.

Receipt: [`Build/evidence/s3-services-eligibility-certification-2026-09-01.md`](Build/evidence/s3-services-eligibility-certification-2026-09-01.md)

## Current Services boundary

S0–S3 prove the executable baseline, domain/persistence contracts, deterministic reads, and deterministic eligibility/recommendation.

They do **not** yet certify G1 as a finished Services Engine. Still open:

```text
S4 — versioned management mutations
S5 — running-Workflow snapshot semantics
S6 — multi-business generality
S7 — Appointment regression integration
S8 — final clean Compose certification
```

## Carry-forward invariants

```text
UNKNOWN != PASS
documented != verified
prototype != certified engine
channel behavior != business authority
availability shown != reservation persisted
Agent inference != orchestration authority
running Workflow snapshot != mutable catalog head
```

Every new capability must receive a contract, Golden expectation, build gate, executable test evidence and closure receipt before it is called certified.

## Current sequence

```text
G0 — Audit blocks 1 / 2 / 6                         ✅ CLOSED
G1 — Services Engine
     S0 — runtime promotion                         ✅ CERTIFIED
     S1 — contracts + persistence                   ✅ CERTIFIED
     S2 — deterministic read engine                 ✅ CERTIFIED
     S3 — eligibility + recommendation              ✅ CERTIFIED
     S4 — versioned management mutations            🔧 NEXT
     S5 — running-Workflow snapshots                ⏭ QUEUED
     S6 — multi-business generality                 ⏭ QUEUED
     S7 — Appointment integration                    ⏭ QUEUED
     S8 — final clean certification                 ⏭ QUEUED
G2 — Scheduler Engine                               ⏭ AFTER G1
G3 — New CTA channel proof (Telegram candidate)     ⏭ AFTER G2
```

The Agent/Intelligence layer remains deliberately outside this phase until the platform works correctly without it.
