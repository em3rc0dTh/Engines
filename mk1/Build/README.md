# MK1 Build & Evidence Index

## Purpose

This directory records executable build history and certification receipts for MK1. Design intent belongs in `Brainstorming`, `mining-site`, `Design`, `Plan` and `golden-dataset`; this directory answers:

> **What source was actually executed, what evidence was produced, and what bounded claim did that evidence certify?**

## Current status

```text
G0 Foundation audit                  ✅ CLOSED
G1 Services Engine
  S0 Runtime promotion               ✅ CERTIFIED
  S1 Contracts + persistence         ✅ CERTIFIED
  S2 Deterministic read engine       ✅ CERTIFIED
  S3 Eligibility + recommendation    ✅ CERTIFIED
  S4 Versioned management            ✅ CERTIFIED
  S5 Running-Workflow snapshots      ✅ CERTIFIED
  S6 Multi-business generality       🔧 NEXT
  S7 Appointment integration         ⏭ QUEUED
  S8 Final clean certification       ⏭ QUEUED

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
| S4 | `f3e54b853af5f01fb2e9ed7d032f784e3cffb81e` | `33538554471` | `99959020329` | `9812703293` | `275dd054247a89f0f4f8fe6c9244685d06cdd72117408c5282acbf6139b67a9c` | [`s4-services-management-certification-2026-09-01.md`](evidence/s4-services-management-certification-2026-09-01.md) |
| S5 | `7568618062f4192b34caf6e916b58534f304ad3f` | `33539683548` | `99962550022` | `9813129778` | `22f823b50babf13691c12d6c5783619568d2198d1123f2fa7c9c22fcf218a708` | [`s5-services-snapshot-certification-2026-09-01.md`](evidence/s5-services-snapshot-certification-2026-09-01.md) |

## S5 evidence highlights

S5 proved the hard versioning property for long-running Temporal consumers:

```text
original snapshot Service revision    1
original snapshot Offering revision   1
mutable catalog Service revision      2
mutable catalog Offering revision     2
waiting Workflow silently changed     false
Worker process before restart         31
Worker process after restart          36
original Workflow completed with      revision 1
new Workflow observed                  revision 2
```

Direct runtime markers:

```text
SERVICES_S5_PRE_RESTART_PASS
SERVICES_S5_SNAPSHOT_PASS
```

The final marker explicitly reported:

```text
originalSurvivedWorkerRestart=true
originalCompletedWithFrozenSemantics=true
newWorkflowObservedCatalogHead=true
```

The same run also re-certified S4 management/rejection safety and the inherited Appointment specimen.

## Failure / supersession provenance

Failures and superseded certification attempts are not erased.

### S3

```text
Run      33531803288
Result   FAILURE
Cause    strict TypeScript exactOptionalPropertyTypes test-fixture mismatch
Fix      test helper corrected
Policy   no runtime/domain invariant weakened
```

Only successful run `33531884206` is S3 authority.

### S4

Run `33538120900` completed successfully for the first complete S4 implementation. Review then identified that dependency-reference rejection should be proven explicitly before any Offering mutation. S4 was hardened with a reference-preflight Activity and a no-partial-effect probe.

The final certification authority is run `33538554471`, which includes that safety proof. Intermediate runs cancelled by `cancel-in-progress` while newer commits were pushed are superseded executions, not product failures.

## What the receipts mean

A receipt is a **bounded certification claim**, not a general product-readiness statement.

```text
S0 -> promoted runtime baseline executable
S1 -> Services contracts/persistence foundation
S2 -> deterministic Services reads
S3 -> deterministic eligibility/recommendation
S4 -> versioned/idempotent Services management mutations
S5 -> durable revision-specific Workflow snapshots across Worker restart
```

None independently certifies the whole Services Engine.

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

## Current next Services gate

S6 must prove materially different businesses can publish/read/evaluate Services through the same generic contracts without business-name branching or parallel business-specific implementations.

## Parallel channel proof boundary

The planned channel work is intentionally separate from Services source gates:

```text
C0 canonical CTA adapter contract
C1 minimal HTML WebChat
C2 Telegram bot / long polling
C3 optional Telegram webhook parity
C4 WhatsApp later
```

C0–C2 remain strictly:

```text
channel adapter
→ canonical CTA operation
→ Temporal
→ existing Workflow contracts
```

No Agent, LLM orchestration or MCP belongs in this phase.

## Cross-reference

- Gate plan: [`../Plan/01-services-engine-gates.md`](../Plan/01-services-engine-gates.md)
- Consolidated verification: [`../Test/g1-services-engine-s0-s5.md`](../Test/g1-services-engine-s0-s5.md)
- Services contract: [`../Design/01-services-engine-contract.md`](../Design/01-services-engine-contract.md)
- Golden expectations: [`../golden-dataset/services-engine-v0.json`](../golden-dataset/services-engine-v0.json)
- Channel adapter design: [`../Design/02-cta-channel-adapter-contract.md`](../Design/02-cta-channel-adapter-contract.md)
