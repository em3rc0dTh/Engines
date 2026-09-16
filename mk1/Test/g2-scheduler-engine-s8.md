# Scheduler G2-S8 — Multi-Resource Atomicity

Status: **CANDIDATE — NOT CERTIFIED**

G2-S8 extends the certified Scheduler without changing the G2-S0..G2-S7 authority boundaries.

## Target

Prove that one SchedulingDemand can require more than one concrete resource simultaneously and that confirmation is atomic across the whole resource set.

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

## G2-S8 semantics

The minimal certified model is intentionally narrow:

- one distinct concrete resource is selected for each required capability demand;
- all resources in a candidate share the canonical query timezone;
- each assignment consumes `SchedulingDemand.capacityUnits` on that resource;
- candidate assignments are ordered deterministically by `resourceId`;
- confirmation locks every selected resource in the same deterministic order;
- the reservation row, every assignment row, and the command ledger commit in one PostgreSQL transaction;
- a concurrent loser leaves no reservation, no assignment, and no command result;
- identical operation/material replays the same reservation.

## Explicit non-claims

G2-S8 does not certify:

- multi-resource hold creation/consumption; G2-S4 holds remain one-resource;
- optimization, scoring, best-fit, routing, solver behavior, or preference ranking;
- heterogeneous candidate display timezones;
- generalized staff skills, shift policy, travel time, or sequence optimization;
- a new Appointment multi-resource product path. G2-S7 Appointment remains a protected predecessor regression.

## Candidate markers

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

This receipt must not be promoted to `✅ CERTIFIED` until the dedicated G2-S8 workflow passes on a candidate head, documentation and the machine ledger are updated, and the same workflow passes again on the exact final branch head for both push and pull-request events.
