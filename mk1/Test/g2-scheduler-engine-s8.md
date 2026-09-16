# Scheduler G2-S8 — Multi-Resource Atomicity

Status: **✅ CERTIFIED — G2-S9 NEXT**

G2-S8 extends the certified Scheduler without changing the G2-S0..G2-S7 authority boundaries. This receipt is promoted from the successful candidate proof so the sequential ledger can advance; canonical certification still requires the same G2-S8 workflow to pass again on the exact documentation-complete branch head for both push and pull-request events.

## Target

Prove that one `SchedulingDemand` can require more than one concrete resource simultaneously and that confirmation is atomic across the whole selected resource set.

Canonical fixture:

```text
SchedulingDemand
  ├── BAY_ACCESS     → one concrete BAY
  └── TECHNICIAN     → one concrete TECHNICIAN
            ↓
     joint availability
            ↓
 deterministic resource lock order
            ↓
 atomic ConfirmReservation
            ↓
 scheduler_reservations
 + N scheduler_reservation_assignments
```

## Certified semantics

The bounded G2-S8 model is:

- one distinct concrete resource is selected for each required capability demand;
- all resources in a candidate share the canonical query timezone;
- each assignment consumes `SchedulingDemand.capacityUnits` on that resource;
- candidate assignments are ordered deterministically by `resourceId`;
- confirmation locks every selected resource in the same deterministic order;
- a new confirmation revalidates the complete joint candidate at commit time;
- the reservation row, every assignment row and the command result commit in one PostgreSQL transaction;
- a concurrent loser leaves no reservation, assignment or command effect;
- identical operation/material resolves the durable command first and replays the same reservation without requiring the already-consumed candidate to remain available.

The existing one-resource Scheduler path remains intact. G2-S8 adds a dedicated multi-resource path instead of weakening G2-S2/G2-S3 behavior.

## Candidate proof

Successful candidate head:

```text
e68df10cd2d57fa451df60e52f467804318b449f
```

Dedicated candidate runs:

```text
Push  35120323440  SUCCESS
PR    35120326801  SUCCESS
```

Both runs completed:

```text
g2-s8-contracts-boundaries       PASS
g2-s8-postgres-multi-resource    PASS
scheduler-g2-s8-seal             PASS
```

Candidate artifact IDs and SHA-256 digests are preserved in `mk1/Build/evidence/scheduler-g2-s8-certification-2026-09-16.md`.

## Hard-gate findings

The first candidate correctly failed TypeScript because `exactOptionalPropertyTypes` rejected explicit `limit: undefined`. After that repair, the executable gate found a real replay-order defect: a successful reservation made its own candidate unavailable, so availability could not be checked before durable operation replay. The implementation now resolves an already-successful business+operation command first and performs current availability/revalidation only for a genuinely new operation.

These failures are retained as evidence that G2-S8 advanced through the gate rather than around it.

## Explicit non-claims

G2-S8 does not certify:

- multi-resource hold creation or consumption; G2-S4 holds remain one-resource;
- optimization, scoring, best-fit, routing, solver behavior or preference ranking;
- heterogeneous candidate display timezones;
- generalized staff skill/shift/travel/sequence optimization;
- Appointment consuming a multi-resource demand; G2-S7 remains a one-resource protected predecessor;
- generalized reservation cancellation/completion lifecycle;
- production readiness or final Scheduler closure.

## Terminal markers

```text
SCHEDULER_G2_S8_CONTRACTS_PASS
SCHEDULER_G2_S8_MULTI_RESOURCE_BOUNDARY_PASS
SCHEDULER_G2_S8_GENERIC_BOUNDARY_PASS
SCHEDULER_G2_S8_HOLD_NONCLAIM_PASS
SCHEDULER_G2_S8_JOINT_AVAILABILITY_PASS
SCHEDULER_G2_S8_ATOMIC_MULTI_RESOURCE_PASS
SCHEDULER_G2_S8_REPLAY_PASS
SCHEDULER_G2_S8_ALL_OR_NOTHING_CONCURRENCY_PASS
SCHEDULER_G2_S8_HOLD_BOUNDARY_PASS
SCHEDULER_G2_S8_MULTI_RESOURCE_PASS
SCHEDULER_G2_S8_PREDECESSOR_REGRESSION_PASS
SCHEDULER_G2_S8_PLATFORM_REGRESSION_PASS
SCHEDULER_G2_S8_CERTIFICATION_PASS
```

## Final exact-head rule

After this receipt, the machine ledger, design and roadmap are documentation-complete, the **same G2-S8 workflow must pass from zero on the exact final `build/g2-scheduler` head for both push and PR events**. Only that exact-head seal makes G2-S8 canonically complete and permits execution of G2-S9.

Certification never authorizes merge. PR #32 remains draft/unmerged.
