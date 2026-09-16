# Scheduler G2-S2 Certification Evidence — 2026-09-14

## Gate

```text
G2-S2 — Deterministic Availability Engine
```

## Stack

```text
base branch  build/g2-s1-scheduler-management
base head    1a0fe76c2b5f083962fa3617eb3c75b316c32711
base gate    G2-S1 CERTIFIED
head branch  build/g2-s2-deterministic-availability
```

## Certified candidate scope

The candidate implements deterministic, read-only one-resource availability over current Scheduler truth:

```text
ACTIVE resource filtering
capability code / quantity / resource-kind matching
weekly schedules
AVAILABLE / UNAVAILABLE / CAPACITY overrides
segment-wise effective capacity
RESERVED allocations
persisted ACTIVE holds
pre/post buffers
configurable granularity
deterministic candidate IDs
stable candidate ordering
preferred-resource filtering
result limits
SlotCandidate advisory/non-persisted
```

## Successful implementation candidate

```text
head  147b9dc941a974d6da3d668ccbb8dcd52624366a
push  34901265173  SUCCESS
PR    34901279787  SUCCESS
```

Both runs completed:

```text
g2-s2-contracts-boundaries   PASS
g2-s2-postgres-availability  PASS
scheduler-g2-s2-seal         PASS
```

Executable proof includes:

```text
TypeScript                                        PASS
Scheduler sequential ledger verifier             PASS
G2-S0 contract predecessor regression             PASS
G2-S0 persistence predecessor regression          PASS
G2-S1 management predecessor regression           PASS
protected Appointment / Services / CTA tests      PASS
provider/vertical-agnostic availability boundary  PASS
SlotCandidate remains advisory/non-persisted      PASS
no premature Appointment → Scheduler integration  PASS
ACTIVE resource filter                            PASS
capability + resource-kind matching               PASS
weekly schedule evaluation                        PASS
AVAILABLE exceptional opening                     PASS
UNAVAILABLE blocking                              PASS
CAPACITY override evaluation                      PASS
RESERVED allocation capacity                      PASS
persisted ACTIVE hold capacity                    PASS
pre/post buffer occupancy                         PASS
deterministic replay                              PASS
deterministic candidate IDs                       PASS
stable slot ordering                              PASS
inherited CTA → Temporal regression               PASS
```

## Terminal markers

```text
SCHEDULER_G2_S2_CONTRACTS_PASS
SCHEDULER_G2_S2_PREDECESSOR_REGRESSION_PASS
SCHEDULER_G2_S2_AVAILABILITY_PASS
SCHEDULER_G2_S2_PLATFORM_REGRESSION_PASS
SCHEDULER_G2_S2_CERTIFICATION_PASS
```

## Push artifacts

```text
scheduler-g2-s2-34901265173
id      10371390716
sha256  2f7eb80f708817bdf852d3a8a9244478c7df440ebfdfb3b06eeb3b99c75a606d

scheduler-g2-s2-seal-34901265173
id      10371031732
sha256  e16bd156bf9c3e351f20158a4a3d8567124df39609a6c8180360a86c3c30c18a
```

## PR artifacts

```text
scheduler-g2-s2-34901279787
id      10371325955
sha256  df4c5c1d57de14e160f2405127d12835ba63a04b0fb4d04e27f3a5a3d7f7992d

scheduler-g2-s2-seal-34901279787
id      10370567514
sha256  18cb434b53849822f75d9f5febf7b7a6abff2ec5a50b7d285d461da0cbd31596
```

## Capacity proof shape

The availability engine does not use one global maximum usage number against one global minimum capacity. It partitions each occupied candidate interval at reservation/hold boundaries and CAPACITY-override boundaries, then checks each segment independently:

```text
blocking units in that segment + requested units
<= effective capacity in that segment
```

This is required so a reservation in one sub-interval cannot be incorrectly combined with a reduced-capacity override in a different sub-interval.

## Determinism proof shape

Candidate identity is a SHA-256-derived stable ID over canonical business/demand/service-time/assignment material. Output ordering is fixed by start, end, assignment resource IDs, then candidate ID. Repeating the same query against unchanged truth with a fixed observation timestamp produced an exact deep-equal result.

## Truth boundary / non-claims

G2-S2 treats persisted `ACTIVE` holds as blocking current truth. It does not infer logical expiry from wall clock; that belongs to G2-S4.

G2-S2 does not claim:

```text
reservation mutation
commit-time stale-candidate revalidation
concurrent winner/loser correctness
logical hold expiry/restart correctness
Services runtime demand creation
Appointment → Scheduler integration
multi-resource search/optimization
```

## Final-head rule

This file records the successful implementation candidate. After this evidence, receipt, design, roadmap and ledger are committed, the same G2-S2 workflow must pass again on the exact final branch head in both push and PR contexts. Only then may G2-S3 branch from that exact head. Certification never authorizes merge.
