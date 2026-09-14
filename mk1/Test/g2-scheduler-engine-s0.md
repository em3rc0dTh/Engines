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

## Executable certification

Initial executable candidate:

```text
branch   build/g2-s0-scheduler-contract-persistence
head     eb278eb5b10d6b129c3801c934570e1f787571eb
run      34883086249
result   SUCCESS
```

The successful workflow proved:

```text
TypeScript                                        PASS
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
SCHEDULER_G2_S0_CONTRACTS_PASS
SCHEDULER_G2_S0_POSTGRES_MIGRATION_OK
SCHEDULER_G2_S0_CONTRACT_PERSISTENCE_PASS
SCHEDULER_G2_S0_PRE_SCHEDULER_REGRESSION_PASS
SCHEDULER_G2_S0_CERTIFICATION_PASS
```

## Non-claims

G2-S0 does not yet certify deterministic availability generation, effective-capacity calculation, stale-candidate revalidation, atomic concurrent reservation winners/losers, logical hold expiry, Services runtime handoff, Appointment migration, or multi-resource search/optimization. Those remain G2-S1 through G2-S9 work.
