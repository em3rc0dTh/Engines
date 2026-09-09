# Managed Entity Resolution Core

Date: 2026-09-09
Status: design baseline for implementation
Branch: `feature/managed-entity-resolution-core`

## 1. Problem

The current Register Appointment PoC creates a synthetic `CUSTOMER_SUBJECT/default` ManagedEntity during final booking. That proves the persistence graph but it is not the canonical business behavior.

A ManagedEntity is the subject on which a business performs service, assessment, diagnosis, production or longitudinal tracking. The subject is vertical-specific and must not be hard-coded as a vehicle.

The canonical interaction seam is therefore:

```text
CTA / provider identity
  -> resolve Customer
  -> resolve ManagedEntity subject according to BusinessProfile policy
  -> execute business intent
```

For Register Appointment:

```text
Customer
  -> ManagedEntity subject
  -> Service
  -> Offering
  -> Date / Capacity
  -> Appointment
```

## 2. Critical distinction: durable subject vs Case intent

A ManagedEntity is justified when the business needs an independently identifiable subject whose state/history can be referenced across operational records.

A Case remains the operational root for one customer intent.

Do not force a fake ManagedEntity when the Case itself is the only meaningful subject.

## 3. Policy modes

### REQUIRED_REUSABLE

The subject can survive across Cases and is expected to be selected/reused.

Examples:
- vehicle in Gallo/Turagua;
- pet in veterinary;
- device/server in IT service;
- property/unit in property service.

Resolution:

```text
0 active candidates -> create
1..N candidates      -> select/confirm according to policy
explicit valid id    -> select
```

### REQUIRED_CASE_SCOPED

A subject is useful for production/evidence/history inside and after a Case, but a new customer intent normally creates a new subject rather than asking the user to choose from previous subjects.

Primary example: BateYLate custom dessert request.

The model can retain:
- occasion;
- servings;
- flavor/style;
- restrictions;
- reference attachments;
- requested delivery date;
- later Assessment/Quote/WorkOrder history.

Old dessert requests are not presented as normal selectable subjects for a new order unless an explicit future "repeat/reorder" intent references one.

### NOT_APPLICABLE

No separate managed subject is useful. The Customer + Case are sufficient.

A workflow still executes the same subject-resolution capability, but it returns `NOT_APPLICABLE` instead of manufacturing a placeholder entity.

## 4. Best-case and worst-case checks

### Best case — Gallo vehicle

```text
verified phone -> existing Customer Eduardo
-> vehicles [Renault Logan, Toyota Yaris]
-> ask which vehicle
-> Renault Logan selected
-> Car Wash / Executive Clean
-> Appointment
-> future WorkOrder / outcome records reference the same ManagedEntity
```

This creates a longitudinal vehicle history without conflating Customer history with vehicle history.

### Best case — BateYLate custom order

```text
existing Customer Amy
-> policy REQUIRED_CASE_SCOPED / dessert_request
-> create new subject "Torta cumpleaños mamá"
-> collect request-specific fields
-> feasibility / Quote / production WorkOrder
```

The new order is not forced to choose an unrelated older cake.

### Worst case — forcing every business into reusable selection

If every Customer is required to select an old ManagedEntity, BateYLate becomes polluted with choices such as old birthday cakes and wedding cakes for every new order. The user is asked an operationally meaningless question and the model duplicates Case semantics.

### Worst case — no ManagedEntity anywhere

If everything is attached only to Customer/Case, Gallo cannot answer "what has happened to this specific vehicle?" when one customer owns multiple vehicles. Veterinary and asset-service verticals fail similarly.

## 5. Decision

`ManagedEntity` stays canonical, but its participation is policy-driven.

The universal rule is not "every CTA must create a ManagedEntity".
The universal rule is:

```text
Every business workflow that may act on a managed subject must pass through ManagedEntityResolution.
The BusinessProfile/VerticalAdapter decides whether the outcome is reusable selection, case-scoped creation, or not applicable.
```

This preserves a single orchestration seam without inventing meaningless records.

## 6. Relationship direction

The current `managed_entities.customer_id NOT NULL` shape is a compatibility shortcut, not the final relationship model.

Target seam:

```text
ManagedEntity
  <- ManagedEntityRelationship -> Customer | BusinessProfile | future Party
```

Initial roles:
- OWNER
- USER
- REQUESTER
- CUSTODIAN

This permits customer-owned vehicles/pets and business-owned fleet/assets without changing ManagedEntity identity.

## 7. Runtime contract

The first implementation introduces deterministic policy and resolution types before changing provider UX.

Resolution states:
- `NOT_APPLICABLE`
- `NEEDS_CREATION`
- `NEEDS_SELECTION`
- `SELECTED`
- `INVALID_SELECTION`

A case-scoped policy never silently offers old candidates for a new intent.
A reusable policy never silently creates a default placeholder.

## 8. Register Appointment integration target

The current synthetic creation in `bookAppointment()`:

```text
CUSTOMER_SUBJECT / default
```

must be removed.

Final booking must receive an already-resolved `managedEntityId` when policy requires one.

Temporal target phases:

```text
WAITING_FOR_CUSTOMER
RESOLVING_CUSTOMER
CUSTOMER_READY
RESOLVING_MANAGED_ENTITY
WAITING_FOR_MANAGED_ENTITY
CREATING_MANAGED_ENTITY
MANAGED_ENTITY_READY
LOADING_SERVICES
...
```

Provider-neutral actions:
- `SELECT_MANAGED_ENTITY`
- `PROVIDE_MANAGED_ENTITY`
- `CREATE_MANAGED_ENTITY`

## 9. Vertical examples

| Vertical | Policy | ManagedEntity | Reuse behavior |
|---|---|---|---|
| Gallo / vehicle service | REQUIRED_REUSABLE | vehicle | select existing or create |
| Veterinary | REQUIRED_REUSABLE | pet | select existing or create |
| IT field service | REQUIRED_REUSABLE | device/server | select existing or create |
| BateYLate custom orders | REQUIRED_CASE_SCOPED | dessert_request | create per new order; explicit reorder may reference old |
| Simple customer-only consultation | NOT_APPLICABLE | none | Customer + Case only |

## 10. Test gates

ME0 contract gate:
- zero/one/many reusable candidates;
- explicit selection;
- invalid selection;
- case-scoped never auto-selects old entities;
- not-applicable never creates a placeholder.

ME1 persistence gate:
- list active subjects by relationship;
- create idempotent subject;
- no cross-business selection;
- inactive subject cannot be selected.

ME2 Temporal gate:
- Customer -> ManagedEntity -> Service ordering is enforced;
- finalization without required ManagedEntity is rejected;
- selected ManagedEntity flows into Case, Appointment and ResourceReservation.

ME3 channel gate:
- WebChat physical flow;
- Telegram physical flow;
- WhatsApp/Kapso physical flow;
- provider identity may pre-resolve Customer but never bypasses required ManagedEntity resolution.

## Truth boundary

This design does not claim that all businesses require a physical asset, that BateYLate must reuse prior dessert requests, or that the future Agent/MSP identity layer is implemented. It defines the canonical seam Temporal and provider adapters can use now.
