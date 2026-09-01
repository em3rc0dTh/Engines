# MK1 — Stage 2 Certification Program

## Status

**G0 CLOSED — G1 SERVICES ENGINE / S0–S4 CERTIFIED — S5 NEXT**

MK1 starts from the frozen MK0 architecture laboratory and must not weaken or silently reinterpret any MK0 invariant.

Canonical stable base:

```text
main
9c0fab032461e889f3d9d297b2d2b375288afda3
```

`main` carries the stable MK0 closure. MK1 work preserves exact ancestry and does not rewrite `mk0/runtime`.

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
        ↓
build/mk1-s4-services-management        S4 versioned management
```

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

Canonical design/execution baseline:

- [`Brainstorming/02-services-engine.md`](Brainstorming/02-services-engine.md)
- [`mining-site/quarries/quarry-01-mk0-services-seed.md`](mining-site/quarries/quarry-01-mk0-services-seed.md)
- [`Design/01-services-engine-contract.md`](Design/01-services-engine-contract.md)
- [`Plan/01-services-engine-gates.md`](Plan/01-services-engine-gates.md)
- [`golden-dataset/services-engine-v0.json`](golden-dataset/services-engine-v0.json)
- [`Test/g1-services-engine-s0-s4.md`](Test/g1-services-engine-s0-s4.md)
- [`Build/README.md`](Build/README.md)

### S0 — executable baseline promotion ✅ CERTIFIED

S0 promoted the exact certified MK0 runtime tree into `mk1/runtime` and reran the inherited certification surface from the MK1 path.

```text
Source SHA       6dcafa0f5b5704cb9a3a9bcbdaef25fe368006b1
Run              33461008031
Job              99710964036
Artifact         9783188036
Artifact SHA256  69a895416918dfb163be680f55c9a6dae2bda35fa60a6dd5107c93e971045958
```

Receipt: [`Build/evidence/s0-runtime-promotion-certification-2026-08-31.md`](Build/evidence/s0-runtime-promotion-certification-2026-08-31.md)

### S1 — Services contracts + persistence ✅ CERTIFIED

S1 evolved the inherited Service/Product seed into a generic Services contract with lifecycle/revision semantics, neutral Offerings, typed pricing, requirements, dependencies and deterministic eligibility-rule persistence.

```text
Source SHA       550cdca619856fe246ab569588f9036a7025e7a7
Run              33461510248
Job              99712416091
Artifact         9783331341
Artifact SHA256  7f69bf9d33b2e854d5cc4941b41059dc358437675cf0bbb6d102c29f129b2097
```

Receipt: [`Build/evidence/s1-services-contracts-certification-2026-08-31.md`](Build/evidence/s1-services-contracts-certification-2026-08-31.md)

### S2 — deterministic read engine ✅ CERTIFIED

Certified operations:

```text
ListServices
GetService
ListOfferings
GetOffering
```

S2 proves deterministic ordering, business isolation, lifecycle-aware listing, historical explicit lookup, complete Offering hydration, revision visibility and Appointment compatibility.

```text
Source SHA       cec97a2b90a7aee8ae1deb3660bad0d7a759ace6
Run              33461895218
Job              99713587556
Artifact         9783467265
Artifact SHA256  0b7c0addd1849da87fe03afc93053a5df7c3fddf674f9baf5a78e3400d9a3677
```

Receipt: [`Build/evidence/s2-services-read-engine-certification-2026-08-31.md`](Build/evidence/s2-services-read-engine-certification-2026-08-31.md)

### S3 — eligibility + recommendation ✅ CERTIFIED

Certified operations:

```text
EvaluateOfferingEligibility
RecommendOfferings
```

S3 proves deterministic ranking, explicit reason codes, fail-closed malformed rules, requirements/dependencies evaluation and no Agent/LLM policy authority.

```text
Source SHA       a6974cdbb669b66a07b8780d5e20c960d6a0cd64
Run              33531884206
Job              99936776923
Artifact         9810084527
Artifact SHA256  fa6a9efaa67309a4255dbce62fe362402ff453643e90f63c82c1457099e9de60
```

Receipt: [`Build/evidence/s3-services-eligibility-certification-2026-09-01.md`](Build/evidence/s3-services-eligibility-certification-2026-09-01.md)

### S4 — versioned management mutations ✅ CERTIFIED

Certified operations:

```text
CreateService
UpdateService
SetServiceStatus
CreateOffering
UpdateOffering
SetOfferingStatus
```

S4 introduces a Temporal-managed mutation boundary, PostgreSQL command ledger, business-scoped idempotency, exact replay, material-conflict rejection, optimistic revision control, explicit ACTIVE/INACTIVE lifecycle changes and Mongo semantic audit before terminal Workflow return.

The final hardening run also proves a missing Offering dependency is rejected before mutation with no partial Offering and no mutation-command row, while the rejection remains auditable.

```text
Source SHA       f3e54b853af5f01fb2e9ed7d032f784e3cffb81e
Run              33538554471
Job              99959020329
Result           SUCCESS
Artifact         9812703293
Artifact SHA256  275dd054247a89f0f4f8fe6c9244685d06cdd72117408c5282acbf6139b67a9c
```

Receipt: [`Build/evidence/s4-services-management-certification-2026-09-01.md`](Build/evidence/s4-services-management-certification-2026-09-01.md)

## Current Services boundary

S0–S4 now prove:

```text
certified executable baseline
Service/Offering contracts + persistence
deterministic reads
deterministic eligibility/recommendation
versioned/idempotent management mutations
optimistic concurrency protection
terminal semantic audit
```

G1 is **not** complete yet. Still open:

```text
S5 — running-Workflow durable snapshot semantics
S6 — multi-business generality
S7 — Appointment Services integration
S8 — final clean G1 certification
```

## Parallel CTA channel design track

A separate design track now frames a future proof across WebChat, Telegram and WhatsApp without mixing channel code into Services S4:

- [`Brainstorming/03-cta-telegram-whatsapp-webchat-poc.md`](Brainstorming/03-cta-telegram-whatsapp-webchat-poc.md)
- [`Design/02-cta-channel-adapter-contract.md`](Design/02-cta-channel-adapter-contract.md)

Current preferred proof order:

```text
WebChat local controlled adapter
→ Telegram polling
→ Telegram webhook parity
→ WhatsApp external adapter
→ frozen cross-channel Golden comparison
```

These adapters are **not implemented or certified yet**. They must converge on the same canonical CTA/orchestration boundary and must not own business rules.

## Carry-forward invariants

```text
UNKNOWN != PASS
documented != verified
prototype != certified engine
channel behavior != business authority
availability shown != reservation persisted
Agent inference != orchestration authority
running Workflow snapshot != mutable catalog head
same idempotency identity + different material != overwrite
stale revision != silent last-write-wins
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
     S4 — versioned management mutations            ✅ CERTIFIED
     S5 — running-Workflow snapshots                🔧 NEXT
     S6 — multi-business generality                 ⏭ QUEUED
     S7 — Appointment integration                    ⏭ QUEUED
     S8 — final clean certification                 ⏭ QUEUED
G2 — Scheduler Engine                               ⏭ AFTER G1
G3 — WebChat / Telegram / WhatsApp channel proof    ⏭ AFTER ENGINE PREREQUISITES
```

The Agent/Intelligence layer remains deliberately outside this phase until the platform works correctly without it.
