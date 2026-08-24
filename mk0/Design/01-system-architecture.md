# 01 — System Architecture

## 1. Architectural objective

mk0 is the **first proof of the reusable Engines orchestration architecture**, not the final Workflow Library.

The target architecture is:

```text
┌────────────────────────────────────────────────────────────┐
│ INPUT / CTA CHANNELS                                       │
│ Postman / CLI / Form / WhatsApp / Telegram / API / Web /… │
└───────────────────────┬────────────────────────────────────┘
                        │ source-specific input
                        ▼
┌────────────────────────────────────────────────────────────┐
│ CTA / CHANNEL ADAPTER                                      │
│ normalize / correlate / start / query / update             │
└───────────────────────┬────────────────────────────────────┘
                        │ canonical operation
                        ▼
┌────────────────────────────────────────────────────────────┐
│ ORCHESTRATION ENGINE — TEMPORAL                            │
│                                                            │
│ Workflow Router                                            │
│ Workflow Library                                           │
│ Orchestration Coordinator                                  │
│ Temporal Service / Event History                           │
│ Task Queues / Workers / Activities                         │
│ Queries / Updates / Signals / Timers                       │
│ retries / timeouts / recovery / visibility                 │
└───────────────────────┬────────────────────────────────────┘
                        │ Activities / ports
          ┌─────────────┼──────────────┬───────────────────┐
          ▼             ▼              ▼                   ▼
      PostgreSQL     MongoDB     AttachmentStore     APIs/Integrations
          │             │              │                   │
          └─────────────┴──────────────┴───────────────────┘
                        │ canonical result / event
                        ▼
┌────────────────────────────────────────────────────────────┐
│ OUTPUT / NOTIFICATION ADAPTERS                             │
│ Postman / CLI / Form / WhatsApp / Telegram / API / Web /… │
└────────────────────────────────────────────────────────────┘
```

The first mk0 laboratory slice uses only:

```text
Postman / CLI
→ CTA Adapter
→ Temporal
→ RegisterNewCustomer
→ PostgreSQL + MongoDB + optional AttachmentStore
→ Postman / CLI result
```

Passing this slice proves a pattern. It does not mean Engines is finished.

## 2. The architectural constant and the replaceable edges

### Replaceable

- input source/channel;
- output/notification channel;
- Workflow selected from the library;
- persistence/integration adapter implementations;
- future API/application framework.

### Architectural constant

Temporal remains the durable orchestration authority.

The desired long-term property is:

```text
new channel      → add/extend adapter, not business process duplication
new workflow     → add Workflow/policy/Activities, not channel rewrite
new integration  → add Activity adapter, not Workflow transport coupling
```

## 3. CTA / Channel Adapter

The adapter creates a stable boundary between source-specific input and Workflow semantics.

### Inbound

It may:

- receive a request/message/event from the channel;
- identify source/channel and caller/session context when known;
- validate transport structure;
- normalize input into a canonical operation;
- start a Workflow;
- query Workflow state;
- send an approved Workflow Update or Signal;
- stage/reference attachments;
- preserve correlation/idempotency information.

It must not:

- write business databases directly;
- own durable Workflow phase state;
- retry business side effects;
- implement duplicate/scheduling/business policy independently;
- decide final business truth.

### Outbound

The same architectural edge supports output rendering/delivery.

It may:

- return a canonical result to the originating caller;
- transform a Workflow-facing result into channel-specific presentation;
- deliver a notification through an approved channel adapter;
- preserve correlation to the relevant customer/workflow/session.

Examples:

```text
canonical result → JSON for Postman/API
canonical result → terminal output for CLI
canonical notification → WhatsApp
canonical notification → Telegram
canonical state → website/form UI
```

The output channel may be the source channel, but Engines must not assume this is always true.

## 4. Temporal is the Orchestration Engine

`Temporal` means the real Temporal platform.

Temporal owns:

- Workflow identity;
- durable Event History;
- deterministic Workflow state/replay;
- Workflow Router execution;
- Workflow Library execution;
- Task Queue dispatch;
- Worker execution;
- Activity coordination;
- retries/backoff/timeouts;
- timers/durable waiting;
- Query/Update/Signal interaction;
- restart/recovery;
- cancellation/compensation when explicitly designed;
- versioning/replay compatibility;
- visibility/operational execution state.

Temporal Workflow code does not directly call database/network/file/channel SDKs. Those are side effects and belong in Activities/adapters.

## 5. Workflow Router and Workflow Library

mk0 starts with deterministic routing:

```text
operation = RegisterNewCustomer
→ RegisterNewCustomer Workflow
```

This is only the first Workflow Library entry.

The target library may later include, for example:

```text
RegisterNewCustomer
CreateAppointment
RescheduleAppointment
CancelAppointment
OpenCase
RegisterManagedEntity
CreateAssessment
CreateQuote
ApproveQuote
CreateWorkOrder
NotifyCustomer
...future Workflows
```

No Agent is required for routing in mk0. Later an Agent/Hermes may help infer an intent, but the inferred operation must still enter the same orchestration boundary.

## 6. General Workflow pattern

Not every Workflow is identical, but Engines should be able to express this general durable pattern:

```text
RECEIVE OPERATION
       ↓
LOAD VERSIONED WORKFLOW / BUSINESS POLICY
       ↓
ENOUGH INPUT?
   ├── no
   │    ↓
   │ WAIT DURABLY
   │    ↓
   │ REQUEST / EXPOSE MISSING INPUT
   │    ↓
   │ RECEIVE UPDATE / SIGNAL
   │    └───────────────┐
   │                    │
   └────────────────────┘
       ↓ yes
READ REQUIRED BUSINESS STATE
       ↓
APPLY RULES / DECISIONS
       ↓
EXECUTE SIDE EFFECTS THROUGH ACTIVITIES
       ↓
PERSIST / VERIFY / AUDIT
       ↓
PRODUCE CANONICAL RESULT / EVENT
       ↓
RETURN OR NOTIFY THROUGH OUTPUT ADAPTER
```

