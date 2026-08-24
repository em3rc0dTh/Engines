# mk0 — Architecture Foundation

## Purpose

mk0 is the first architecture baseline of `Engines`.

It exists to prove one continuous operational chain before choosing a web framework, UI, Agent, Services Engine or Scheduler.

## Scope lock — first three architecture zones only

```text
1. CTA / ENTRY
   Postman or CLI/test harness
      ↓ controlled input

2. ORCHESTRATION ENGINE
   Temporal
      ↓ RegisterNewCustomer

3. PERSISTENCE
   PostgreSQL
   MongoDB
   Optional attachment persistence capability
```

Canonical path:

```text
CTA/Postman or CLI
        ↓
Temporal RegisterNewCustomer
        ↓
Activities / persistence ports
        ├── PostgreSQL: Customer + registration/idempotency truth
        ├── MongoDB: execution/audit/workflow context
        └── Attachment store: binary/document objects when present
```

There is **no mandatory application framework in mk0**. A future HTTP adapter may be added later, but it cannot become orchestration authority or bypass Temporal.

## What “continuous connection” means in mk0

mk0 does not require one permanently open socket. It must prove a continuous operational contract:

```text
CTA submits valid command
→ command is accepted exactly once
→ Temporal owns durable progress
→ CTA can query/observe the workflow
→ persistence effects complete
→ final Customer outcome is queryable
```

The CTA may disconnect and reconnect without losing the accepted workflow. Temporal durability is the continuity mechanism.

## 1. CTA / controlled entry

The first CTA can be:

- Postman;
- a CLI command;
- a tiny test harness/client using the Temporal client contract.

Its responsibilities are intentionally narrow:

- construct `RegisterNewCustomer` input;
- validate the transport/input envelope before submission;
- provide an idempotency key;
- optionally provide correlation metadata;
- stage/identify attachments when required;
- start the Temporal workflow;
- query the workflow/result.

The CTA does **not**:

- write PostgreSQL directly;
- write MongoDB directly;
- execute registration steps itself;
- retry business side effects itself;
- infer scheduling or services.

## 2. Orchestration Engine — Temporal

Temporal owns the durable state machine:

```text
ACCEPTED
→ VALIDATING_COMMAND
→ RESERVING_IDEMPOTENCY
→ PERSISTING_CUSTOMER_BASE
→ PERSISTING_ATTACHMENTS      optional
→ LINKING_ATTACHMENTS         optional
→ PERSISTING_AUDIT/CONTEXT
→ FINALIZING_CUSTOMER
→ COMPLETED
```

Workflow code coordinates only. Database/network/file side effects belong to Activities/adapters.

The workflow must survive worker/process restart and Activity acknowledgement loss without duplicating the logical registration.

## 3. Persistence

### PostgreSQL — canonical Customer authority

PostgreSQL answers:

> What Customer was registered, under which registration command, and what is the authoritative transactional state?

It owns conceptually:

- Customer identity;
- Customer fields projected from the approved TimeSlots data model;
- normalized contact/document data required by the contract;
- registration state/version;
- idempotency receipt;
- opaque attachment references when attachments exist.

### MongoDB — execution/audit/context authority

MongoDB answers:

> What application execution evidence and workflow context must be retained around this registration?

It owns conceptually:

- `execution_audit` events;
- workflow/application context documents;
- sanitized failure classifications;
- optional document metadata if that belongs to the chosen attachment design.

MongoDB is not a shadow Customer database and does not replace Temporal Event History.

### Attachment persistence — separate capability

Attachments are optional and must remain separate from the canonical Customer relational data.

Design rule:

```text
binary/document object → AttachmentStore capability
opaque attachmentId + integrity metadata → PostgreSQL business reference
```

The physical technology is intentionally **not selected yet**. It may later be MongoDB/GridFS, PostgreSQL-backed object metadata plus local/object storage, or another local persistence mechanism, provided the contract remains stable.

Large binary objects must not be placed directly into ordinary Temporal Workflow history payloads.

## First workflow — RegisterNewCustomer

The workflow must transform the accepted command into explicit persistence inputs that follow the approved Customer semantics from `DATA_MODEL_VTKALL_DataModel-0_v3_timeslots.md`.

At minimum the design recognizes:

```text
Customer
├── businessSlug
├── type
├── name
├── document            optional
├── contact
│   ├── phones[]
│   └── email
├── whatsapp            model-supported / optional
├── metrics             business-derived only
├── notes               optional
├── status
├── createdAt
└── updatedAt
```

mk0 must not invent unknown Customer facts just to fill the model.

## TimeSlots boundary preserved

```text
Appointment = customer-facing scheduling record
ResourceReservation = real operational capacity lock
```

`RegisterNewCustomer` creates neither and mutates no availability state.

## Core invariants

1. CTA submits one controlled command contract.
2. Invalid structural input creates no workflow/business side effect.
3. No CTA writes databases directly.
4. Temporal owns durable sequencing.
5. Workflow code performs no direct persistence/network/file side effects.
6. Activities/adapters are retry-safe and idempotent.
7. PostgreSQL is canonical Customer + registration/idempotency truth.
8. MongoDB is execution/audit/context authority, not Customer authority.
9. Attachments use a separate persistence contract.
10. Same key + same material command yields one registration outcome.
11. Same key + different material command is rejected.
12. A requested mandatory attachment cannot be skipped while reporting success.
13. Failure remains observable; no silent fallback converts failure into success.
14. PII/secrets are not copied indiscriminately into audit/context logs.
15. RegisterNewCustomer creates zero scheduling side effects.
16. Future CTA adapters reuse this contract instead of creating alternate business paths.

## Non-goals for mk0

- NestJS or any other web framework;
- frontend;
- Agent;
- Services Engine;
- Scheduler Engine;
- Integration Engine;
- appointment booking;
- service execution;
- production authentication architecture.

## Gate order

```text
BRAINSTORMING
    ↓
DESIGN
    ↓
PLAN
    ↓
TEST CONTRACT
    ↓
GOLDEN DATASET
    ↓
BUILD AUTHORIZED
    ↓
BUILD
    ↓
RUNTIME TEST
```

`Build/` remains documentation-only until these gates are approved.
