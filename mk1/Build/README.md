# MK1 Build & Evidence Index

## Purpose

This directory records executable build history and certification receipts for MK1. Design intent belongs in `Brainstorming`, `mining-site`, `Design`, `Plan`, and `golden-dataset`; this directory answers:

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

G3 CTA channel proof
  C0A Workflow-view projection       ✅ CERTIFIED
  C1A Workflow-visible WebChat       ✅ CERTIFIED + HUMAN VERIFIED POST-FIX
  C1B Durable channel semantics      🔧 OPEN
  C2 Telegram                        ⏭ QUEUED
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
| C1A | `860629e9ada498e225ae803a9fe6f077949ec320` | `33542468975` | `99971830150` | `9814172765` | `a12fa1b0283524948d5fa0d253953c5588ba2692a5cc0bbee93ded65265656f3` | [`c1a-webchat-workflow-visibility-certification-2026-09-01.md`](evidence/c1a-webchat-workflow-visibility-certification-2026-09-01.md) |
| C1A UI hardening | `ed207f8c82ae9138f92fd505209c30c4eeba243b` | `33560864234` | `100032737031` | `9821207955` | `4f7fc1ddea852a9501f20078d0df8ecc84dc3c645e8b1362424c6d6f11ae37ff` | post-fix regression; human record in [`../Test/c1a-webchat-human-verification-2026-09-01.md`](../Test/c1a-webchat-human-verification-2026-09-01.md) |

## Services evidence highlights

S4 certifies versioned/idempotent Services management through Temporal, PostgreSQL command truth, optimistic revision protection, lifecycle changes, Mongo terminal audit, and no-partial-effect dependency rejection.

S5 certifies the long-running versioning property:

```text
original snapshot revision  N=1
mutable catalog revision    N+1=2
Worker restart              PID 31 -> 36
original Workflow result    revision 1
new Workflow result         revision 2
```

The same S5 run retained S4 and inherited Appointment regression.

## C1A WebChat evidence highlights

C1A extends the CLI-style Appointment flow into a deliberately small browser surface:

```text
Browser WebChat
→ WebChat transport server
→ existing CTA HTTP boundary
→ Temporal
→ RegisterNewAppointment
```

Two pages are executed:

```text
/webchat/
/webchat/workflow.html?workflowId=<id>
```

The original certification marker is:

```text
WEBCHAT_C1_WORKFLOW_VISIBILITY_PASS
```

The executed Workflow reached `CREATED` with every visible checkpoint reported `COMPLETE`:

```text
01 Start Workflow
02 Customer name
03 Customer email
04 Customer phone
05 Resolve Customer
06 Select Service
07 Select Offering / Product
08 Set Date
09 Load Available Slots
10 Select Slot
11 Finalize Appointment
12 Appointment Created
```

The same evidence explicitly reported:

```text
agent=false
mcp=false
```

### Human verification and renderer hardening

Human browser execution subsequently proved the same complete flow with both an `EXISTING` Customer path and a `CREATED` Customer path.

The first human run discovered duplicate presentation prompts around Step 08 and Step 11. The durable Workflow/business result remained singular. The renderer guard was fixed in `ed207f8c82ae9138f92fd505209c30c4eeba243b`, then the complete C1 regression passed again in run `33560864234`.

A second human run on 2026-09-02 confirmed:

```text
Step 08 duplicate prompt       NOT OBSERVED
Step 11 duplicate prompt       NOT OBSERVED
workflowStatus                 COMPLETED
phase                          CREATED
nextAction                     NONE
issues                         []
all 12 visible steps           COMPLETE
Workflow Inspector parity      PASS
```

Public human evidence is intentionally redacted of tester contact and execution identifiers:

[`../Test/c1a-webchat-human-verification-2026-09-01.md`](../Test/c1a-webchat-human-verification-2026-09-01.md)

C1A is therefore certified and human verified post-fix, but it remains a workflow-visible interaction proof rather than the complete durable channel-correlation gate.

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

### S4

Run `33538120900` was green before dependency-reference hardening. The final authority is `33538554471`; superseded/cancelled intermediate executions remain historical provenance.

### C1A

```text
Run      33542360241
Result   FAILURE
Cause    WebChat proxy RequestInit/BodyInit strict TypeScript incompatibility
Stage    typecheck before runtime execution
Fix      explicit UTF-8 proxy request body
Policy   no Workflow/business invariant weakened
```

Final original C1A certification authority is successful run `33542468975`. Post-certification renderer hardening is separately evidenced by successful run `33560864234` and repeated human verification.

## What the receipts mean

A receipt is a bounded certification claim, not general product readiness.

```text
S0  -> promoted runtime baseline executable
S1  -> Services contracts/persistence foundation
S2  -> deterministic Services reads
S3  -> deterministic eligibility/recommendation
S4  -> versioned/idempotent Services management
S5  -> revision-stable Workflow snapshots across Worker restart
C1A -> HTML WebChat can drive and expose the real durable Appointment flow
```

C1A does not imply C1B durable channel correlation/idempotency, Telegram, WhatsApp, Scheduler, Agent, MCP, or production readiness.

## Required evidence rule

Every subsequent gate must record at minimum:

```text
source SHA
branch
workflow run ID
job ID
result
artifact ID
artifact SHA-256
executed probes
regression scope
explicit non-claims
human-readable verdict
```

Documentation-only commits after a runtime execution may index the evidence, but must never be represented as the source SHA that was executed.

## Current next work

Parallel bounded fronts:

```text
Services: S6 multi-business generality
Channel:  C1B durable conversation binding + inbound-event dedupe
```

Telegram remains after the WebChat channel contract is hardened sufficiently to prove that the second transport is reusing rather than redefining the architecture.

## Cross-reference

- Services plan: [`../Plan/01-services-engine-gates.md`](../Plan/01-services-engine-gates.md)
- Channel plan: [`../Plan/02-cta-multichannel-poc-gates.md`](../Plan/02-cta-multichannel-poc-gates.md)
- Channel adapter design: [`../Design/02-cta-channel-adapter-contract.md`](../Design/02-cta-channel-adapter-contract.md)
- Workflow visibility design: [`../Design/03-workflow-visibility-contract.md`](../Design/03-workflow-visibility-contract.md)
- Human WebChat verification: [`../Test/c1a-webchat-human-verification-2026-09-01.md`](../Test/c1a-webchat-human-verification-2026-09-01.md)
