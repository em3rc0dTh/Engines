# Scheduler G2-S0 — Contract + Persistence Certification Evidence

Date: 2026-09-14

## Candidate

```text
Branch  build/g2-s0-scheduler-contract-persistence
Head    eb278eb5b10d6b129c3801c934570e1f787571eb
Run     34883086249
Result  SUCCESS
```

## Certification axes

### Contract/boundary axis

The run passed:

- locked dependency install;
- TypeScript compilation;
- Scheduler G2-S0 contract tests;
- inherited Appointment, Services and canonical CTA contract regressions;
- provider-agnostic Scheduler guard;
- no premature Appointment → Scheduler integration guard;
- advisory/non-persisted `SlotCandidate` guard.

Terminal marker:

```text
SCHEDULER_G2_S0_CONTRACTS_PASS
```

### PostgreSQL foundation axis

A clean PostgreSQL + MongoDB laboratory executed the complete inherited migration chain plus `009_scheduler_engine_foundation.sql`. The Scheduler migration was executed a second time successfully to prove reentrancy.

The persistence probe then certified:

- Scheduler Resource + embedded capability persistence/roundtrip;
- recurring schedule template/windows persistence/roundtrip;
- offset-aware schedule override persistence/roundtrip;
- immutable `SchedulingDemand` persistence with stable SHA-256 snapshot identity;
- no FK coupling from `scheduler_demands` to mutable Services catalog tables;
- Hold and Reservation schema/assignment persistence;
- multi-resource-compatible assignment table shape;
- cross-business relational reference rejection;
- durable Scheduler command operation-identity/material foundation;
- duplicate business operation identity rejection;
- absence of a `scheduler_slot_candidates` persistence table.

Terminal markers:

```text
SCHEDULER_G2_S0_POSTGRES_MIGRATION_OK
SCHEDULER_G2_S0_CONTRACT_PERSISTENCE_PASS
```

### Inherited platform regression axis

After Scheduler persistence was installed, the existing Temporal Worker, CTA runtime and Channel Core were started over the same database. The canonical CTA appointment probe passed without Appointment being rewritten against Scheduler.

Terminal markers:

```text
CTA_ORCHESTRATION_POC_PASS
SCHEDULER_G2_S0_PRE_SCHEDULER_REGRESSION_PASS
```

### Aggregate seal

```text
SCHEDULER_G2_S0_CERTIFICATION_PASS
```

## Artifacts

Runtime/persistence evidence:

```text
name    scheduler-g2-s0-34883086249
id      10364305456
digest  sha256:6cf3551d2c8b02df67d15e7b99c52f739373af1747a2484d994e88beb4590c7c
```

Aggregate seal:

```text
name    scheduler-g2-s0-seal-34883086249
id      10364195884
digest  sha256:5327ff85601fa307b90f4cf71022412a8d11cf505193928870fe532c0d9a7726
```

## Truth boundary

This evidence certifies **G2-S0 only**. It does not claim deterministic availability, resource management APIs, atomic concurrent reservation correctness, hold expiry/replay, runtime Services handoff, Appointment migration, multi-resource search or final Scheduler readiness. Those are future gates.

Documentation-only commits after this executable candidate must be re-run through the G2-S0 workflow before they replace the certified branch head.
