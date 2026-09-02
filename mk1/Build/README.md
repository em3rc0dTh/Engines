# MK1 Build & Evidence Index

## Purpose

This index answers:

> **What source was actually executed, what evidence was produced, and what bounded claim did that evidence certify?**

Design intent belongs in `Brainstorming`, `mining-site`, `Design`, `Plan`, and `golden-dataset`. Documentation commits after a successful run never replace the executed runtime SHA.

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
  S6 Multi-business generality       ✅ CERTIFIED
  S7 Appointment integration         🔧 NEXT
  S8 Final clean certification       ⏭ QUEUED

G1 SERVICES ENGINE                   ❌ NOT YET FULLY CERTIFIED

G3 CTA channel proof
  C0A Workflow-view projection       ✅ CERTIFIED
  C1A Workflow-visible WebChat       ✅ CERTIFIED + HUMAN VERIFIED POST-FIX
  C1B Durable WebChat semantics      ✅ CERTIFIED + HUMAN RESTART VERIFIED
  C2 Telegram                        ⏭ DEFERRED TRANSPORT PROOF
```

## Evidence ledger

| Gate | Source SHA | Run | Job | Artifact | SHA-256 | Receipt |
|---|---|---:|---:|---:|---|---|
| G0 | audit closure | — | — | — | — | [`g0-core-126-audit-closure-2026-08-31.md`](evidence/g0-core-126-audit-closure-2026-08-31.md) |
| S0 | `6dcafa0f5b5704cb9a3a9bcbdaef25fe368006b1` | `33461008031` | `99710964036` | `9783188036` | `69a895416918dfb163be680f55c9a6dae2bda35fa60a6dd5107c93e971045958` | [`s0-runtime-promotion-certification-2026-08-31.md`](evidence/s0-runtime-promotion-certification-2026-08-31.md) |
| S1 | `550cdca619856fe246ab569588f9036a7025e7a7` | `33461510248` | `99712416091` | `9783331341` | `7f69bf9d33b2e854d5cc4941b41059dc358437675cf0bbb6d102c29f129b2097` | [`s1-services-contracts-certification-2026-08-31.md`](evidence/s1-services-contracts-certification-2026-08-31.md) |
| S2 | `cec97a2b90a7aee8ae1deb3660bad0d7a759ace6` | `33461895218` | `99713587556` | `9783467265` | `0b7c0addd1849da87fe03afc93053a5df7c3fddf674f9baf5a78e3400d9a3677` | [`s2-services-read-engine-certification-2026-08-31.md`](evidence/s2-services-read-engine-certification-2026-08-31.md) |
| S3 | `a6974cdbb669b66a07b8780d5e20c960d6a0cd64` | `33531884206` | `99936776923` | `9810084527` | `fa6a9efaa67309a4255dbce62fe362402ff453643e90f63c82c1457099e9de60` | [`s3-services-eligibility-certification-2026-09-01.md`](evidence/s3-services-eligibility-certification-2026-09-01.md) |
| S4 | `f3e54b853af5f01fb2e9ed7d032f784e3cffb81e` | `33538554471` | `99959020329` | `9812703293` | `275dd054247a89f0f4f8fe6c9244685d06cdd72117408c5282acbf6139b67a9c` | [`s4-services-management-certification-2026-09-01.md`](evidence/s4-services-management-certification-2026-09-01.md) |
| S5 | `7568618062f4192b34caf6e916b58534f304ad3f` | `33539683548` | `99962550022` | `9813129778` | `22f823b50babf13691c12d6c5783619568d2198d1123f2fa7c9c22fcf218a708` | [`s5-services-snapshot-certification-2026-09-01.md`](evidence/s5-services-snapshot-certification-2026-09-01.md) |
| S6 | `3eed68b45036154bcf1776564f479cd02e30d0d4` | `33666790884` | `100370414068` | `9860927146` | `543feab917c80dfd3a9cecbff7db15170d82cc66a621b837616d73a798b57564` | [`s6-services-multibusiness-certification-2026-09-02.md`](evidence/s6-services-multibusiness-certification-2026-09-02.md) |
| C1A | `860629e9ada498e225ae803a9fe6f077949ec320` | `33542468975` | `99971830150` | `9814172765` | `a12fa1b0283524948d5fa0d253953c5588ba2692a5cc0bbee93ded65265656f3` | [`c1a-webchat-workflow-visibility-certification-2026-09-01.md`](evidence/c1a-webchat-workflow-visibility-certification-2026-09-01.md) |
| C1A UI hardening | `ed207f8c82ae9138f92fd505209c30c4eeba243b` | `33560864234` | `100032737031` | `9821207955` | `4f7fc1ddea852a9501f20078d0df8ecc84dc3c645e8b1362424c6d6f11ae37ff` | [`../Test/c1a-webchat-human-verification-2026-09-01.md`](../Test/c1a-webchat-human-verification-2026-09-01.md) |
| C1B | `2008fce4f863fdabf8e8f323eee1d7cda05cb454` | `33647842017` | `100307008849` | `9853555059` | `efa65255fdc4c8569f55cefd38202145d2feb5a275d1c897f4b58dbb10a023bf` | [`c1b-durable-channel-certification-2026-09-02.md`](evidence/c1b-durable-channel-certification-2026-09-02.md) |

## S6 — multi-business generality

S6 uses two materially different synthetic businesses through the same Services contracts, Temporal management Workflow and persistence/read/eligibility implementation.

Direct marker:

```text
SERVICES_S6_MULTIBUSINESS_PASS {
  "businesses":["s6-golden-auto","s6-golden-vet"],
  "sharedServiceCode":"primary-service",
  "sharedOfferingCode":"standard",
  "businessScopedReads":true,
  "businessScopedIdempotency":true,
  "crossBusinessDependencyRejected":true,
  "deterministicEligibility":true,
  "autoDurationMinutes":30,
  "vetDurationMinutes":45,
  "workflowAuditCount":6
}
```

The same run also emitted `SERVICES_S6_NO_VERTICAL_FIXTURE_BRANCHING_PASS`, re-ran dynamic S4 management/rejection proofs, and completed the inherited Appointment E2E including atomic slot-conflict and idempotency replay regression.

S6 therefore certifies **Services generality/isolation**, not S7 Appointment consumption of canonical Services snapshots.

Verification ledger: [`../Test/g1-services-engine-s0-s6.md`](../Test/g1-services-engine-s0-s6.md).

## Channel evidence boundary

C1A proved a minimal browser surface can drive the explicit Appointment Workflow while exposing real Temporal state and a deterministic 12-step engineering view. A post-human timing fix removed duplicate Step 08/11 prompts and was human verified.

C1B added durable PostgreSQL conversation/event correlation, exact replay, material-conflict rejection and physical WebChat process restart/recovery to the same Workflow. It did not add Agent/MCP or channel-specific business policy.

## Failure / supersession provenance

Failures are retained rather than erased.

### S3

```text
Run      33531803288
Result   FAILURE
Cause    strict TypeScript exactOptionalPropertyTypes test-fixture mismatch
```

### S4

Run `33538120900` was green before dependency-reference hardening. The final S4 authority is `33538554471`.

### S6

```text
Run       33666702773
Job       100370123359
Source    1cf6c133c33eaabfd9539fffcf8b4568e6dc8d34
Result    FAILURE
Stage     static anti-vertical implementation guard, before Compose/runtime
Cause     guard scanned an existing unit-test fixture string and false-positively matched `golden-auto`
Artifact  9860853124
SHA-256   a9e04c9e69742fddf9d8fc567546c90adc7ce629f58801ea112c17411479dc41
```

The guard was narrowed to implementation `.ts` files excluding `*.test.ts`. No Services runtime/business invariant changed. Run `33666790884` is the sole S6 certification authority.

### C1A

```text
Run      33542360241
Result   FAILURE
Stage    typecheck before runtime
Cause    RequestInit/BodyInit strict TypeScript incompatibility
```

### C1B

```text
Run       33647731151
Source    9cedded6ca7ebd3e0d5ddd12468a358784573089
Result    FAILURE
Stage     strict TypeScript typecheck before runtime
Cause     exactOptionalPropertyTypes replay-response fallback mismatch
Artifact  9853467649
SHA-256   b663d43180b259ea1bd565b57f025884599dd63dbb9337401e37f1f32e91120e
```

## Receipt meaning

```text
S0  executable MK1 baseline
S1  Services contracts/persistence
S2  deterministic Services reads
S3  deterministic eligibility/recommendation
S4  versioned/idempotent Services management
S5  revision-stable Workflow snapshots across catalog change + Worker restart
S6  same Services implementation proven across materially different businesses
C1A HTML WebChat drives/exposes real durable Appointment flow
C1B WebChat correlation/event semantics survive replay/conflict/process restart
```

No individual receipt expands into a broader production-readiness claim.

## Evidence rule

Every next gate records at minimum:

```text
executed source SHA
branch
run ID
job ID
result
artifact ID
artifact SHA-256
executed probes
regression scope
failure provenance
explicit non-claims
human-readable verdict
```

## Current next work

```text
Services track  S7 Appointment → canonical Services integration
Scheduler track design frozen; build waits for the intended Services boundary
Channel track   Telegram design exists; physical transport proof deferred
```

Cross-references:

- Services plan: [`../Plan/01-services-engine-gates.md`](../Plan/01-services-engine-gates.md)
- Services S6 verification: [`../Test/g1-services-engine-s0-s6.md`](../Test/g1-services-engine-s0-s6.md)
- Platform 3–4–5 roadmap: [`../Plan/04-platform-steps-3-4-5-roadmap.md`](../Plan/04-platform-steps-3-4-5-roadmap.md)
- Multi-channel plan: [`../Plan/02-cta-multichannel-poc-gates.md`](../Plan/02-cta-multichannel-poc-gates.md)
