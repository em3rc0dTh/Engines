# G2 Scheduler Engine — S7 Appointment Orchestration

## Verdict

**✅ CERTIFIED**

G2-S7 migrates `RegisterNewAppointment` through the certified Services → Scheduler boundary while preserving Temporal as orchestration authority and Scheduler as concrete capacity authority.

```text
G2-S0  ✅ CERTIFIED
G2-S1  ✅ CERTIFIED
G2-S2  ✅ CERTIFIED
G2-S3  ✅ CERTIFIED
G2-S4  ✅ CERTIFIED
G2-S5  ✅ CERTIFIED
G2-S6  ✅ CERTIFIED
G2-S7  ✅ CERTIFIED
G2-S8  ⏭️ NEXT
G2-S9  OPEN
```

The machine ledger transition in this commit is intentionally followed by a same-gate exact-final-head rerun. Candidate evidence below proves the implementation before the documentation seal; final exact-head run IDs and artifact digests are recorded on PR #32 without mutating the sealed branch head.

## Certified authority chain

```text
canonical Services selection
→ freeze exact Service/Offering revision
→ materialize immutable SchedulingDemand by value
→ persist scheduler_demands + snapshot_hash
→ Scheduler QueryAvailability
→ advisory SlotCandidate
→ user explicitly requests Finalize
→ Scheduler ConfirmReservation
→ commit-time capacity revalidation
→ Appointment persists scheduler_reservation_id
→ CTA/domain projection reaches COMPLETED
```

Authority remains explicit:

```text
Services   = catalog/commercial + abstract scheduling semantics
Scheduler  = concrete time/resource feasibility and allocation
Temporal   = durable orchestration authority
Appointment= domain/conversation projection consuming Scheduler truth
PostgreSQL = transactional operational truth
CTA/channel/provider mechanics remain outside Scheduler core
```

## Frozen selection invariant

The exact schedulable Services projection shown to a durable Appointment workflow is frozen before selection. The Scheduler consumes the resulting immutable `SchedulingDemand`; it does not re-read mutable Services head while executing that demand.

A later Services revision therefore cannot rewrite the active Appointment's scheduling semantics.

## Availability and finalization invariant

Availability remains advisory:

```text
availability shown != reservation persisted
```

`Finalize` is the reservation boundary. `confirmReservationAtomic(...)` revalidates current Scheduler truth under the already-certified G2-S3 resource-capacity serialization before a durable reservation is created.

If capacity disappears after a slot was shown, the Appointment flow receives a typed scheduling conflict, refreshes availability, and returns the user to slot selection rather than persisting stale capacity.

## Persistence invariant

A successful G2-S7 Appointment stores canonical Scheduler allocation identity:

```text
appointments.scheduler_reservation_id → scheduler_reservations.reservation_id
```

For the migrated path:

```text
Scheduler reservation       PRESENT
Scheduler assignment        PRESENT
Appointment link            PRESENT
legacy ResourceReservation  ZERO shadow write
```

The current certified Appointment slice is intentionally one concrete Scheduler resource. Generalized multi-resource search/assignment remains G2-S8.

## Replay and retry invariant

Scheduler command identity is deterministic for Appointment finalization:

```text
appointment-finalize:<workflowId>
```

Same durable finalization material replays the existing successful `ConfirmReservation` result instead of creating another reservation.

```text
Workflow / Activity retry
→ same Scheduler operation identity
→ same durable reservation
→ no duplicate reservation
```

## Exhausted-retry compensation invariant

A real gap was found during G2-S7 certification: Scheduler confirmation commits before the downstream Appointment domain graph is persisted. A persistent downstream failure could therefore have left capacity in `RESERVED` state without a corresponding Appointment.

G2-S7 now certifies a bounded Temporal saga compensation:

```text
Scheduler confirmation commits
→ Appointment persistence fails
→ ordinary Temporal Activity retries reuse the same durable Scheduler result
→ retry budget remains available for recovery

if the configured Activity retry budget is exhausted
→ acquire business+operation lock
→ resolve immutable ConfirmReservation command result
→ acquire assigned resource-capacity lock(s)
→ lock Scheduler reservation
→ verify no Appointment references that reservation
→ RESERVED → CANCELLED
→ reservation stops blocking availability
→ immutable Scheduler command ledger remains evidence
→ workflow/CTA failure projection reaches FAILED
```

