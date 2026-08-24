# mk0 — Architecture Foundation

## Purpose

mk0 is the first architecture baseline of `Engines`.

It exists to prove one continuous operational chain before choosing a web framework, UI, Agent, Services Engine or Scheduler.

## Scope lock — first three architecture zones only

```text
1. CTA / OMNICHANNEL ENTRY
   Postman / CLI now
   Form / MCP / WhatsApp / Telegram / API / Webhook later
                 ↓
             CTA Adapter
                 ↓ canonical command

2. ORCHESTRATION ENGINE
   Full Temporal platform
                 ↓
          RegisterNewCustomer
                 ↓
   Workflows / Activities / Workers / Task Queues
   retries / recovery / Queries / Signals / Updates
   visibility / durable Event History

3. PERSISTENCE / STORAGE
   PostgreSQL
   MongoDB
   AttachmentStore when attachments exist
```

Canonical path:

```text
CTA channel
    ↓
CTA Adapter
    ↓ RegisterNewCustomer command
Temporal Orchestration Engine
    ↓ Activities / persistence ports
    ├── PostgreSQL: Customer + registration/idempotency truth
    ├── MongoDB: execution/audit/workflow context
    └── AttachmentStore: binary/document objects when present
```

There is **no mandatory application framework in mk0**.

## CTA Adapter — the stable entry boundary

The diagram's `CTA Adapter` is important. It prevents every channel from understanding Temporal internals or creating a different business path.

The adapter contract must:

- receive channel-specific input;
- authenticate/identify the caller when that capability exists;
- validate structural input;
- normalize channel payload into one canonical command;
- assign/propagate correlation identity;
- require/derive explicit idempotency identity;
- stage or reference attachments safely when present;
- submit the canonical command to the Temporal Orchestration Engine;
- return a durable workflow identity/status projection to the caller.

It must not:

- write PostgreSQL or MongoDB directly;
- execute Customer registration steps;
- implement durable retries;
- become Customer truth;
- bypass Temporal.

### First CTA

For mk0 the sender can be Postman or CLI.

A CLI can use the official Temporal client/SDK directly behind the CTA Adapter contract.

If Postman is used, a transport adapter is required so Postman sends the **business command**, not Temporal-internal protocol/payload details. That adapter may be extremely thin and framework-free; it is still only transport.

Later the exact same canonical command can be produced by:

```text
Form
MCP
WhatsApp
Telegram
Web Chat
Mobile App
Voice / IVR
API / Webhook
Email
Future channel
```

## What “continuous connection” means in mk0

mk0 must prove continuous **durable execution**, not dependence on a permanently open client socket:

```text
CTA submits valid command
→ Temporal durably accepts workflow
→ CTA may disconnect
→ Temporal continues through Workers/Activities
→ persistence effects complete
→ CTA reconnects or another channel queries status
→ same workflow/result is returned
```

Temporal's durable execution is the continuity mechanism. Official Temporal documentation describes the platform as resuming applications after crashes, network failures and infrastructure outages. The architecture must use that potency rather than emulate it with a local state machine.

## Orchestration Engine — full Temporal authority

`Temporal` in mk0 means the real Temporal orchestration platform, not a lightweight imitation.

The Orchestration Engine owns:

- Workflow identity and durable Event History;
- Workflow Library;
- Task Queues;
- Workers;
- Activities;
- retries/backoff/timeouts;
- restart/crash recovery;
- Queries for read-only workflow state;
- Signals/Updates when a workflow later needs external interaction;
- cancellation/compensation policy when explicitly designed;
- workflow versioning/replay compatibility;
- visibility/operational execution state.

Not every Temporal feature must be exercised by `RegisterNewCustomer`, but mk0 must be built **inside the full platform model** so later workflows do not require an architectural rewrite.

### mk0 workflow state machine

```text
ACCEPTED
→ VALIDATING_COMMAND
→ RESERVING_IDEMPOTENCY
→ PERSISTING_CUSTOMER_BASE
→ PERSISTING_ATTACHMENTS      optional
→ LINKING_ATTACHMENTS         optional
→ PERSISTING_AUDIT_CONTEXT
→ FINALIZING_CUSTOMER
→ COMPLETED
```

Workflow code coordinates. Database/network/file side effects occur through Activities/adapters.

## Persistence

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
- sanitized failure classifications.

MongoDB is not a shadow Customer database and does not replace Temporal Event History.

### AttachmentStore — separate capability

Attachments are optional and remain separate from canonical Customer relational data and routine audit/context data.

```text
binary/document object
→ AttachmentStore
→ opaque attachmentId + integrity metadata
→ PostgreSQL Customer/registration reference
```

The physical technology is intentionally open. The target architecture diagram points toward object storage such as MinIO/S3; mk0 may also evaluate another database/storage mechanism appropriate for local proof, provided the contract remains stable.

Large binaries must not be treated as ordinary Temporal Workflow history payloads.

## First workflow — RegisterNewCustomer

The Workflow receives the canonical command and orchestrates the inputs required to persist a Customer following `DATA_MODEL_VTKALL_DataModel-0_v3_timeslots.md`.

At minimum the semantic model recognizes:

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

1. Every channel enters through the same CTA Adapter contract.
2. Invalid structural input creates no workflow/business side effect.
3. CTA/adapter writes no business persistence directly.
4. The full Temporal platform owns durable orchestration.
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
16. Future channels reuse this contract instead of creating alternate business paths.

## Non-goals for mk0

- NestJS or another web framework;
- frontend;
- Agent reasoning;
- Services Engine;
- Scheduler Engine;
- Integration Engine implementation;
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
