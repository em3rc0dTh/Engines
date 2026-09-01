# MK1 Build & Evidence Index

## Purpose

This directory records the executable build history and certification receipts for MK1. Design intent belongs in `Brainstorming`, `mining-site`, `Design`, `Plan` and `golden-dataset`; this directory answers a narrower question:

> **What source was actually executed, what evidence was produced, and what claim did that evidence certify?**

## Current status

```text
G0 Foundation audit                  ✅ CLOSED
G1 Services Engine
  S0 Runtime promotion               ✅ CERTIFIED
  S1 Contracts + persistence         ✅ CERTIFIED
  S2 Deterministic read engine       ✅ CERTIFIED
  S3 Eligibility + recommendation    ✅ CERTIFIED
  S4 Versioned management            🔧 NEXT
  S5–S8                              ⏭ QUEUED

G1 SERVICES ENGINE                   ❌ NOT YET FULLY CERTIFIED
```

## Evidence ledger

| Gate | Source SHA | GitHub run | Job | Artifact | Artifact SHA-256 | Receipt |
|---|---|---:|---:|---:|---|---|
| G0 | audit closure | — | — | — | — | [`g0-core-126-audit-closure-2026-08-31.md`](evidence/g0-core-126-audit-closure-2026-08-31.md) |
| S0 | `6dcafa0f5b5704cb9a3a9bcbdaef25fe368006b1` | `33461008031` | `99710964036` | `9783188036` | `69a895416918dfb163be680f55c9a6dae2bda35fa60a6dd5107c93e971045958` | [`s0-runtime-promotion-certification-2026-08-31.md`](evidence/s0-runtime-promotion-certification-2026-08-31.md) |
| S1 | `550cdca619856fe246ab569588f9036a7025e7a7` | `33461510248` | `99712416091` | `9783331341` | `7f69bf9d33b2e854d5cc4941b41059dc358437675cf0bbb6d102c29f129b2097` | [`s1-services-contracts-certification-2026-08-31.md`](evidence/s1-services-contracts-certification-2026-08-31.md) |
| S2 | `cec97a2b90a7aee8ae1deb3660bad0d7a759ace6` | `33461895218` | `99713587556` | `9783467265` | `0b7c0addd1849da87fe03afc93053a5df7c3fddf674f9baf5a78e3400d9a3677` | [`s2-services-read-engine-certification-2026-08-31.md`](evidence/s2-services-read-engine-certification-2026-08-31.md) |
| S3 | `a6974cdbb669b66a07b8780d5e20c960d6a0cd64` | `33531884206` | `99936776923` | `9810084527` | `fa6a9efaa67309a4255dbce62fe362402ff453643e90f63c82c1457099e9de60` | [`s3-services-eligibility-certification-2026-09-01.md`](evidence/s3-services-eligibility-certification-2026-09-01.md) |

## Failure provenance

Failures are not erased from the historical record when a later run passes.

S3 had an earlier failed attempt:

```text
Run      33531803288
Result   FAILURE
Cause    strict TypeScript exactOptionalPropertyTypes test-fixture mismatch
Impact   certification did not proceed past typecheck
Fix      test helper corrected
Policy   no runtime/domain invariant weakened
```

Only successful run `33531884206` is S3 certification authority.

## What the receipts mean

A receipt is a **bounded certification claim**, not a general product-readiness statement.

```text
S0 receipt -> promoted runtime baseline is executable and inherited behavior passes
S1 receipt -> Services contracts/persistence foundation is certified
S2 receipt -> deterministic Services reads are certified
S3 receipt -> deterministic eligibility/recommendation is certified
```

None of those receipts independently certifies the whole Services Engine.

## Required evidence for future gates

Every subsequent build gate must record, at minimum:

```text
source SHA
branch
workflow run ID
job ID
result
artifact ID
artifact SHA-256
executed commands / probes
Golden case accounting
regression scope
explicit non-claims
human-readable verdict
```

A documentation-only commit after a successful runtime run may index or explain the evidence, but it must not be represented as the source revision that was executed.

## Current next gate

S4 must establish versioned management mutations through orchestration authority:

```text
CreateService
UpdateService
SetServiceStatus
CreateOffering
UpdateOffering
SetOfferingStatus
```

The S4 receipt must not be issued unless the build proves business-scoped idempotency, exact replay, material conflict, optimistic revision protection, retry safety and the required audit boundary.

## Cross-reference

- Gate plan: [`../Plan/01-services-engine-gates.md`](../Plan/01-services-engine-gates.md)
- Consolidated test ledger: [`../Test/g1-services-engine-s0-s3.md`](../Test/g1-services-engine-s0-s3.md)
- Services contract: [`../Design/01-services-engine-contract.md`](../Design/01-services-engine-contract.md)
- Golden expectations: [`../golden-dataset/services-engine-v0.json`](../golden-dataset/services-engine-v0.json)