Compensation is deliberately executed only on the final configured Activity attempt. Earlier attempts do not cancel the durable reservation because the next Temporal retry may successfully finish Appointment persistence.

## Candidate certification evidence

Implementation/candidate head:

```text
2271f002a809ed03f64bd5cd4c51ad007251eaeb
```

Dedicated candidate runs:

```text
Push run  34988870429 — SUCCESS
PR run    34988874452 — SUCCESS
```

Both runs passed:

```text
g2-s7-contracts-boundaries            PASS
g2-s7-postgres-temporal-appointment   PASS
scheduler-g2-s7-seal                  PASS
```

Candidate push artifacts:

```text
scheduler-g2-s7-34988870429
id      10404294659
sha256  88c414a8b61ac574886d739b42879135605a6c85f2e512bdf04107a08a53a21a

scheduler-g2-s7-seal-34988870429
id      10404399568
sha256  2f8d652e4281e3709efec60d57e97fbd63158e88f71bef48b91230281f99f6d6
```

Candidate PR artifacts:

```text
scheduler-g2-s7-34988874452
id      10405255971
sha256  577d648f2c5831c521631da37003c450af7654cd763152ada61149a8e5b2d0fe

scheduler-g2-s7-seal-34988874452
id      10405051806
sha256  17ec25916a50440acc32fd62047bcce283ff2925e9b95e174a2d9a4ddaed65d0
```

## Protected regressions

The G2-S7 gate re-certifies the complete protected predecessor path before the Appointment-specific proof:

```text
G2-S0 contract + persistence
G2-S1 resource/schedule management
G2-S2 deterministic availability
G2-S3 atomic reservation/concurrency conflict
G2-S4 hold lifecycle
G2-S5 multi-business isolation
G2-S6 Services frozen-demand handoff
Appointment UX + atomic slot-race behavior
Services Appointment N→N+1 snapshot behavior
CTA/channel orchestration
```

Historical S0/S3/S4/S5/S6 CI guards were also made forward-compatible: they now protect their durable producer invariants and prohibit backward Appointment coupling into Scheduler core, rather than permanently forbidding the legitimate G2-S7 consumer integration.

## Terminal markers

The dedicated workflow emits and/or verifies:

```text
SCHEDULER_G2_S7_CONTRACTS_PASS
SCHEDULER_G2_S7_AUTHORITY_BOUNDARY_PASS
SCHEDULER_G2_S7_GENERIC_BOUNDARY_PASS
SCHEDULER_G2_S7_ONE_RESOURCE_TRUTH_BOUNDARY_PASS
SCHEDULER_G2_S7_PREDECESSOR_REGRESSION_PASS
SCHEDULER_G2_S7_APPOINTMENT_SCHEDULER_LINK_PASS
SCHEDULER_G2_S7_FROZEN_SELECTION_PASS
SCHEDULER_G2_S7_REPLAY_PASS
SCHEDULER_G2_S7_APPOINTMENT_ORCHESTRATION_PASS
SCHEDULER_G2_S7_PLATFORM_REGRESSION_PASS
SCHEDULER_G2_S7_CERTIFICATION_PASS
```

## Truth boundary / non-claims

G2-S7 does **not** certify:

```text
generalized multi-resource search/assignment/optimization   → G2-S8
broad reservation cancellation/completion lifecycle        → not inherited from S7 compensation
final Scheduler closure / production readiness             → G2-S9
Integration Engine provider behavior                        → separate track
Agent / MCP intelligence layer                              → later
```

The `RESERVED → CANCELLED` path certified here is narrowly scoped to recovery from exhausted Appointment finalization retries when no Appointment references the reservation. It is not a generalized public Scheduler cancellation command.

## Certification boundary

This receipt advances the machine ledger to:

```text
G2-S7 CERTIFIED
G2-S8 NEXT
```

The certification is not a merge authorization. PR #32 remains draft/unmerged, and all continued Scheduler work stays on the canonical `build/g2-scheduler` branch.
