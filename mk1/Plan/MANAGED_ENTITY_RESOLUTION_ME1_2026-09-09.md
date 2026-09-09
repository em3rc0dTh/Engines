# ME1 — Managed Entity Resolution Plan

Date: 2026-09-09

## Goal

Make ManagedEntity resolution an explicit reusable stage between Customer resolution and business intent execution.

## Delivery sequence

### ME1.0 — Policy contract

- Define lifecycle / requirement / selection policy.
- Prove Gallo durable-reusable behavior.
- Prove BateYLate request-scoped behavior.

### ME1.1 — Persistence read/write port

- List ManagedEntities by `businessSlug + customerId + type`.
- Read one by id with ownership check.
- Create one idempotently from canonical draft material.
- Reject cross-customer or cross-business selection.

### ME1.2 — RegisterNewAppointment workflow state

Add durable phases:

```text
LOADING_MANAGED_ENTITIES
WAITING_FOR_MANAGED_ENTITY
CREATING_MANAGED_ENTITY
MANAGED_ENTITY_READY
```

Add durable state:

```text
managedEntity.policy
managedEntity.candidates[]
managedEntity.selected
managedEntity.draft
```

### ME1.3 — Operations

```text
SELECT_MANAGED_ENTITY
PROVIDE_MANAGED_ENTITY
CREATE_MANAGED_ENTITY
```

Required ManagedEntity must be resolved before `SELECT_SERVICE` becomes available.

### ME1.4 — Channel projection

Provider adapters do not learn vertical business logic. They only render the workflow's requested action.

WebChat first physical proof:

```text
Customer
→ existing vehicles loaded
→ choose vehicle
→ Car Wash
```

Creation branch:

```text
Customer
→ no vehicles
→ request configured vehicle fields
→ create
→ continue to Service
```

BateYLate deterministic fixture:

```text
Customer with historical dessert_request
→ new custom-order intent
→ CREATE_NEW_DEFAULT
→ historical request is not silently selected
```

### ME1.5 — History invariants

Persist/verify same `managedEntityId` on the operational graph where applicable:

```text
Case
Appointment
ResourceReservation if contract carries subject identity
TimelineEvent
```

Later v4 OperationalInput/Assessment/WorkOrder layers must preserve the same subject identity.

## Required tests

1. Gallo / zero vehicles → CREATE_NEW.
2. Gallo / one vehicle → explicit SELECT, no silent auto-selection.
3. Gallo / many vehicles → SELECT all compatible candidates.
4. Wrong type → not offered.
5. Wrong owner → rejected at persistence boundary.
6. Replay selection/create input → no duplicate ManagedEntity.
7. BateYLate historical request → CREATE_NEW_DEFAULT.
8. Required subject unresolved → service selection rejected.
9. Selected subject id flows into Case + Appointment.
10. Existing Register Appointment P1/P2/P3 regressions remain green.

## Gates

```text
ME-G0 policy contract
ME-G1 persistence
ME-G2 Temporal state machine
ME-G3 WebChat selection
ME-G4 WebChat creation
ME-G5 cross-vertical BateYLate fixture
ME-G6 replay/ownership/invariants
ME-G7 provider regression
ME-SEAL
```

## Non-goals

- No Agent / LLM behavior.
- No MCP.
- No v3 WorkTeam scheduling changes yet.
- No v4 OperationalInput implementation yet.
- No generic form-builder implementation; custom fields are consumed from vertical policy/configuration when that layer is wired.
