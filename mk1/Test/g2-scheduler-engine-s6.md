# G2-S6 — Services Snapshot → Immutable SchedulingDemand

## Status

**IMPLEMENTATION CANDIDATE — NOT YET CERTIFIED**

Predecessor: **G2-S5 CERTIFIED**.

G2-S6 is the first runtime proof that the certified Services revision/snapshot semantics feed Scheduler without allowing mutable catalog head changes to rewrite active scheduling truth.

## Gate claim

G2-S6 may be promoted only when executable evidence proves:

```text
Services revision N
→ frozen ServicesSelectionSnapshot N
→ deterministic SchedulingDemand N by value
→ immutable scheduler_demands persistence
→ Scheduler availability driven by N

publish Services head N+1 with materially different scheduling fields
→ persisted demand N remains byte/material stable
→ demand N still drives N scheduling semantics
→ newly materialized demand sees N+1
```

## Contract additions under proof

A schedulable Services Offering may declare an abstract `ServiceSchedulingProfile`:

```text
capacityUnits
requiredCapabilities[]
  code
  quantity
  optional resourceKinds[]
buffers.beforeMinutes
buffers.afterMinutes
```

This profile is Services-owned catalog semantics. It contains no concrete Scheduler resource ID, schedule ID, hold ID, reservation ID or provider/channel mechanics.

`durationMinutes` remains the versioned Offering field already owned by Services.

## Required executable proof

The G2-S6 probe must prove all of the following:

```text
1. create Services Service + schedulable Offering revision N
2. persist and project ServiceSchedulingProfile N
3. freeze snapshot N by value
4. materialize SchedulingDemand N with exact Service/Offering revisions
5. persist demand N into scheduler_demands
6. identical demand retry is a replay, not a duplicate
7. Scheduler availability for N resolves only resources compatible with N
8. publish Service/Offering N+1 with materially different duration/profile
9. existing scheduler_demands row N remains unchanged, including snapshot hash
10. availability using persisted N remains unchanged after N+1 publication
11. new demand materialization sees N+1 revisions/duration/profile
12. N+1 Scheduler availability resolves the N+1-compatible resource semantics
13. reusing demandId N with N+1 material fails closed with DEMAND_MATERIAL_CONFLICT
14. conflict commits no mutation to demand N
15. protected G2-S0..G2-S5 regressions remain green
16. inherited CTA/Temporal path remains green
17. RegisterNewAppointment remains outside Scheduler until G2-S7
```

## Persistence invariant

`scheduler_demands` is canonical immutable Scheduler handoff truth once materialized. It intentionally has no foreign key to mutable Services catalog heads.

Same durable demand identity rules:

```text
same demandId + same frozen material
→ replay existing demand

same demandId + different frozen material
→ fail closed
→ no overwrite
```

## Boundary invariant

Services may describe abstract scheduling requirements, but cannot select concrete Scheduler resources. Scheduler alone owns concrete free/busy, resource assignment, holds and reservations.

Provider/channel mechanics remain outside both this handoff and Scheduler core.

## Dedicated terminal markers

Expected markers:

```text
SCHEDULER_G2_S6_CONTRACTS_PASS
SCHEDULER_G2_S6_ABSTRACT_BOUNDARY_PASS
SCHEDULER_G2_S6_NO_APPOINTMENT_MIGRATION_PASS
SCHEDULER_G2_S6_PREDECESSOR_REGRESSION_PASS
SCHEDULER_G2_S6_SERVICES_HANDOFF_PASS
SCHEDULER_G2_S6_PLATFORM_REGRESSION_PASS
SCHEDULER_G2_S6_CERTIFICATION_PASS
```

## Truth boundary / non-claims

Passing G2-S6 will certify Services frozen-revision materialization into immutable Scheduler demand truth and continued Scheduler behavior from that frozen material.

It will **not** certify:

- Appointment Workflow migration to Scheduler — owned by G2-S7;
- multi-resource assignment/search — G2-S8;
- final Scheduler closure/production readiness — G2-S9;
- Integration Engine/provider execution;
- reservation cancel/complete lifecycle;
- distributed HA/scale/security readiness beyond the protected gate scope.

## Promotion rule

Do not change the machine ledger from `G2-S6 NEXT` until the dedicated candidate workflow passes. After candidate PASS, update receipt/evidence/design/roadmap/ledger and rerun the **same G2-S6 workflow on the exact final branch head** for both push and PR contexts. Only then may G2-S7 become `NEXT`.
