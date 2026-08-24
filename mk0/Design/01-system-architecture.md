# 01 — System Architecture

## 1. Architectural objective

mk0 must prove one clean operational path:

```text
Postman CTA
   │
   │ HTTP command
   ▼
NestJS API Boundary
   │
   │ start/query workflow
   ▼
Orchestration Engine
   │
   │ Temporal Workflow + Activities
   ▼
Persistence Ports
   ├── CustomerRepository      → MongoDB
   ├── ExecutionAuditRepository→ MongoDB
   └── AttachmentStore         → local database/store
```

This architecture is intentionally **agent-ready but not agent-dependent**.

A future Agent becomes another caller of the NestJS command contract. It does not obtain direct access to the workflow runtime or databases.

---

## 2. Component responsibilities

### 2.1 Postman CTA

Postman is a development/test caller.

Responsibilities:

- build the HTTP request;
- provide `Idempotency-Key`;
- optionally provide correlation metadata;
- submit JSON or multipart content;
- inspect accepted workflow identity;
- query workflow status;
- inspect final outcome.

Postman owns no business rules.

### 2.2 NestJS API Boundary

NestJS is the public application edge.

Responsibilities:

- API versioning;
- DTO parsing;
- schema validation;
- basic normalization;
- request-size and attachment-count limits;
- authentication/authorization boundary when enabled;
- correlation ID creation/propagation;
- idempotency-key validation;
- construction of the application command;
- start/query interaction with the Orchestration Engine;
- translation of known outcomes to HTTP responses.

NestJS must not:

- write Customer directly to MongoDB;
- write attachment bytes directly to the local store;
- implement retry loops for durable business steps;
- model a long-running registration state machine in a controller;
- infer scheduling.

### 2.3 Orchestration Engine

The Orchestration Engine owns durable sequencing.

Runtime for mk0: **Temporal**.

Responsibilities:

- assign deterministic Workflow identity;
- coordinate registration steps;
- call Activities;
- retry transient failures according to policy;
- preserve progress across process/runtime failure;
- return/query workflow status;
- prevent workflow-level duplication;
- encode compensation/failure policy explicitly.

The Workflow must not perform direct database, filesystem, clock-dependent, random, or network side effects.

### 2.4 Persistence

Persistence is three separate capabilities.

#### Customer business authority

MongoDB collection conceptually named `customers`.

Owns:

- Customer canonical business document;
- lifecycle/status required by the approved model;
- normalized contact data;
- attachment references/metadata;
- timestamps/version metadata;
- correlation to registration workflow where useful.

#### Execution/Audit authority

MongoDB collection conceptually named `execution_audit`.

Owns append-oriented application/audit facts such as:

- request accepted;
- workflow started;
- validation accepted/rejected;
- customer persistence attempt/outcome;
- attachment persistence attempt/outcome;
- registration activated/failed;
- sanitized error classification.

This collection is **not** a replacement for Temporal Event History. It is a business/application audit projection designed for application queries and retention rules.

#### Attachment authority

A separate local database/store.

Owns:

- binary content;
- opaque attachment ID;
- content hash;
- media type;
- byte length;
- local persistence timestamp;
- integrity/readability state.

MongoDB stores references, not binary attachment content.

---

## 3. Control flow

### 3.1 No attachments

```text
Postman
  │ POST register
  ▼
NestJS
  │ validate envelope + idempotency key
  │ create correlationId
  ▼
Temporal Client
  │ start RegisterNewCustomer workflow
  ▼
Workflow
  │ validate/normalize business command
  │ activity: ensure idempotency reservation
  │ activity: create customer
  │ activity: finalize customer
  │ activity: append audit milestones
  ▼
ACTIVE customer
```

### 3.2 With attachments

```text
Postman
  │ POST register + attachment(s)
  ▼
NestJS
  │ validates metadata/limits
  │ stages attachment ingress in an implementation-defined safe handoff
  ▼
Temporal Workflow
  │ ensure idempotency
  │ create pending registration identity
  │ activity: persist each attachment
  │ receive attachment IDs + hashes
  │ activity: create/link customer with committed references
  │ finalize registration
  ▼
ACTIVE customer + attachment references
```

Important: Temporal Workflow input should not blindly contain large binary blobs. The Build phase must choose a safe ingress/staging mechanism while preserving the contract that attachment bytes ultimately live in the local attachment store.

---

## 4. Authority matrix

| Concern | Authority | Not authority |
|---|---|---|
| HTTP syntax | NestJS | Temporal |
| DTO validation | NestJS | MongoDB |
| Durable process order | Temporal Workflow | Controller |
| Retry policy | Orchestration/Activity policy | Postman |
| Customer truth | MongoDB Customer store | Audit log |
| Workflow execution history | Temporal | Customer document |
| Business/application audit view | MongoDB audit collection | Postman console |
| Attachment bytes | Local attachment store | MongoDB Customer |
| Attachment references | Customer document / metadata projection | Raw local path in API |
| Scheduling capacity | Future Scheduler/ResourceReservation | RegisterNewCustomer |

---

## 5. Couplings explicitly forbidden

### Forbidden A

```text
Postman → MongoDB
```

Reason: bypasses application contract and orchestration.

### Forbidden B

```text
NestJS Controller → CustomerRepository.create()
```

for the orchestrated registration path.

Reason: creates a second non-durable business path.

### Forbidden C

```text
Temporal Workflow → Mongo driver / filesystem
```

Reason: Workflow code must remain replay-safe/deterministic; side effects belong in Activities.

### Forbidden D

```text
Customer document → embedded attachment binaries
```

Reason: mixes business data and binary storage lifecycle.

### Forbidden E

```text
RegisterNewCustomer → Appointment / ResourceReservation
```

Reason: customer registration is not scheduling.

### Forbidden F

```text
Audit log == source of customer truth
```

Reason: audit is evidence/projection; business state lives in the Customer store.

---

## 6. Future extension points

After mk0 is proven, the architecture can add capabilities without changing the entry rule:

```text
CTA
 ↓
NestJS
 ↓
Orchestration
 ├── Services Engine
 ├── Scheduler Engine
 ├── Persistence
 └── future integrations
```

The Scheduler must later use the TimeSlots rule:

```text
availability = WorkTeamScheduleRule
             + WorkTeamScheduleOverride
             - blocking ResourceReservation
```

and only `held`/`booked` reservations block capacity.

---

## 7. mk0 architectural success condition

The architecture is proven when a clean environment can repeatedly execute:

```text
valid Postman command
→ 202 Accepted
→ one Temporal Workflow
→ one canonical Customer outcome
→ complete application audit trail
→ optional attachments persisted and referenced
→ same idempotency request creates no duplicate
→ restart/failure does not lose workflow progress
```
