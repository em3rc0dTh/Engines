# 01 — System Architecture

## 1. Architectural objective

mk0 proves the first reusable operational spine:

```text
┌──────────────────────────────────────────────────┐
│ 1. CTA / OMNICHANNEL ENTRY                       │
│ Postman / CLI now                                │
│ Form / MCP / WhatsApp / Telegram / API later     │
│                     ↓                            │
│                 CTA Adapter                      │
└─────────────────────┬────────────────────────────┘
                      │ start/query/update contract
                      ▼
┌──────────────────────────────────────────────────┐
│ 2. ORCHESTRATION ENGINE — TEMPORAL              │
│                                                  │
│ Workflow Router                                  │
│ Workflow Library                                 │
│   RegisterNewCustomer first                      │
│ Orchestration Coordinator                        │
│                                                  │
│ Temporal Service / Event History                 │
│ Task Queues / Workers / Activities               │
│ Queries / Updates / Signals                      │
│ retries / timeouts / recovery / visibility       │
└─────────────────────┬────────────────────────────┘
                      │ persistence Activities
                      ▼
┌──────────────────────────────────────────────────┐
│ 3. PERSISTENCE / STORAGE                         │
│ PostgreSQL      → Customer/registration truth    │
│ MongoDB         → interaction/audit/context      │
│ AttachmentStore → binary/documents when present  │
└──────────────────────────────────────────────────┘
```

No NestJS, Express, Fastify or other application framework is architectural authority in mk0.

## 2. CTA is replaceable

Current laboratory channels:

- Postman;
- CLI.

Future channels may include:

- form/web UI;
- MCP;
- WhatsApp;
- Telegram;
- Web Chat;
- Mobile App;
- Voice / IVR;
- API / Webhook;
- Email.

All channels must converge on the same Temporal interaction semantics. A channel never owns Customer registration sequencing.

## 3. CTA Adapter boundary

The CTA Adapter translates channel input into safe Temporal operations.

It may:

- start a Workflow;
- query current Workflow state;
- send controlled Workflow Updates;
- stage/reference optional attachments;
- render Temporal's canonical response for the channel.

It must not:

- write PostgreSQL/MongoDB directly;
- implement registration phase state;
- implement business retry loops;
- decide duplicate policy itself;
- create scheduling side effects.

A CLI may invoke the official Temporal client directly while preserving these semantics. Postman may use a framework-free transport-compatible adapter.

## 4. Temporal owns the durable interaction

`RegisterNewCustomer` is not limited to a complete one-shot payload.

The Workflow can start from a registration intent/session and durably collect missing data:

```text
CTA: Register a customer
        ↓
Temporal starts Workflow
        ↓
load versioned RegistrationPolicy
        ↓
missing required data?
   ┌────┴────┐
  yes        no
   ↓          ↓
WAITING      CHECK DUPLICATE
   ↑          ↓
CTA Update    persistence/result
```

This enables the same Orchestration Engine to support Postman now and conversational/user-facing channels later without making an Agent mandatory.

## 5. Input safety split

### Before Workflow start

Only reject input that cannot form a legal registration session, such as:

- malformed start envelope;
- unknown operation;
- missing `businessSlug`;
- missing start idempotency/session identity;
- invalid transport/attachment envelope.

### Inside the durable Workflow

Customer/business completeness belongs to Temporal:

- load required-field policy;
- determine missing fields;
- wait for additional data;
- validate/normalize accepted patches;
- check duplicates;
- persist final business state.

Therefore missing Customer name/contact data may result in `WAITING_FOR_REQUIRED_DATA` rather than `workflowStarted=false`.

## 6. RegistrationPolicy

The TimeSlots data model describes `BusinessProfile` as configuration that answers, among other things, what fields a business asks for and what workflow profile applies.

mk0 therefore uses a versioned registration-policy boundary:

```text
RegistrationPolicy
├── businessSlug
├── policyVersion
├── requiredCustomerFields
├── normalizationRules
├── duplicatePolicy
├── attachmentPolicy
└── completionRules
```

Temporal loads the policy through an Activity and uses that frozen version for the running Workflow.

No universal `lastName`, `address`, document, phone or email requirement is invented unless the active policy/data model says so.

## 7. TimeSlots Customer authority

Canonical Customer semantics remain those of `DATA_MODEL_VTKALL_DataModel-0_v3_timeslots.md`:

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

`RegisterNewCustomer` does not create `Appointment`, `ResourceReservation` or availability state.

## 8. Temporal message model

mk0 uses Temporal message passing explicitly:

```text
Start Workflow
  → create durable registration session

Query: GetRegistrationState
  → read phase / missingFields / nextAction / result

Update: ProvideCustomerData
  → add/modify allowed draft data and receive tracked response
```

Signals remain available for future asynchronous channel events when no synchronous result is required.

The workflow-facing response is canonical. Channel adapters render it differently:

```text
Postman  → JSON
CLI      → terminal text
Form     → missing-field UI
WhatsApp → message
MCP      → structured tool result
```

## 9. Duplicate detection

Temporal orchestrates duplicate detection but never queries the database directly.

```text
Temporal
→ findExistingCustomer Activity
→ PostgreSQL
→ candidate classification
→ Temporal applies versioned duplicate policy
```

The policy distinguishes:

- hard unique identifiers;
- soft possible matches;
- non-unique attributes.

A document identifier can be hard-unique when business policy says so. Phone/email should not be universally assumed unique. Name alone is not a hard uniqueness key.

Hard duplicate result:

```text
ALREADY_EXISTS
created = false
existing customerId returned
```

New result:

```text
CREATED
created = true
new customerId returned
```

## 10. Persistence authorities

### PostgreSQL

Canonical business truth:

- Customer;
- contacts/documents;
- registration/session identity;
- duplicate/creation outcome needed by business truth;
- attachment references.

### MongoDB

Application interaction/audit/context:

- session started;
- policy loaded;
- missing-data request;
- accepted input interactions;
- duplicate-check classification;
- persistence milestones;
- final outcome/failure.

MongoDB is not a shadow Customer source of truth and does not replace Temporal Event History.

### AttachmentStore

Optional binary/document authority. Physical technology remains open until Build.

## 11. Why Workflow code does not call databases directly

Temporal Workflow code must remain deterministic/replay-safe. Database, API, file and network side effects belong in Activities.

Therefore the preferred reusable shape is:

```text
Workflow
  ↓
Activities
  ↓
Ports/adapters
  ├── PostgreSQL
  ├── MongoDB
  ├── AttachmentStore
  └── existing backend API when an existing system must remain authority
```

This lets DemoPack Zero endpoints be reused through Activities where appropriate without coupling Workflow definitions permanently to one backend implementation.

## 12. Laboratory observability

mk0 intentionally exposes three evidence planes:

```text
Temporal Web UI / Temporal CLI
→ Workflow phase, Event History, Task Queue, Worker, Activity/retry state

PostgreSQL
→ final canonical Customer/registration state

MongoDB
→ application interaction/audit trail
```

A later Engines control-room UI can combine these, but it is not required to validate mk0.

## 13. Architecture success condition

```text
Postman/CLI starts registration intent
→ full Temporal Workflow starts
→ policy is loaded
→ missing fields are exposed
→ CTA provides additional data to same Workflow
→ duplicate lookup occurs through Activity
→ existing Customer returns without duplicate
   OR new Customer is persisted exactly once
→ MongoDB interaction/audit evidence exists
→ optional attachments are persisted/referenced
→ flow is inspectable in Temporal Web UI
→ CTA/Worker restart does not lose progress
→ zero scheduling side effects
```
