# ME1 — Managed Entity Resolution Design

Date: 2026-09-09  
Updated: 2026-09-10

## Canonical subject rule

A business operation that acts on a subject must resolve that subject before continuing.

```text
CustomerResolution
→ ManagedEntityResolution
→ BusinessIntent
```

The rule is provider-neutral and agent-neutral.

## Customer resolution before ManagedEntity

ME1 does not assume an Agent, MCP, LLM, semantic matcher, or external identity service. Customer resolution is deterministic Temporal orchestration backed by persistence queries.

For a channel without a pre-established trusted identity, such as a fresh WebChat session, the interaction is name-first:

```text
Ask name
→ Temporal resolves exact normalized active Customer name
   ├─ exactly 1 match → Customer EXISTING
   ├─ 0 matches       → request stronger identity material
   └─ >1 matches      → request stronger identity material

stronger material
→ email / phone / document
→ Temporal performs canonical strong-identity lookup
   ├─ exactly 1 match → Customer EXISTING
   ├─ >1 matches      → AMBIGUOUS
   └─ 0 matches       → if registration minimum is complete, create Customer
```

Name is a discovery key, not a globally unique identity. Email is treated as strong identifying material, but the current persistence model does not declare email globally unique; therefore code must still handle zero, one, or multiple matches.

A trusted identity already supplied by the provider/session takes precedence over name discovery. For example, a verified WhatsApp phone or an explicit trusted `customerId` may resolve the Customer directly. This preserves the previously established cross-channel rule without adding an Agent.

Strong-identity mismatch must never silently fall back to a same-name Customer. Once email/phone/document/customerId is supplied, the strong identity resolver is authoritative for that attempt.

The channel is transport only. It submits customer material and invokes Temporal's resolution update. The decision about whether the Customer exists comes from the Workflow + Activities + persistence, not from WebChat/Telegram/WhatsApp UI logic.

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

The RegisterNewAppointment orchestration owns both identity resolution and the explicit managed-entity segment:

```text
WAITING_FOR_CUSTOMER
→ RESOLVING_CUSTOMER
→ CUSTOMER_READY
→ LOADING_MANAGED_ENTITIES
→ WAITING_FOR_MANAGED_ENTITY | CREATING_MANAGED_ENTITY
→ MANAGED_ENTITY_READY
→ LOADING_SERVICES
```

ManagedEntity actions:

```text
SELECT_MANAGED_ENTITY
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

## Explicit non-goals for ME1

```text
Agent          NO
MCP            NO
LLM matching   NO
semantic guess NO
```

ME1 must remain reproducible from Temporal state, deterministic activities, canonical channel events, and persisted business data.
