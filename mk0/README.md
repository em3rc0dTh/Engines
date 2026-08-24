# mk0 — Architecture Foundation

## Purpose

mk0 is the **first laboratory proof** of `Engines`, not the final scope of the Orchestration Engine.

The long-term goal is a reusable orchestration core capable of receiving operations from many channels, routing them to many business Workflows, coordinating the required systems and databases, and returning/notifying outcomes through the appropriate channel.

`RegisterNewCustomer` is only the first specimen used to prove that architectural spine.

## Target Engines shape

```text
INPUT CHANNELS
Postman / CLI / Form / WhatsApp / Telegram / Web / Mobile / API / Webhook / ...
                         ↓
                 CHANNEL / CTA ADAPTER
                         ↓
                 canonical operation
                         ↓
┌──────────────────────────────────────────────────────┐
│ ORCHESTRATION ENGINE — TEMPORAL                    │
│                                                      │
│ Workflow Router                                      │
│ Workflow Library                                     │
│ Orchestration Coordinator                            │
│ Workflow state / Event History                       │
│ Task Queues / Workers / Activities                   │
│ Queries / Updates / Signals                          │
│ retries / timeouts / recovery / visibility           │
└───────────────────────┬──────────────────────────────┘
                        ↓
               ACTIVITIES / PORTS
       ┌────────────────┼──────────────────┐
       ↓                ↓                  ↓
   PostgreSQL        MongoDB         AttachmentStore
   business truth    audit/context   binary/documents
       │                │                  │
       └────────────────┼──────────────────┘
                        ↓
              OUTBOUND / NOTIFICATION PORTS
                        ↓
Postman / CLI / Form / WhatsApp / Telegram / Web / Mobile / API / ...
```

The channel is replaceable. The Workflow is reusable. Temporal remains the durable orchestration authority.

## mk0 proof slice

mk0 deliberately tests only a small subset of the target architecture:

```text
INPUT
Postman / CLI
      ↓
CTA Adapter
      ↓
TEMPORAL
RegisterNewCustomer
      ↓
PostgreSQL + MongoDB + optional AttachmentStore
      ↓
RESULT / STATUS
Postman / CLI
```

Passing mk0 does **not** mean Engines is finished. It means the first reusable orchestration pattern is physically proven.

## What mk0 must teach us

The first experiment must answer whether the same orchestration model can later support workflows such as:

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
...future workflows
```

without rebuilding channel-specific business logic for every source.

## CTA / Channel Adapter

The adapter is the stable boundary around external channels.

### Inbound responsibility

- receive source-specific input;
- identify source/channel and correlation context;
- validate transport/session structure;
- normalize into a canonical operation/message;
- start, query or update the appropriate Temporal Workflow;
- stage/reference attachments safely when required.

The CTA does **not** require final Customer completeness before a legal registration session starts. A legal partial/intent-only start enters Temporal; the resolved `RegistrationPolicy` then determines missing Customer data and may put the Workflow into `WAITING_FOR_REQUIRED_DATA`.

### Outbound responsibility

- render a canonical Workflow result for the caller;
- deliver a requested notification/result through the appropriate channel adapter;
- preserve correlation to the originating interaction where required;
- never invent business truth or Workflow state.

Examples:

```text
Temporal result → Postman JSON
Temporal result → CLI terminal output
Temporal result → website/API response
Temporal notification → WhatsApp message
Temporal notification → Telegram message
```

The source channel and output channel can be the same, but the architecture must not require that permanently. A Workflow may later receive from one source and notify another approved destination.

## Orchestration Engine — Temporal authority

`Temporal` in Engines means the real Temporal platform, not an in-process imitation.

Temporal owns:

- Workflow identity and durable Event History;
- Workflow Router execution boundary;
- Workflow Library execution;
- Task Queues;
- Workers;
- Activities;
- retries/backoff/timeouts;
- restart/crash recovery;
- Queries;
- Updates and Signals;
- timers and durable waiting when required;
- cancellation/compensation when designed;
- workflow versioning/replay compatibility;
- visibility and execution state.

Temporal does **not** directly become a database driver or WhatsApp/Telegram SDK. Side effects are executed through Activities and explicit ports/adapters.

## General reusable Workflow pattern

The first experiment is intentionally designed to exercise a pattern that later Workflows can reuse:

```text
RECEIVE OPERATION
      ↓
LOAD VERSIONED WORKFLOW/POLICY
      ↓
