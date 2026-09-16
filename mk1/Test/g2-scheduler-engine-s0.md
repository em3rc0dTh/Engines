# G2 Scheduler Engine — S0 Contract + Persistence Foundation

Date: 2026-09-14

## Verdict

```text
G2-S0 Contract + Persistence Foundation    ✅ CERTIFIED
G2-S1 Resource/schedule management         ⏭️ NEXT
G2-S2 Deterministic availability           OPEN
G2-S3 Atomic reservation conflict          OPEN
G2-S4 Holds + expiry/replay                OPEN
G2-S5 Multi-business generality            OPEN
G2-S6 Services snapshot integration        OPEN
G2-S7 Appointment integration              OPEN
G2-S8 Multi-resource proof/deferral        OPEN
G2-S9 Final clean Scheduler certification  OPEN
```

The active execution roadmap is aligned to this receipt: G2-S0 is closed and G2-S1 is the next Scheduler gate.

G2 is now governed by the mandatory sequential certification policy at `mk1/Test/g2-scheduler-certification-policy.md` and the machine-readable ledger at `mk1/Test/g2-scheduler-certification-ledger.json`. No later Scheduler gate may become `NEXT` until its predecessor has an independent executable certification receipt.

## Certified scope

G2-S0 freezes and persists the Scheduler foundation without claiming availability or concurrency semantics that belong to later gates.

Certified contract families:

```text
SchedulerResource
ResourceCapability
WeeklyAvailabilityWindow
ScheduleTemplate
ScheduleOverride
SchedulingDemand
QueryAvailabilityInput / AvailabilityResult
SlotCandidate / ResourceAssignmentCandidate
CreateHoldInput / SchedulerHold
ConfirmReservationInput / SchedulerReservation
SchedulerFailureCode
```

Certified persistence foundation:

```text
scheduler_resources
scheduler_resource_capabilities
scheduler_schedule_templates
scheduler_schedule_windows
scheduler_schedule_overrides
scheduler_demands
scheduler_holds
scheduler_hold_assignments
scheduler_reservations
scheduler_reservation_assignments
scheduler_commands
```

`scheduler_demands` is an explicit G2-S0 implementation decision: the immutable Services → Scheduler handoff is persisted by value and hash, with no foreign key to mutable Services catalog heads. `scheduler_commands` is the durable operation-identity/material ledger foundation for later idempotent mutation semantics.

## Frozen invariants

- Services remains authority for commercial/catalog semantics; Scheduler owns concrete resource/time allocation truth.
- `SchedulingDemand` freezes Service and Offering revisions plus duration/capability/capacity requirements.
- PostgreSQL is canonical Scheduler transactional truth.
- persisted instants are offset-aware; resource/business time zones are explicit IANA identifiers.
- `SlotCandidate` remains advisory and is deliberately not persisted as reservation truth.
- Resource kinds/capabilities are data; no vertical/provider branches are introduced.
- cross-business relational references are rejected.
- contracts/schema support multiple resource assignments without claiming the multi-resource search algorithm yet.
- Appointment is not migrated to Scheduler in G2-S0.
- every later G2 step requires its own workflow, terminal marker, evidence artifact, receipt, predecessor regression and exact-final-head rerun before the roadmap may advance.

## Executable certification

Initial executable implementation candidate:

```text
branch   build/g2-s0-scheduler-contract-persistence
head     eb278eb5b10d6b129c3801c934570e1f787571eb
run      34883086249
result   SUCCESS
```

A later exact-head certification on `4c993b1ab169f9d65263466895c47a1e2fbf254a` also passed both push and PR workflows before the sequential certification governance was added. Any later governance/documentation commit changes the branch head and therefore must pass the same G2-S0 workflow again before the new head is treated as certified. The live PR records the exact current branch-head run and artifact digests.

The successful workflow proves:

```text
TypeScript                                        PASS
Scheduler sequential certification ledger        PASS
Scheduler G2-S0 contract tests                    PASS
protected Appointment/Services/CTA regressions    PASS
provider-agnostic Scheduler boundary              PASS
no premature Appointment→Scheduler integration    PASS
SlotCandidate remains non-persisted/advisory      PASS
full migration chain                              PASS
Scheduler migration replay/reentrancy              PASS
PostgreSQL contract/persistence probe              PASS
cross-business FK isolation                       PASS
operation identity uniqueness foundation          PASS
inherited CTA→Temporal→PostgreSQL regression       PASS
aggregate G2-S0 seal                              PASS
```

Terminal markers:

```text
SCHEDULER_G2_CERTIFICATION_LEDGER_PASS
SCHEDULER_G2_S0_CONTRACTS_PASS
SCHEDULER_G2_S0_POSTGRES_MIGRATION_OK
SCHEDULER_G2_S0_CONTRACT_PERSISTENCE_PASS
SCHEDULER_G2_S0_PRE_SCHEDULER_REGRESSION_PASS
SCHEDULER_G2_S0_CERTIFICATION_PASS
```

## Advancement rule

G2-S1 may remain `NEXT`, but G2-S2 must remain `OPEN` until G2-S1 has:

```text
dedicated workflow                PASS
G2-S0 regression                  PASS
terminal certification marker     PRESENT
evidence artifact + digest        PRESENT
Test receipt + non-claims         PRESENT
ledger update                     VALID
exact final branch head           RE-CERTIFIED
```

The same rule applies recursively through G2-S9.

## Non-claims

G2-S0 does not yet certify deterministic availability generation, effective-capacity calculation, stale-candidate revalidation, atomic concurrent reservation winners/losers, logical hold expiry, Services runtime handoff, Appointment migration, or multi-resource search/optimization. Those remain G2-S1 through G2-S9 work.
