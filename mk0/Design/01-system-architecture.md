# 01 — System Architecture

## 1. Architectural objective

mk0 proves the first three architecture zones shown in the platform diagram:

```text
┌──────────────────────────────────────────────────┐
│ 1. CTA / OMNICHANNEL ENTRY                       │
│ Postman / CLI now                                │
│ Form / MCP / WhatsApp / Telegram / API later     │
│                     ↓                            │
│                 CTA Adapter                      │
└─────────────────────┬────────────────────────────┘
                      │ canonical command
                      ▼
┌──────────────────────────────────────────────────┐
│ 2. ORCHESTRATION ENGINE — TEMPORAL              │
│                                                  │
│ 2.1 Workflow Router                              │
│ 2.2 Workflow Library                             │
│     RegisterNewCustomer first                    │
│ 2.3 Orchestration Coordinator                    │
│                                                  │
│ Temporal Service / Event History                 │
│ Task Queues / Workers / Activities               │
│ retries / timeouts / recovery / Queries          │
│ Signals / Updates when required                  │
└─────────────────────┬────────────────────────────┘
                      │ persistence Activities
                      ▼
┌──────────────────────────────────────────────────┐
│ 3. PERSISTENCE / STORAGE                         │
│ PostgreSQL      → Customer/registration truth    │
│ MongoDB         → audit/workflow context         │
│ AttachmentStore → binary/documents when present  │
└──────────────────────────────────────────────────┘
```

No NestJS, Express, Fastify or other application framework is architectural authority in mk0.

## 2. CTA / omnichannel entry

### 2.1 Channels

Current proof channels:

- Postman;
- CLI.

Future channels explicitly supported by architecture:

- form/web UI;
- MCP;
- WhatsApp;
- Telegram;
- Web Chat;
- Mobile App;
- Voice / IVR;
- API / Webhook;
- Email;
- future channels.

The channel is replaceable. Business workflow semantics are not channel-specific.

### 2.2 CTA Adapter

The CTA Adapter is the stable ingress boundary between channel-specific input and the Orchestration Engine.

Responsibilities:

- receive channel-specific input;
- perform structural/transport-safe validation;
- normalize into a canonical command;
- attach correlation identity;
- require/derive explicit idempotency identity;
- attach caller/channel metadata only when allowed;
- stage/reference optional attachments without putting large binary payloads into Workflow history;
- start the correct Temporal Workflow;
- return/query a safe workflow status/result projection.

The CTA Adapter owns no durable business state.

It must not:

- write PostgreSQL directly;
- write MongoDB directly;
- commit final Customer attachments outside the workflow;
- implement database retry loops;
- implement Customer registration phases;
- infer services/scheduling in `RegisterNewCustomer`.

### 2.3 Postman and CLI nuance

A CLI can invoke the Temporal client contract directly behind the CTA Adapter semantics.

Postman requires a transport-compatible adapter if we want Postman to submit a business-friendly request. Directly exposing Temporal's native protocol/payload details to every CTA would couple channels to the orchestration implementation and would contradict the diagram's CTA Adapter boundary.

Therefore:

```text
Postman → CTA Adapter → Temporal
```

is the preferred Postman shape.

The adapter can remain framework-free in mk0.

## 3. Input safety boundary

The entry contract has two validation layers.

### 3.1 Pre-start structural validation

Reject before Workflow start when input cannot form a legal command, for example:

- malformed envelope;
- missing command/idempotency identity;
- missing `businessSlug`;
- missing Customer type/name;
- no usable contact locator when required by contract;
- malformed attachment reference;
- forbidden scheduling/service fields.

A rejected structural command produces zero business persistence side effects.

### 3.2 Durable workflow/business validation

Validation that requires persisted state, duplicate/idempotency state or business policy occurs durably through the Temporal Workflow/Activities.

The split must remain deterministic and testable.

## 4. Orchestration Engine — full Temporal platform

`Temporal` means the actual Temporal orchestration platform, not a custom local state machine.

Official Temporal documentation describes durable execution that resumes after crashes, network failures and infrastructure outages. mk0 uses this capability as the core continuity mechanism.

### 4.1 Workflow Router

For mk0 routing is intentionally deterministic:

```text
command.type = RegisterNewCustomer
→ Workflow type = RegisterNewCustomer
```

No AI intent classifier is required yet.

Later, the same router boundary can select Booking, Reschedule, Service Recommendation and other workflows without changing CTA channel contracts.

### 4.2 Workflow Library

First Workflow:

`RegisterNewCustomer`

Future Workflow Library entries remain outside mk0.

### 4.3 Orchestration Coordinator

Temporal owns:

- Workflow identity;
- durable Event History;
- Workflow state and replay;
- Task Queue dispatch;
- Worker execution;
- Activity invocation;
- retry/backoff/timeouts;
- process/worker restart recovery;
- Queries for read-only state;
- Signals/Updates when later workflows require external interaction;
- explicit cancellation/compensation semantics when designed;
- versioning/replay compatibility;
- operational visibility.

Not every platform feature must be exercised by the first Customer workflow, but the architecture must live inside the full Temporal model from the beginning.

## 5. RegisterNewCustomer state machine

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

Any non-recoverable failure produces a typed terminal outcome while preserving enough durable identity/evidence for diagnosis and safe replay/recovery.