DO WE HAVE REQUIRED INPUT?
  ├── no → WAIT / REQUEST DATA
  │          ↑        ↓
  │       Update ← external input
  └── yes
      ↓
READ REQUIRED BUSINESS STATE
      ↓
APPLY RULES
      ↓
EXECUTE SIDE EFFECTS THROUGH ACTIVITIES
      ↓
VERIFY / PERSIST / AUDIT
      ↓
PRODUCE CANONICAL RESULT
      ↓
RETURN / NOTIFY THROUGH OUTPUT ADAPTER
```

Not every Workflow will use every step. The important goal is that the orchestration core can support them without moving durable process authority into CTA code.

## First Workflow — RegisterNewCustomer

The first laboratory Workflow starts from a registration intent, can wait for missing Customer data, applies a versioned registration/duplicate policy, reads existing Customer truth through an Activity, persists a new Customer only when allowed, records application audit/context, and exposes the live/final result.

The Customer semantics follow `DATA_MODEL_VTKALL_DataModel-0_v3_timeslots.md`.

`RegisterNewCustomer` is **not** the permanent definition of Engines.

### Registration session identity

mk0 freezes registration session idempotency as:

```text
(operation, businessSlug, idempotencyKeyHash)
```

The normalized material **initial start snapshot** is fingerprinted. Exact replay resolves the same logical Workflow/session; the same business-scoped session identity with a materially different initial fingerprint is a `SESSION_IDEMPOTENCY_CONFLICT` and creates no second business effect.

Later `ProvideCustomerData` Updates evolve durable Workflow state without rewriting the original start fingerprint.

## Persistence authority

### PostgreSQL

Canonical transactional/business truth for the relevant domain entities and workflow effects.

For the first Workflow:

- Customer;
- contacts/documents as approved by model;
- business-scoped registration/session identity;
- initial-start fingerprint and replay/conflict outcome;
- duplicate/creation outcome required by business truth;
- attachment references.

### MongoDB

Flexible application interaction/audit/context evidence:

- accepted interactions;
- requested information;
- state/milestone projections;
- safe execution context;
- failures/classifications.

MongoDB is not a replacement for Temporal Event History or PostgreSQL business truth.

For mk0 success, the applicable success-gating logical audit milestones must be durably represented before `CREATED` or `ALREADY_EXISTS` is reported as successful. Exhausted failure to persist required audit evidence cannot be converted into success.

### AttachmentStore

Separate binary/document persistence capability. Physical implementation remains open until Build.

## Observability laboratory

During mk0 we want to observe the architecture from all relevant planes:

```text
Postman / CLI
→ what was sent and what result was returned

Temporal Web UI / CLI
→ Workflow, phase, Event History, Workers, Task Queue, Activities, retries

PostgreSQL
→ final canonical business data

MongoDB
→ required application interaction/audit/context evidence

AttachmentStore
→ binary/document evidence when applicable
```

Later a dedicated Engines control plane may combine these views, but mk0 does not need one to prove the architecture.

## Core invariants

1. External channels are replaceable adapters.
2. All durable business orchestration belongs to Temporal.
3. Workflow definitions are channel-independent.
4. Workflow code performs no direct network/database/file side effects.
5. Side effects happen through retry-safe Activities and ports/adapters.
6. PostgreSQL/MongoDB/AttachmentStore have explicit authority boundaries.
7. Workflow state is observable independently from the originating channel.
8. A channel may disconnect without destroying an accepted Workflow.
9. Outbound responses/notifications reuse channel adapters rather than embedding channel SDK logic in Workflow code.
10. `RegisterNewCustomer` is the first proof workflow, not the final workflow catalog.
11. Future workflows must be addable without redesigning the CTA → Temporal → Activities architecture.
12. Registration session idempotency is business-scoped; exact start replay and conflicting start reuse are deterministic.
13. Later Workflow Updates do not redefine the immutable material start snapshot.
14. Mandatory audit evidence is a precondition for successful registration outcome; silent audit loss is not success.
15. Workflow changes must preserve Temporal deterministic replay/version compatibility; exact SDK mechanisms are selected during authorized Build.

## Non-goals for mk0

- finishing the complete Engines Workflow Library;
- implementing every CTA channel;
- implementing an Agent/Hermes;
- implementing all business engines at once;
- selecting a permanent web framework;
- building the final control-room UI.

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

Current material gate status and the distinction between pre-Build invariants vs Build-time implementation choices are tracked in [`Plan/mk0-gate-status.md`](Plan/mk0-gate-status.md).
