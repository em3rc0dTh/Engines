# ME1 — Managed Entity Resolution Design

Date: 2026-09-09

## Canonical subject rule

A business operation that acts on a subject must resolve that subject before continuing.

```text
CustomerResolution
→ ManagedEntityResolution
→ BusinessIntent
```

The rule is provider-neutral and agent-neutral.

## Canonical policy

```ts
type ManagedEntityPolicy = {
  requirement: 'REQUIRED' | 'OPTIONAL' | 'NONE';
  lifecycle: 'DURABLE_REUSABLE' | 'REQUEST_SCOPED';
  selectionMode: 'ALWAYS_EXPLICIT' | 'AUTO_IF_SINGLE' | 'CREATE_NEW_DEFAULT';
  type: string;
  label: string;
};
```

### Gallo

```text
ManagedEntity = Vehicle
lifecycle = DURABLE_REUSABLE
selection = ALWAYS_EXPLICIT
```

A Customer may own many vehicles. The workflow must not silently attach a Case/Appointment to the wrong one.

### BateYLate

```text
ManagedEntity = Dessert request
lifecycle = REQUEST_SCOPED
selection = CREATE_NEW_DEFAULT
```

A prior cake/request remains historical context, but a new custom-order intent normally creates a new subject. Reorder/clone is a separate future intent and must be explicit.

## Resolution outcomes

```text
NOT_REQUIRED
CREATE_NEW
SELECT(candidates)
SELECTED(managedEntity)
```

Rules:

1. `requirement=NONE` → `NOT_REQUIRED`.
2. `REQUEST_SCOPED + CREATE_NEW_DEFAULT` → `CREATE_NEW`, even if historical compatible subjects exist.
3. Required durable subject + zero compatible subjects → `CREATE_NEW`.
4. Durable subject + one candidate + `ALWAYS_EXPLICIT` → `SELECT` with one candidate.
5. Durable subject + many candidates → `SELECT`.
6. Candidate type must match the configured ManagedEntity type.
7. Ownership must be verified by persistence before selection is accepted.

## Temporal target state extension

The next integration step adds an explicit managed-entity segment to RegisterNewAppointment:

```text
WAITING_FOR_CUSTOMER
→ RESOLVING_CUSTOMER
→ CUSTOMER_READY
→ LOADING_MANAGED_ENTITIES
→ WAITING_FOR_MANAGED_ENTITY | CREATING_MANAGED_ENTITY
→ MANAGED_ENTITY_READY
→ LOADING_SERVICES
```

Target actions:

```text
SELECT_MANAGED_ENTITY
PROVIDE_MANAGED_ENTITY
CREATE_MANAGED_ENTITY
```

No service selection may occur while a required ManagedEntity is unresolved.

## Persistence model

ManagedEntity remains the v3/v4 canonical subject:

```text
managedEntityId
businessSlug
customerId
type
displayName
summary
data
status
createdAt
updatedAt
```

The generic `data` payload is vertical-specific. Canonical code owns identity, ownership, status, and lifecycle semantics; vertical policy owns labels, type and required fields.

## History rule

History is not derived from one giant mutable ManagedEntity document.

```text
ManagedEntity
← Case
← Appointment
← Assessment
← OperationalInput
← Quote / WorkOrder
← TimelineEvent
```

The ManagedEntity identifies the subject. Historical facts remain in their source entities/events.

## Appointment truth rule

An Appointment attached to a ManagedEntity means a service was scheduled for that subject. It does not prove execution happened. Execution/outcome history is added by WorkOrder/validation layers later.
