# ME1 — Managed Entity Resolution Brainstorming

Date: 2026-09-09

## Problem

Register Appointment currently proves Customer → Service → Offering → Slot → Appointment, while ManagedEntity is mostly an internal persistence consequence. The intended workflow requires the ManagedEntity to be resolved before the business intent continues.

Canonical ordering:

```text
CTA
→ resolve Customer
→ resolve ManagedEntity subject
→ Service / Offering / business intent
→ scheduling / execution
→ history
```

The reason is historical continuity: operational events must attach to the subject that was actually serviced.

## Not every ManagedEntity behaves like a vehicle

The canonical v3 definition already treats ManagedEntity as "that on which the service, evaluation, diagnosis, production, or tracking is performed". This includes durable assets and request-scoped subjects.

### Durable reusable subject

Examples:

```text
Gallo Autos      → vehicle
Veterinary       → pet
Technical repair → device/equipment
```

Expected UX:

```text
0 subjects → create
1 subject  → explicitly confirm/select
N subjects → choose one
```

History accumulates on the same ManagedEntity across Cases.

### Request-scoped subject

BateYLate is the key counterexample:

```text
Customer
→ new dessert request / cake concept
→ feasibility / quote / production / delivery
```

The cake request is still the operational subject, but a new interaction normally creates a new ManagedEntity instead of asking the customer to select an old cake. Historical requests remain useful for reference/repeat-order flows, but they are not the default current subject.

This prevents a vehicle-shaped model from leaking into custom-order businesses.

## Best case / worst case

### Best case

The channel already resolves Customer identity and there is one obvious durable subject.

```text
WhatsApp verified phone
→ Customer Eduardo
→ Renault Logan
→ explicit subject confirmation
→ Service
```

### Worst case

Identity is weak, Customer resolution is ambiguous, multiple ManagedEntities exist, or the vertical creates request-scoped subjects.

The system must not guess:

```text
ambiguous Customer → stop for resolution
wrong-owner ManagedEntity → reject
multiple durable subjects → explicit selection
no required subject → create
request-scoped vertical → create new by default
```

## Decision

ManagedEntity remains canonical across verticals, but its resolution behavior is configured by policy rather than hard-coded as "vehicle selection".

Policy dimensions introduced in ME1:

```text
requirement     REQUIRED | OPTIONAL | NONE
lifecycle       DURABLE_REUSABLE | REQUEST_SCOPED
selectionMode   ALWAYS_EXPLICIT | AUTO_IF_SINGLE | CREATE_NEW_DEFAULT
entity type     vehicle | dessert_request | pet | equipment | ...
label           vertical-facing label
```

Initial policy fixtures:

```text
Gallo
  REQUIRED
  DURABLE_REUSABLE
  ALWAYS_EXPLICIT
  type=vehicle

BateYLate
  REQUIRED
  REQUEST_SCOPED
  CREATE_NEW_DEFAULT
  type=dessert_request
```

## Truth boundary

ME1 is not an Agent feature. Temporal/channel UX can consume this deterministic policy now. A future Agent may phrase the questions naturally, but must not replace the durable resolution semantics.