Workflow code coordinates only. Database/network/file side effects belong to Activities/adapters.

## 6. Data-model contract — TimeSlots Customer

The canonical semantic source is `DATA_MODEL_VTKALL_DataModel-0_v3_timeslots.md`.

The first Workflow projects only the Customer concern:

```text
Customer
├── businessSlug
├── type
├── name
├── document
├── contact
│   ├── phones[]
│   └── email
├── whatsapp
├── metrics
├── notes
├── status
├── createdAt
└── updatedAt
```

Rules:

- persist only known/approved values;
- do not invent business facts to fill optional fields;
- channel/workflow metadata is not automatically Customer domain data;
- `ManagedEntity`, `Appointment`, `ResourceReservation` and scheduling remain outside this Workflow.

## 7. Persistence authorities

### PostgreSQL — canonical business authority

Owns:

- Customer identity and approved relational projection;
- normalized Customer/contact/document fields;
- registration state/version;
- idempotency/command receipt;
- final opaque attachment references required by the registration.

### MongoDB — execution/audit/context authority

Owns:

- `execution_audit` milestones;
- workflow/application context documents;
- safe execution metadata and failure classifications.

MongoDB does not become a second canonical Customer store.

### AttachmentStore — optional binary/document authority

Owns when attachments exist:

- staged/committed binary/document object;
- opaque object identity;
- SHA-256/integrity metadata;
- media type/length;
- lifecycle/TTL/reconciliation state.

The target architecture diagram suggests object storage such as MinIO/S3. mk0 keeps the physical choice open until Build while freezing the capability boundary.

## 8. Primary control flow

### No attachments

```text
CTA Channel
  ↓
CTA Adapter
  ↓ RegisterNewCustomer
Temporal
  ├→ Activity: reserve command/idempotency   → PostgreSQL
  ├→ Activity: persist Customer              → PostgreSQL
  ├→ Activity: append audit/context          → MongoDB
  └→ Activity: finalize Customer             → PostgreSQL
  ↓
COMPLETED
```

### With attachments

```text
CTA Channel
  ↓ attachment ingress
CTA Adapter / Attachment ingress contract
  ↓
AttachmentStore STAGED
  ↓ ingressRef
CTA Adapter
  ↓ RegisterNewCustomer + ingressRef
Temporal
  ├→ PostgreSQL: reserve command + Customer base
  ├→ AttachmentStore: commit/verify attachment(s)
  ├→ PostgreSQL: link opaque attachment reference(s)
  ├→ MongoDB: audit/context
  └→ PostgreSQL: finalization
```

Large binary content does not travel as ordinary Workflow history payload.

## 9. Continuity requirement

The system must remain correct if the originating CTA disappears immediately after durable Workflow acceptance.

```text
CTA start
→ Temporal durable acceptance
→ CTA disconnects
→ Workflow continues through Workers/Activities
→ CTA or another authorized channel reconnects
→ query same workflow identity
→ same durable outcome
```

Continuity comes from Temporal, not from a permanently open network socket.

## 10. Authority matrix

| Concern | Authority | Not authority |
|---|---|---|
| Channel-specific input | CTA channel/adapter | Temporal persistence |
| Canonical command mapping | CTA Adapter contract | Database |
| Durable workflow order | Temporal | CTA |
| Workflow Event History | Temporal | MongoDB audit |
| Customer business truth | PostgreSQL | MongoDB audit |
| Registration/idempotency truth | PostgreSQL | CTA memory |
| Application execution audit/context | MongoDB | Customer tables |
| Attachment bytes/documents | AttachmentStore | Customer relational columns |
| Attachment business reference | PostgreSQL | CTA-local path |
| Scheduling capacity | Future Scheduler/ResourceReservation | RegisterNewCustomer |

## 11. Forbidden couplings

```text
Channel → PostgreSQL/MongoDB direct writes          FORBIDDEN
CTA Adapter → business persistence sequencing       FORBIDDEN
CTA → final attachment commit bypassing Temporal    FORBIDDEN
Temporal Workflow → DB/file/network driver          FORBIDDEN
MongoDB audit → canonical Customer truth             FORBIDDEN
RegisterNewCustomer → Appointment                    FORBIDDEN
RegisterNewCustomer → ResourceReservation            FORBIDDEN
Framework choice → orchestration authority           FORBIDDEN
```

## 12. Cross-store consistency

PostgreSQL, MongoDB and AttachmentStore do not share one atomic transaction.

Temporal mediates consistency:

- Customer finalization only after all mandatory effects succeed;
- retry after PostgreSQL side effect reuses the same registration identity;
- retry after attachment commit reuses the same logical attachment;
- retryable audit milestones use stable event identity;
- permanent attachment failure cannot become false success;
- partial/orphan attachment state remains discoverable for reconciliation.

## 13. mk0 success condition

```text
controlled CTA input
→ CTA Adapter canonical command
→ full Temporal durable Workflow
→ TimeSlots-aligned Customer persistence
→ exactly one PostgreSQL Customer registration
→ MongoDB audit/context evidence
→ optional AttachmentStore object + PostgreSQL reference
→ CTA disconnect/reconnect preserves the same outcome
→ retries/restarts create no duplicate logical effects
→ zero scheduling side effects
```
