# G2-S6 — Services Snapshot → Immutable SchedulingDemand

## Status

**✅ CERTIFIED — G2-S7 NEXT**

Predecessor: **G2-S5 CERTIFIED**.

G2-S6 proves that certified Services revision/snapshot semantics feed Scheduler without allowing later mutable catalog-head changes to rewrite an already-materialized scheduling demand.

The implementation candidate passed independently in push and PR contexts. After this receipt/evidence/design/roadmap/ledger state is complete, the same dedicated workflow is rerun on the exact branch head. Final exact-head run IDs and artifact digests are recorded on PR #32 rather than committed after the seal, because any post-seal branch commit would invalidate the exact-head claim.

## Implementation candidate evidence

Candidate head:

```text
9d6af52e5749e83469e7d4aca89775753ea2f4e5
```

Dedicated candidate runs:

```text
Push run  34908156644 — SUCCESS
PR run    34908161495 — SUCCESS
```

Both candidate runs completed:

```text
g2-s6-contracts-boundaries       PASS
g2-s6-postgres-services-handoff  PASS
scheduler-g2-s6-seal             PASS
```

### Candidate push artifacts

```text
scheduler-g2-s6-34908156644
id      10373038529
sha256  ac19a18f05110e4ddc0ac383f35e2d623c2344e2bda3372d9d736ccb1aa865f7

scheduler-g2-s6-seal-34908156644
id      10373098349
sha256  31ee2cc53af62f5175f4b7c82fe0ab2897f8c36af01a6dc8eadb02624f3b2da0
```

### Candidate PR artifacts

```text
scheduler-g2-s6-34908161495
id      10373461589
sha256  2b82a0ebd9635f161f11b1c887899913133cc13aafc678c2ce3610c946019da1

scheduler-g2-s6-seal-34908161495
id      10373631264
sha256  1b2b7e2c4cb37f2d83a698026142654399b840ddd0aad6e1c9612fa711a4d0fd
```

## Certified gate claim

```text
Services revision N
→ frozen ServicesSelectionSnapshot N
→ deterministic SchedulingDemand N by value
→ immutable scheduler_demands persistence
→ Scheduler availability driven from persisted N

publish Services head N+1 with materially different scheduling fields
→ persisted demand N remains unchanged
→ demand N still drives N scheduling semantics
→ newly materialized demand sees N+1
```

## Services scheduling profile

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

This profile is Services-owned catalog semantics. It contains no concrete Scheduler resource ID, schedule ID, hold ID, reservation ID or provider/channel mechanics. `durationMinutes` remains the versioned Offering field already owned by Services.

The profile is persisted as `service_products.scheduling_profile` by migration `010_services_scheduler_profile.sql`; existing non-schedulable Offerings may keep it `NULL`.

## Runtime handoff

Canonical implementation:

```text
mk1/runtime/src/scheduler/services-demand-handoff.ts
```

The materializer consumes an already-frozen `ServicesSelectionSnapshot`; it does not query mutable Services catalog head. It validates Service/Offering scope, parent identity, lifecycle and scheduling profile, then copies exact revisioned scheduling material into `SchedulingDemand`.

Persistence rules:

```text
same demandId + same frozen material
→ exact durable replay
→ same snapshot hash
→ no duplicate row

same demandId + different frozen material
→ DEMAND_MATERIAL_CONFLICT
→ transaction rolls back
→ original demand remains unchanged
```

`scheduler_demands` remains canonical immutable Scheduler handoff truth and intentionally has no foreign key to mutable Services catalog heads.

## Executable N → N+1 proof

The PostgreSQL proof uses materially different scheduling semantics:

```text
revision N
  Offering duration       30m
  capability              G2S6_CAP_N
  resource kind           BAY
  buffers                 5 / 5

revision N+1
  Offering duration       60m
  capability              G2S6_CAP_N1
  resource kind           ROOM
  buffers                 0 / 15
```

Certified assertions:

```text
1. Services Service + Offering revision N persist and project correctly.
2. ServiceSchedulingProfile N round-trips from PostgreSQL.
3. snapshot N is captured by value.
4. SchedulingDemand N carries exact Service/Offering revisions and scheduling material.
5. demand N persists in scheduler_demands with snapshot_hash.
6. identical demand N persistence replays without duplication.
7. Scheduler reloads persisted demand N and resolves only the N-compatible BAY resource and 30m semantics.
8. Services advances to materially different Service/Offering N+1.
9. persisted demand N and its snapshot_hash remain unchanged.
10. availability from persisted demand N remains unchanged after N+1 publication.
11. a new demand from the current Services head sees N+1 revisions and scheduling material.
12. Scheduler reloads demand N+1 and resolves only the N+1-compatible ROOM resource and 60m semantics.
13. reusing demandId N with N+1 material returns DEMAND_MATERIAL_CONFLICT.
14. that conflict commits no mutation to demand N.
15. G2-S0..G2-S5 predecessor probes remain green.
16. inherited CTA/Temporal orchestration remains green.
17. RegisterNewAppointment remains outside Scheduler.
```

## Dedicated terminal markers

```text
SCHEDULER_G2_S6_CONTRACTS_PASS
SCHEDULER_G2_S6_ABSTRACT_BOUNDARY_PASS
SCHEDULER_G2_S6_GENERIC_BOUNDARY_PASS
SCHEDULER_G2_S6_NO_APPOINTMENT_MIGRATION_PASS
SCHEDULER_G2_S6_PREDECESSOR_REGRESSION_PASS
SCHEDULER_G2_S6_SERVICES_HANDOFF_PASS
SCHEDULER_G2_S6_PLATFORM_REGRESSION_PASS
SCHEDULER_G2_S6_CERTIFICATION_PASS
```

## Exact-final-head evidence policy

Final same-workflow push/PR evidence is attached to PR #32 after the documentation-complete head passes. The branch is intentionally not edited merely to copy those final run IDs into this receipt; doing so would create a new unsealed head.

## Truth boundary / non-claims

G2-S6 certifies the Services frozen-revision → immutable Scheduler demand boundary and continued Scheduler behavior from persisted frozen material.

It does **not** certify:

- Appointment Workflow migration to Scheduler — owned by G2-S7;
- multi-resource assignment/search — G2-S8;
- final Scheduler closure/production readiness — G2-S9;
- Integration Engine/provider execution;
- reservation cancel/complete lifecycle;
- distributed HA/scale/security readiness beyond the protected gate scope.

Certification does not authorize merge. PR #32 remains the canonical draft/unmerged Scheduler track.
