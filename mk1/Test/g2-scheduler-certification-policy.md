# G2 Scheduler Engine — Mandatory Certification Policy

Date: 2026-09-14

## Purpose

This policy makes the Scheduler roadmap a sequence of **hard certification gates**. A gate may not be treated as complete because code exists, tests pass locally, or a later gate happens to exercise it. Each Scheduler step must earn its own executable receipt before the next step becomes active.

## Non-negotiable gate rule

For every gate `G2-Sn`:

```text
IMPLEMENT
→ RUN DEDICATED GATE CI
→ PROVE PROTECTED PREDECESSOR REGRESSIONS
→ EMIT GATE-SPECIFIC TERMINAL MARKER
→ PRESERVE EVIDENCE ARTIFACT
→ WRITE/UPDATE TEST RECEIPT + TRUTH BOUNDARY
→ UPDATE MACHINE-READABLE LEDGER
→ RE-RUN THE SAME GATE ON THE FINAL BRANCH HEAD
→ ONLY THEN ADVANCE G2-S(n+1) TO NEXT
```

No Scheduler gate may be skipped, batch-certified retroactively, or inferred from a later gate.

## Required evidence for every certified gate

A gate is `CERTIFIED` only when all of the following are true:

1. a dedicated executable GitHub Actions workflow exists for that gate;
2. the workflow succeeds on the exact branch head that contains the gate implementation and its current receipts/policy changes;
3. a gate-specific terminal marker is emitted, using the form `SCHEDULER_G2_Sn_CERTIFICATION_PASS`;
4. at least one evidence artifact is uploaded and GitHub records its digest;
5. the gate has a `mk1/Test/` certification receipt with an explicit scope and non-claims section;
6. predecessor contracts/regressions required by the gate are rerun and pass;
7. the machine-readable ledger remains sequential and valid;
8. the roadmap advances only after the above conditions are met.

A documentation-only commit that changes the active Scheduler contract, certification receipt, roadmap state, ledger, policy, or workflow invalidates the previous branch-head claim until the same active gate workflow succeeds again on the new head.

## Sequential gates

```text
G2-S0 Contract + persistence foundation
G2-S1 Resource/capability/schedule management
G2-S2 Deterministic availability engine
G2-S3 Atomic reservation + concurrency conflict
G2-S4 Holds + expiry + replay
G2-S5 Multi-business generality
G2-S6 Services snapshot/demand integration
G2-S7 Appointment Workflow integration
G2-S8 Multi-resource assignment proof or explicit deferral
G2-S9 Final clean Scheduler certification
```

## Gate-specific minimum proofs

### G2-S0

Contract/persistence foundation, migration replay/reentrancy, provider-agnostic boundary, business isolation, advisory SlotCandidate, no premature Appointment migration, inherited CTA/Temporal regression.

### G2-S1

Versioned/idempotent resource, capability, schedule-template and override management; durable command identity/material conflict semantics; G2-S0 regression.

### G2-S2

Deterministic read-only availability from schedules, overrides, capabilities, capacity and existing allocations; no persisted candidate-as-truth; G2-S0/S1 regressions.

### G2-S3

Atomic reservation correctness under concurrency. Required invariant:

```text
last remaining capacity + two concurrent confirmations
→ exactly one success
→ exactly one typed conflict
→ no partial second business effect
```

### G2-S4

Logical hold expiry, replay, retry and restart semantics without duplicate reservation effects.

### G2-S5

Materially different business fixtures pass through one Scheduler implementation with no vertical branches.

### G2-S6

Immutable Services `SchedulingDemand` handoff. Catalog head changes after snapshot creation must not silently alter active scheduling demand semantics.

### G2-S7

Appointment integration is allowed only after G2-S3 is certified. The workflow must preserve `availability shown != reservation persisted` and reference the canonical Scheduler reservation result.

### G2-S8

Either prove the required multi-resource assignment behavior end-to-end or publish an explicit, testable deferral. Schema capability alone is not a product-support claim.

### G2-S9

One clean closure suite reruns G2-S0–S8 plus protected CTA, Temporal, Services and Persistence regressions and emits the final Scheduler receipt.

## Merge boundary

Certification does not authorize merge. Stacked Scheduler PRs remain unmerged until the user explicitly authorizes the appropriate merge sequence.

## Machine-readable source

The enforceable gate state is recorded in:

`mk1/Test/g2-scheduler-certification-ledger.json`

The repository verifier is:

`mk1/runtime/scripts/verify-scheduler-certification-ledger.ts`

Every Scheduler gate workflow must execute that verifier before emitting its terminal certification marker.
