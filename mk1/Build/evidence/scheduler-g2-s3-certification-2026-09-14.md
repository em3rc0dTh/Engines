# Scheduler G2-S3 — Atomic Reservation Certification Evidence

Date: 2026-09-14

## Canonical development line

Scheduler G2 is now maintained on one active branch/PR rather than one branch per gate:

```text
active branch  build/g2-scheduler
active PR      #32 — Scheduler G2 canonical track
base branch    feature/pre-scheduler-node-edge-certification
base SHA       7051dd2207545239563febfd9d1b44330c11da35
```

Historical certified per-gate PRs remain evidence but are closed unmerged:

```text
#29  G2-S0  historical evidence
#30  G2-S1  historical evidence
#31  G2-S2  historical evidence
```

No certification history was rewritten. The canonical branch descends from the exact G2-S2 final certified head and preserves the prior commits.

## G2-S3 implementation candidate

```text
candidate SHA  84b8b7f6d46c954681fe185175295527c1b029d3
```

The candidate adds:

```text
mk1/runtime/src/scheduler/reservation-engine.ts
mk1/runtime/scripts/certify-scheduler-g2-s3.ts
.github/workflows/mk1-scheduler-g2-s3.yml
package script probe:scheduler:g2:s3
```

## Certified executable invariant

The dedicated probe creates a one-capacity resource, produces one valid advisory candidate, and starts two confirmations concurrently with different operation IDs.

Required and observed result:

```text
concurrent confirmations                       2
successful confirmations                       1
rejected confirmations                         1
race loser code                                CAPACITY_CONFLICT
persisted reservations for contested demand    1
persisted assignments for contested demand     1
successful contender command rows              1
loser reservation effect                       0
loser assignment effect                        0
loser command-ledger effect                    0
```

The implementation serializes the final capacity commitment on a deterministic business+resource PostgreSQL transaction advisory lock and revalidates the candidate before mutation.

## Stale-candidate proof

A separate fixture:

```text
1. generates a valid candidate;
2. persists an UNAVAILABLE override covering that candidate;
3. attempts confirmation using the old candidate;
4. receives SLOT_NO_LONGER_AVAILABLE;
5. proves zero reservation / command / demand side effect.
```

This certifies that a displayed `SlotCandidate` never becomes booking authority by itself.

## Idempotency proof

```text
winner operation + identical canonical material
→ same reservation identity
→ replayed=true
→ no duplicate mutation

winner operation + changed material
→ IDEMPOTENCY_MATERIAL_CONFLICT
→ no second business effect
```

## Initial push certification

```text
run       34902731449
SHA       84b8b7f6d46c954681fe185175295527c1b029d3
result    SUCCESS
```

Jobs:

```text
g2-s3-contracts-boundaries          PASS
g2-s3-postgres-atomic-reservation   PASS
scheduler-g2-s3-seal                PASS
```

Artifacts:

```text
scheduler-g2-s3-34902731449
id      10371059124
sha256  16edbc1948b57b90024c800e3a329458168fb2466418eaeca98ffe93bfbbaadc

scheduler-g2-s3-seal-34902731449
id      10371328508
sha256  25f7ebb43847d07999b084b585ad891a3d8911aa08702071b0030996cf0b3abc
```

## Initial PR certification

```text
run       34902734577
SHA       84b8b7f6d46c954681fe185175295527c1b029d3
result    SUCCESS
```

Artifacts:

```text
scheduler-g2-s3-34902734577
id      10370773639
sha256  aeb0923c78c963c861b7d63edcadd9087a9da47ad03400c426c60bfc16024ea9

scheduler-g2-s3-seal-34902734577
id      10371835081
sha256  4c53843427c9f938a929bab7333a073a3a233b721954e0efd0e8a8d254c1da5a
```

## Terminal markers

```text
SCHEDULER_G2_S3_CONTRACTS_PASS
SCHEDULER_G2_S3_PREDECESSOR_REGRESSION_PASS
SCHEDULER_G2_S3_ATOMIC_RESERVATION_PASS
SCHEDULER_G2_S3_PLATFORM_REGRESSION_PASS
SCHEDULER_G2_S3_CERTIFICATION_PASS
```

## Protected predecessor evidence

The G2-S3 gate reruns:

```text
G2-S0 contract/persistence proof
G2-S1 resource/schedule management proof
G2-S2 deterministic availability proof
Appointment contract regressions
Services management regressions
CTA canonical regressions
inherited CTA → Temporal orchestration probe
```

The Appointment implementation remains unchanged and outside Scheduler during G2-S3.

## Truth boundary

Certified by G2-S3:

```text
direct one-resource candidate confirmation
commit-time candidate revalidation
resource-scoped atomic capacity serialization
exactly-one-winner last-capacity race correctness
typed CAPACITY_CONFLICT loser
zero partial loser mutation
successful-operation replay
idempotency material conflict rejection
stale-candidate rejection
```

Not certified by G2-S3:

```text
hold creation / hold release
hold consumption during reservation
logical hold expiry / restart semantics
reservation cancel / complete lifecycle
general multi-business proof
runtime Services → SchedulingDemand integration
Appointment → Scheduler migration
multi-resource search / optimization
final Scheduler production readiness
```

## Final-head rule

The initial candidate passed before ledger, test receipt, design, roadmap and this evidence file were promoted. Those documentation commits change the canonical branch SHA. Therefore G2-S3 is not considered finally sealed until the same dedicated push and PR workflows pass on the exact final `build/g2-scheduler` head.

After that exact-head rerun, G2-S4 is the next allowed gate and must continue on the same canonical branch rather than creating another default per-gate branch.
