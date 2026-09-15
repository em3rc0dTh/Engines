# Scheduler G2-S5 Certification Evidence — 2026-09-14

## Scope

Gate: `G2-S5 — Multi-business generality`

Canonical active branch: `build/g2-scheduler`

Active PR: `#32`

This gate proves that Scheduler generality is achieved by business-scoped data and contracts, not by customer/provider/vertical runtime forks.

## Materially different business fixtures

```text
A: g2-s5-business-alpha
   resource kind BAY
   ALPHA_CAPABILITY
   Monday 08:00–12:00
   30m duration + 5/5 buffers

B: g2-s5-business-beta
   resource kind ROOM
   BETA_CAPABILITY
   Monday 07:30–15:30
   45m duration + 0/10 buffers
```

Both use the same Scheduler implementation and deliberately reuse business-scoped operation IDs.

## Executable isolation proof

```text
same resource code in A and B                         PASS
same operationId CreateResource in A and B            PASS
same operationId SetScheduleTemplate in A and B       PASS
same operationId CreateHold in A and B                PASS
same operationId ConfirmReservation in A and B        PASS
independent same-business replay                      PASS
cross-business resource read                          NOT VISIBLE
cross-business schedule→resource FK                   REJECTED
cross-business demand scope                           REJECTED
cross-business preferred resource                     NO CANDIDATE
cross-business hold release                           HOLD_NOT_FOUND
A hold does not reduce B availability                 PASS
A reservation exhausts A capacity only                PASS
B remains available after A reaches capacity          PASS
B independently holds/confirms same interval          PASS
one reservation per business                          PASS
one consumed hold per business                        PASS
fixture-specific Scheduler core branches              NONE
provider/channel mechanics in Scheduler core          NONE
Appointment migration                                 NONE
```

## Candidate runs

```text
SHA       a8cf52ee7791d42ec22c18561b093e5d676618d2
Push run  34906048077  SUCCESS
PR run    34906054870  SUCCESS
```

Both candidate runs completed all three jobs:

```text
g2-s5-contracts-boundaries
 g2-s5-postgres-multibusiness
scheduler-g2-s5-seal
```

## Candidate push artifacts

```text
scheduler-g2-s5-34906048077
id      10372965143
sha256  0ffa99ec60084c065df60b1cac2a8806020d29c3a2629ada0d41ef4907fa72b3

scheduler-g2-s5-seal-34906048077
id      10372342938
sha256  e7beb1d9cfc11406b9b2b85ce589dea12274357b039522f68d7d7441e64e2fca
```

## Candidate PR artifacts

```text
scheduler-g2-s5-34906054870
id      10372158136
sha256  c575d8dce09740383f6b11f04fa0c79a2789c129c60b321287cd750ec934226a

scheduler-g2-s5-seal-34906054870
id      10372283102
sha256  4ef463f1106b1ec4bc68049d0ce9c887ef3fba1f524aefa0b5b3e16d36c8ef99
```

## Required terminal markers

```text
SCHEDULER_G2_S5_NO_FIXTURE_BRANCH_PASS
SCHEDULER_G2_S5_GENERIC_BOUNDARY_PASS
SCHEDULER_G2_S5_NO_APPOINTMENT_MIGRATION_PASS
SCHEDULER_G2_S5_CONTRACTS_PASS
SCHEDULER_G2_S5_PREDECESSOR_REGRESSION_PASS
SCHEDULER_G2_S5_MULTIBUSINESS_PASS
SCHEDULER_G2_S5_PLATFORM_REGRESSION_PASS
SCHEDULER_G2_S5_CERTIFICATION_PASS
```

## Final-seal rule

Candidate success is necessary but not sufficient. After this evidence, the gate receipt, frozen design, roadmap, and ledger transition `G2-S5 CERTIFIED / G2-S6 NEXT` are all present, the same dedicated G2-S5 workflow must pass on the exact final branch head for both push and PR events.

Final run IDs and artifact digests are attached to PR #32 without writing another commit to the branch.

## Non-claims

G2-S5 does not certify:

```text
Services→SchedulingDemand runtime derivation
catalog-head immutability across Scheduler handoff
Appointment→Scheduler migration
multi-resource assignment/search
reservation cancel/complete lifecycle
Integration Engine readiness
Scheduler final production readiness
```
