# Scheduler G2-S4 Certification Evidence — 2026-09-14

## Scope

Gate: `G2-S4 — Holds + expiry + replay`

Canonical active branch: `build/g2-scheduler`

Active PR: `#32`

This evidence records the executable candidate used to promote G2-S4 into the certified prefix. The mandatory exact-final-head rerun occurs after the receipt, roadmap and ledger transition are committed; final run IDs and digests are attached to PR #32 because writing them back into the branch would create another head and recursively invalidate the seal.

## Certified behaviors

```text
CreateHold durable persistence
CreateHold replay with identical operation material
CreateHold IDEMPOTENCY_MATERIAL_CONFLICT on changed material
ReleaseHold durable transition
ReleaseHold replay
persisted expiresAt
logical expiry from persisted time
expired ACTIVE hold non-blocking before housekeeping
fresh PostgreSQL Pool preserves logical expiry truth
housekeeping ACTIVE → EXPIRED projection
valid hold atomic consumption during confirmation
held confirmation replay
expired hold → HOLD_EXPIRED
expired-hold failed confirmation → zero reservation effect
expired-hold failed confirmation → zero command-ledger effect
G2-S0/S1/S2/S3 predecessor regressions
inherited CTA orchestration regression
provider/vertical isolation
no Appointment migration
```

## Critical logical-expiry proof

```text
physical row status: ACTIVE
persisted expires_at: <= asOf
availability blocking truth: false
fresh process/Pool result: same
housekeeping required for correctness: no
```

The housekeeping mutation is a persisted projection, not the source of scheduling correctness.

## Initial complete candidate

```text
SHA       dbe392314827184cc6494a5c2ac7f67556a0553f
Push run  34903927096  SUCCESS
PR run    34903931553  SUCCESS
```

### Push artifacts

```text
scheduler-g2-s4-34903927096
id      10371822139
sha256  1c89f6b37c83fa58d288b37ecfb849cdbc36353014bf25eb7c165ecff490d5bb

scheduler-g2-s4-seal-34903927096
id      10372350860
sha256  aef00a1cf561ab1027c4f2a2299904f631e0084430e281b04de4fd0412983757
```

### PR artifacts

```text
scheduler-g2-s4-34903931553
id      10372585373
sha256  c8464800d425df2616a855c0674bea7ac044f8fb986a480cc5ad65d16a43d610

scheduler-g2-s4-seal-34903931553
id      10372635160
sha256  49d0f8dd4b8fabf818398d5ce584e730212023a4d90e113bbbb7583e5a665752
```

## Forward-compatible predecessor regression

After G2-S4 existed, the G2-S3 workflow was corrected so its old pre-S4 boundary guard no longer treated legitimate hold lifecycle code as a regression. The replacement guard protects the actual certified G2-S3 invariant: atomic confirmation, typed `CAPACITY_CONFLICT`, resource-scoped serialization and the executable G2-S3 certification script.

On canonical head `590a4c2ea0f7a8e7b51f84fb4c70071ad1c24b7b`, the PR-triggered G2-S4 run `34904267700` completed successfully, proving G2-S4 remained green after that predecessor-gate correction.

## Required terminal markers

```text
SCHEDULER_G2_S4_CONTRACTS_PASS
SCHEDULER_G2_S4_GENERIC_BOUNDARY_PASS
SCHEDULER_G2_S4_PERSISTED_TIME_EXPIRY_PASS
SCHEDULER_G2_S4_NO_APPOINTMENT_MIGRATION_PASS
SCHEDULER_G2_S4_PREDECESSOR_REGRESSION_PASS
SCHEDULER_G2_S4_HOLD_LIFECYCLE_PASS
SCHEDULER_G2_S4_PLATFORM_REGRESSION_PASS
SCHEDULER_G2_S4_CERTIFICATION_PASS
```

## Final-seal rule

The final certified head is the commit produced after all G2-S4 documentation plus the ledger transition `G2-S4 CERTIFIED / G2-S5 NEXT` are present. The dedicated G2-S4 push and PR workflows must both be green on that exact head. Final run IDs, artifact IDs and digests are recorded in PR #32 without changing the branch again.

## Non-claims

This gate does not claim:

```text
general multi-business proof
Services→SchedulingDemand runtime integration
Appointment→Scheduler migration
multi-resource search/optimization
reservation cancellation/completion lifecycle
Integration Engine readiness
Scheduler final production readiness
```
