# MK1 — Stage 2 Certification Program

## Status

**G0 CLOSED — G1 SERVICES ENGINE / S0 CERTIFIED — S1 NEXT**

MK1 starts from the frozen MK0 architecture laboratory and must not weaken or silently reinterpret any MK0 invariant.

Canonical stable base:

```text
main
9c0fab032461e889f3d9d297b2d2b375288afda3
```

`main` is one merge commit ahead of `release/mk0-complete` and has no file differences from that release branch. It is therefore the canonical stable MK0 base carried into MK1.

Stage-2 work preserves explicit ancestry while integration into `developer` remains pending:

```text
main / developer                        stable MK0 base
        ↓
audit/stage2-core-126-completeness      G0 foundation audit
        ↓
design/mk1-services-engine              G1 design / Golden expectations
        ↓
build/mk1-s0-runtime-promotion          certified executable MK1 baseline
```

## G0 result

Approved foundation classification:

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

Design baseline:

- [`Brainstorming/02-services-engine.md`](Brainstorming/02-services-engine.md)
- [`mining-site/quarries/quarry-01-mk0-services-seed.md`](mining-site/quarries/quarry-01-mk0-services-seed.md)
- [`Design/01-services-engine-contract.md`](Design/01-services-engine-contract.md)
- [`Plan/01-services-engine-gates.md`](Plan/01-services-engine-gates.md)
- [`golden-dataset/services-engine-v0.json`](golden-dataset/services-engine-v0.json)

### S0 — executable baseline promotion

S0 promoted the exact certified MK0 runtime tree into `mk1/runtime`, along with the exact frozen fixture/Golden dependencies required by that runtime, and independently reran the inherited certification surface from the MK1 path.

```text
S0 source        6dcafa0f5b5704cb9a3a9bcbdaef25fe368006b1
GitHub run       33461008031
Job              99710964036
Result           ✅ SUCCESS
Runtime tree     82dcec4a61ea28283537a2993d047b3bd444edef
Fast tests       42 / 42 PASS
B7 runtime       4 / 4 PASS
Artifact         9783188036
Artifact SHA256  69a895416918dfb163be680f55c9a6dae2bda35fa60a6dd5107c93e971045958
```

Receipt:

[`Build/evidence/s0-runtime-promotion-certification-2026-08-31.md`](Build/evidence/s0-runtime-promotion-certification-2026-08-31.md)

S0 proves that new MK1 product work can start from an executable baseline without changing or reopening the frozen MK0 laboratory.

## Carry-forward invariants

```text
UNKNOWN != PASS
documented != verified
prototype != certified engine
channel behavior != business authority
availability shown != reservation persisted
Agent inference != orchestration authority
```

MK1 may reuse MK0 code and evidence, but every new capability must receive its own contract, Golden expectations, build gate, test evidence and closure receipt before it is called certified.

## Current sequence

```text
G0 — Audit blocks 1 / 2 / 6                         ✅ CLOSED
G1 — Services Engine
     S0 — runtime promotion                         ✅ CERTIFIED
     S1 — contracts + persistence                   🔧 NEXT
     S2–S8                                           ⏭ QUEUED
G2 — Scheduler Engine                               ⏭ AFTER G1
G3 — New CTA channel proof (Telegram candidate)     ⏭ AFTER G2
```

The Agent/Intelligence layer remains deliberately outside this phase until the platform works correctly without it.
