# G1 Services Engine — Verification Ledger through S5

## Status

**S0–S5 VERIFIED / G1 NOT YET COMPLETE**

This ledger indexes executable Services evidence through S5. Individual Build receipts remain the certification authority for each bounded gate.

## Evidence rule

```text
UNKNOWN != PASS
documented != verified
unit test != runtime integration proof
CI green != broader gate certification unless the job proves the gate contract
failed/superseded attempts remain provenance
```

## Certified gates

| Gate | Claim | Source SHA | Run | Job | Artifact |
|---|---|---|---:|---:|---:|
| S0 | exact MK0 runtime promotion | `6dcafa0f5b5704cb9a3a9bcbdaef25fe368006b1` | `33461008031` | `99710964036` | `9783188036` |
| S1 | generic Services contracts + persistence | `550cdca619856fe246ab569588f9036a7025e7a7` | `33461510248` | `99712416091` | `9783331341` |
| S2 | deterministic Services read engine | `cec97a2b90a7aee8ae1deb3660bad0d7a759ace6` | `33461895218` | `99713587556` | `9783467265` |
| S3 | deterministic eligibility/recommendation | `a6974cdbb669b66a07b8780d5e20c960d6a0cd64` | `33531884206` | `99936776923` | `9810084527` |
| S4 | versioned/idempotent management | `f3e54b853af5f01fb2e9ed7d032f784e3cffb81e` | `33538554471` | `99959020329` | `9812703293` |
| S5 | durable running-Workflow snapshots | `7568618062f4192b34caf6e916b58534f304ad3f` | `33539683548` | `99962550022` | `9813129778` |

## S5 — Durable running-Workflow snapshot semantics

Verdict: **PASS / CERTIFIED**

Artifact digest:

```text
22f823b50babf13691c12d6c5783619568d2198d1123f2fa7c9c22fcf218a708
```

The executed proof established:

```text
original Service revision       1
original Offering revision      1
published Service revision      2
published Offering revision     2
waiting snapshot changed        false
Worker before restart           PID 31
Worker after restart            PID 36
original completed revision     1
new Workflow observed revision  2
```

Direct markers:

```text
SERVICES_S5_PRE_RESTART_PASS
SERVICES_S5_SNAPSHOT_PASS
```

The final marker reported:

```text
originalSurvivedWorkerRestart=true
originalServiceRevision=1
originalOfferingRevision=1
newServiceRevision=2
newOfferingRevision=2
originalCompletedWithFrozenSemantics=true
newWorkflowObservedCatalogHead=true
```

This proves a running Temporal consumer does not silently reinterpret mutable Services head data after it has captured its revision-specific semantics.

## Regression carried with S5

The same successful S5 run re-executed:

```text
strict TypeScript check
Services S1 contract tests
Services S2 compatibility tests
Services S3 recommendation tests
Services S4 management tests
Customer registration contract tests
CLI CTA contract tests
AttachmentStore tests
Appointment contract tests
S4 management runtime probe
S4 rejection-safety runtime probe
full inherited Appointment certification
```

Appointment markers all passed through `MK0_REGISTER_NEW_APPOINTMENT_PASS`.

## S4 authority retained

S5 reused the S4 mutation path to publish revision N+1. It did not bypass or weaken S4.

The S5 run independently repeated:

```text
SERVICES_S4_MANAGEMENT_PASS
SERVICES_S4_REJECTION_SAFETY_PASS
```

including exact replay, material-conflict protection, business-scoped idempotency, optimistic concurrency, terminal audit and no-partial-effect invalid dependency rejection.

## Remaining unsupported claims

This ledger does not yet certify:

```text
S6 materially different business generality
S7 final Appointment consumption of generic Services boundary
S8 clean final G1 certification
Scheduler Engine
WebChat runtime adapter
Telegram runtime adapter
WhatsApp runtime adapter
Agent
MCP
production deployment
```

## Channel-phase boundary

The planned WebChat and Telegram proofs remain CLI-compatible CTA transport work only:

```text
channel adapter
→ canonical CTA operation
→ Temporal
→ same Workflow contracts
```

No Agent, MCP or LLM orchestration belongs in that phase.

## Next Services verification target

S6 must prove the generic Services contract works across materially different business definitions through the same contracts and persistence paths without business-name branching.

## Receipts

- [`../Build/evidence/s0-runtime-promotion-certification-2026-08-31.md`](../Build/evidence/s0-runtime-promotion-certification-2026-08-31.md)
- [`../Build/evidence/s1-services-contracts-certification-2026-08-31.md`](../Build/evidence/s1-services-contracts-certification-2026-08-31.md)
- [`../Build/evidence/s2-services-read-engine-certification-2026-08-31.md`](../Build/evidence/s2-services-read-engine-certification-2026-08-31.md)
- [`../Build/evidence/s3-services-eligibility-certification-2026-09-01.md`](../Build/evidence/s3-services-eligibility-certification-2026-09-01.md)
- [`../Build/evidence/s4-services-management-certification-2026-09-01.md`](../Build/evidence/s4-services-management-certification-2026-09-01.md)
- [`../Build/evidence/s5-services-snapshot-certification-2026-09-01.md`](../Build/evidence/s5-services-snapshot-certification-2026-09-01.md)
