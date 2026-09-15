# G2-S7 Scheduler Appointment Orchestration — Certification Evidence

Date: 2026-09-15

## Scope

This evidence records the G2-S7 implementation/candidate proof on the single canonical Scheduler branch:

```text
branch  build/g2-scheduler
PR      #32 (draft / unmerged)
base    feature/pre-scheduler-node-edge-certification
```

Historical Scheduler PRs #29/#30/#31 remain closed/unmerged as preserved gate evidence; G2-S3 onward continues on the canonical branch.

## Candidate head

```text
2271f002a809ed03f64bd5cd4c51ad007251eaeb
```

This head includes the Scheduler-backed Appointment migration, exhausted-retry compensation, forward-compatible historical gate guards, and a strengthened G2-S7 workflow that proves CTA/channel behavior on the migrated path.

## Candidate CI

```text
Push run  34988870429 — SUCCESS
PR run    34988874452 — SUCCESS
```

Both candidate runs completed all three dedicated G2-S7 jobs successfully:

```text
g2-s7-contracts-boundaries
  PASS

g2-s7-postgres-temporal-appointment
  PASS

scheduler-g2-s7-seal
  PASS
```

## Candidate artifacts

Push:

```text
scheduler-g2-s7-34988870429
id      10404294659
sha256  88c414a8b61ac574886d739b42879135605a6c85f2e512bdf04107a08a53a21a

scheduler-g2-s7-seal-34988870429
id      10404399568
sha256  2f8d652e4281e3709efec60d57e97fbd63158e88f71bef48b91230281f99f6d6
```

Pull request:

```text
scheduler-g2-s7-34988874452
id      10405255971
sha256  577d648f2c5831c521631da37003c450af7654cd763152ada61149a8e5b2d0fe

scheduler-g2-s7-seal-34988874452
id      10405051806
sha256  17ec25916a50440acc32fd62047bcce283ff2925e9b95e174a2d9a4ddaed65d0
```

## Proven orchestration path

```text
Services exact selection revision
→ frozen SchedulingDemand
→ immutable scheduler_demands persistence
→ deterministic Scheduler availability
→ advisory SlotCandidate
→ explicit Appointment Finalize
→ confirmReservationAtomic
→ scheduler_reservations + assignment + command ledger
→ appointments.scheduler_reservation_id
→ CTA/domain terminal projection
```

The migrated path writes no legacy `ResourceReservation` shadow allocation.

## Proven replay

The G2-S7 probe proves the stable operation identity:

```text
appointment-finalize:<workflowId>
```

Retry/replay with identical durable material resolves to the same Scheduler reservation and does not create a second reservation or assignment.

## Proven failure recovery

Certification intentionally injected downstream Appointment persistence failure after Scheduler confirmation. The resulting path proves:

```text
normal Temporal Activity retry
→ keeps confirmed Scheduler reservation available for recovery
→ same durable command/result is replayed

final configured Activity attempt still fails
→ Appointment S7 compensation executes
→ locks operation + assigned capacity
→ verifies no Appointment references reservation
→ Scheduler reservation RESERVED → CANCELLED
→ no stale capacity remains blocking
→ immutable ConfirmReservation command evidence remains
→ CTA/Workflow projects FAILED
```

This compensation is a bounded Appointment orchestration recovery mechanism, not a generalized Scheduler cancellation lifecycle claim.

## Protected predecessor proof

The dedicated G2-S7 PostgreSQL/Temporal job re-ran:

```text
G2-S0 persistence
G2-S1 management
G2-S2 availability
G2-S3 atomic reservation
G2-S4 holds
G2-S5 multi-business
G2-S6 frozen Services demand
```

It additionally re-ran the inherited Appointment slot-race proof, Services Appointment N→N+1 proof, Scheduler-backed Appointment persistence/replay proof, and CTA/channel orchestration including compensation.

## Forward-compatible historical gates

G2-S0, S3, S4, S5 and S6 workflows previously contained temporary guards stating that Appointment could not consume Scheduler. Those guards correctly served their original pre-G2-S7 gates but became obsolete once G2-S7 was authorized.

They were repaired to protect the durable invariant instead:

```text
later Appointment may consume Scheduler
but earlier Scheduler producer layers may not import/couple to Appointment-specific orchestration
```

No previously certified Scheduler algorithmic invariant was weakened.

## Candidate markers

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

## Final-head rule

The candidate proof is sufficient to write the receipt and advance the machine ledger, but it is not the final exact-head seal because this evidence/receipt/ledger/design/roadmap documentation changes the branch SHA.

After documentation completion, the **same G2-S7 workflow must run again from zero on the exact final branch head for both push and pull-request events**. Those final run IDs and artifact digests are recorded on PR #32 so the sealed head is not mutated merely to copy CI metadata into itself.

## Truth boundary

Not claimed by G2-S7:

```text
generalized multi-resource assignment/search    G2-S8
final Scheduler clean closure                   G2-S9
general reservation cancel/complete lifecycle   not certified here
Integration Engine                              separate track
Agent/MCP intelligence                          later
```

PR #32 remains intentionally draft and unmerged. Certification never implies merge authorization.