This is the architectural hypothesis mk0 begins to test.

## 7. First proof Workflow — RegisterNewCustomer

`RegisterNewCustomer` is intentionally interactive so mk0 can exercise more than a simple insert.

First-lab behavior:

```text
CTA says: Register a customer
        ↓
Temporal starts Workflow
        ↓
load RegistrationPolicy
        ↓
missing required data?
   ┌────┴────┐
  yes        no
   ↓          ↓
WAITING      CHECK EXISTING CUSTOMER
   ↑          ↓
CTA Update    create-or-existing outcome
```

The Workflow can ask/expose what information is missing, receive additional inputs to the same durable execution, check existing Customer truth through Activities, create the Customer only when policy allows, persist audit/context, and expose the outcome.

This is a laboratory Workflow used to prove the generic architecture; it is not the permanent scope of the engine.

## 8. Input safety split

### Before Workflow start

Reject only what cannot form a legal operation/session, such as:

- malformed start envelope;
- unknown operation;
- missing `businessSlug`;
- missing start/session identity when required;
- invalid transport/attachment envelope.

### Inside Temporal

Workflow/business completeness belongs to the durable process:

- resolve required policy;
- identify missing fields;
- wait for additional input;
- validate/normalize accepted updates;
- read business state;
- enforce duplicate/business rules;
- execute/persist final outcome.

## 9. Versioned policy/configuration

Workflow rules must not be scattered across Postman, CLI, WhatsApp code or database triggers.

For Customer registration, Temporal resolves a versioned `RegistrationPolicy`, conceptually derived from the active `BusinessProfile`/`WorkflowProfile` or equivalent approved configuration.

It may define:

```text
required fields
normalization
uniqueness/duplicate rules
attachment requirements
completion rules
notification/output policy
```

An already-running Workflow uses its resolved version rather than silently changing semantics halfway through execution.

## 10. TimeSlots Customer authority

The first Workflow follows `DATA_MODEL_VTKALL_DataModel-0_v3_timeslots.md` Customer semantics.

Conceptually:

```text
Customer
├── businessSlug
├── type
├── name
├── document?
├── contact
│   ├── phones[]
│   └── email?
├── whatsapp?
├── metrics?
├── notes?
├── status
├── createdAt
└── updatedAt
```

No arbitrary `lastName`, `address`, document or phone requirement is invented unless the active business/profile model explicitly requires/defines it.

`RegisterNewCustomer` creates no `Appointment`, `ResourceReservation` or availability mutation.

## 11. Persistence and integration authorities

### PostgreSQL

Canonical transactional/business truth for entities and invariants that belong to the relational domain model.

For the first Workflow:

- Customer;
- approved contact/document projection;
- registration/session identity;
- duplicate/creation outcome needed as business truth;
- attachment references.

### MongoDB

Flexible application interaction/audit/context evidence:

- Workflow interaction milestones;
- missing-input requests;
- accepted channel inputs as safe projections;
- execution classifications;
- final outcome/failure context.

MongoDB is not Temporal Event History and is not a shadow Customer authority.

### AttachmentStore

Binary/document persistence capability.

### Existing/future APIs and integrations

Activities may call an existing authoritative backend/API instead of directly owning the persistence implementation when that boundary is appropriate.

Therefore:

```text
Workflow
  ↓
Activities
  ↓
ports/adapters
  ├── PostgreSQL
  ├── MongoDB
  ├── AttachmentStore
  ├── existing backend APIs
  └── future external integrations
```

## 12. Outbound effects and notifications

A Workflow may finish with more than database writes.

Examples:

```text
Customer created
→ persist Customer
→ audit result
→ return result to Postman/CLI

Appointment created later
→ persist Appointment/ResourceReservation
→ notify customer by originating channel or configured preferred channel

Quote approved later
→ persist decision
→ create downstream WorkOrder
→ notify customer/staff
```

Temporal orchestrates **when** an outbound effect should happen. The actual network/channel send occurs through an Activity/adapter.

This preserves retry/idempotency and avoids embedding WhatsApp, Telegram, email or API client logic inside Workflow code.

## 13. Observability laboratory

mk0 should let us see the same execution from four planes:

```text
CTA / channel laboratory
→ request, updates, result

Temporal Web UI / CLI
→ Workflow phase, Event History, Task Queue, Worker, Activities, retries

PostgreSQL
→ canonical final business data

MongoDB
→ application interaction/audit/context
```

Attachment storage is a fifth plane when binary input exists.

A future Engines control plane can aggregate these views after the architecture is proven.

## 14. Architecture success condition for mk0

```text
Postman/CLI starts first operation
→ CTA Adapter maps it
→ real Temporal Workflow starts
→ Workflow can wait and receive later input
→ policy/business state are read through Activities
→ new or existing Customer outcome is decided safely
→ PostgreSQL business truth is correct
→ MongoDB audit/context is correct
→ canonical result returns through CTA adapter
→ execution is visible in Temporal
→ retry/restart/disconnect does not corrupt the outcome
```

## 15. What success means beyond mk0

A successful mk0 gives confidence to add the next Workflow **without changing the spine**:

```text
many inputs
→ adapters
→ Temporal Workflow Router + Library
→ Activities / persistence / integrations
→ many outputs/notifications
```

That is the intended Engines architecture.
