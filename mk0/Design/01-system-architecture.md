# 01 — System Architecture

## 1. Architectural objective

mk0 proves exactly the first three architecture zones:

```text
┌──────────────────────────────────────────┐
│ 1. CTA / API                             │
│ Postman → NestJS                         │
└──────────────────┬───────────────────────┘
                   │ command / query
                   ▼
┌──────────────────────────────────────────┐
│ 2. ORCHESTRATION ENGINE                  │
│ Temporal                                 │
│ RegisterNewCustomer Workflow + Activities│
└──────────────────┬───────────────────────┘
                   │ persistence ports
                   ▼
┌──────────────────────────────────────────┐
│ 3. PERSISTENCE                           │
│ PostgreSQL → Customer/registration truth │
│ MongoDB    → audit/context/documents     │
└──────────────────────────────────────────┘
```

This architecture is **agent-ready but not agent-dependent**. Services, Scheduler, Integration and Agent remain outside the mk0 first slice.

---

## 2. CTA / API

### Postman

Postman is the initial development/test CTA.

It may:

- submit a registration command;
- provide `Idempotency-Key`;
- optionally provide correlation metadata;
- stage/submit optional attachments through the approved API contract;
- inspect accepted workflow identity;
- query workflow status;
- read the resulting Customer projection.

Postman owns no business rules and has no database credentials/path.

### NestJS

NestJS is the application boundary.

Owns:

- HTTP versioning/routes;
- DTO parsing and edge validation;
- request normalization;
- correlation propagation;
- idempotency header validation;
- auth boundary when later enabled;
- optional attachment ingress contract;
- Temporal client boundary;
- mapping typed workflow outcomes to HTTP.

Must not:

- directly execute the durable Customer registration sequence;
- create a second direct-to-PostgreSQL registration path;
- write audit records as a substitute for the Temporal workflow;
- implement durable retry loops in controllers;
- infer service/scheduling behavior.

---

## 3. Orchestration Engine — Temporal

Workflow type:

`RegisterNewCustomer`

Temporal owns:

- durable step ordering;
- workflow identity;
- transient retry policy through Activities;
- recovery after worker/process restart;
- workflow-level failure state;
- queryable execution phase;
- coordination between PostgreSQL and MongoDB effects.

Temporal Workflow code must remain replay-safe. PostgreSQL and MongoDB calls are side effects and belong in Activities/adapters.

### Important persistence distinction

Temporal itself needs runtime persistence in a real deployment. If Temporal is configured to use PostgreSQL internally, that database/schema is **Temporal infrastructure persistence**, not the mk0 application PostgreSQL Customer authority.

```text
PostgreSQL/application ≠ PostgreSQL/Temporal-internal
```

This boundary must remain explicit in local and production topology documentation.

---

## 4. Persistence

### 4.1 PostgreSQL — Primary Business Database

PostgreSQL is the canonical source of truth for the first workflow.

Owns conceptually:

- Customer identity;
- business/customer fields approved by the Customer contract;
- registration state;
- command/idempotency receipt;
- transactional timestamps/versioning;
- optional opaque attachment/document references.

Question answered:

> What Customer was registered and what is the authoritative transactional state of that registration?

### 4.2 MongoDB — Context / Audit / Documents

MongoDB owns application document-oriented evidence around execution.

Owns conceptually:

- `execution_audit` events;
- workflow/application context documents that should not expand the relational Customer model;
- optional attachment/document staging/committed objects and metadata for mk0 when attachments exist.

Question answered:

> What happened during this application workflow, what context was preserved, and which optional document objects belong to it?

MongoDB is not the canonical Customer authority.

### 4.3 Optional attachments

When attachments exist:

```text
attachment bytes/document object → MongoDB attachment capability
attachmentId + safe metadata     → PostgreSQL Customer/reference relation
```

The exact MongoDB binary mechanism is a Build-time implementation decision; Design freezes only the authority contract. The public API sees opaque attachment IDs, never collection internals/storage paths.

---

## 5. Primary control flow

### No attachments

```text
Postman
  ↓ POST RegisterNewCustomer
NestJS
  ↓ validate/map/start
Temporal
  ↓ reserve idempotency
PostgreSQL
  ↓ persist Customer registration
Temporal
  ↓ append application milestones
MongoDB
  ↓
Temporal finalization
  ↓
COMPLETED
```

### With attachments

```text
Postman
  ↓ stage/submit attachment through NestJS
MongoDB ingress/document capability
  ↓ opaque ingressRef
Postman
  ↓ RegisterNewCustomer + ingressRef
NestJS
  ↓
Temporal
  ├→ PostgreSQL: reserve command + persist Customer base
  ├→ MongoDB: commit/verify attachment(s) + audit/context
  ├→ PostgreSQL: link opaque attachment reference(s)
  └→ finalize
```

Large binary objects must not be treated as ordinary Temporal Workflow history payloads.

---

## 6. Authority matrix

| Concern | Authority | Explicitly not authority |
|---|---|---|
| HTTP transport | NestJS | Temporal |
| Durable workflow order | Temporal | NestJS controller |
| Customer business truth | PostgreSQL | MongoDB audit |
| Registration/idempotency state | PostgreSQL | Postman |
| Temporal Event History | Temporal | MongoDB audit |
| Application audit/context | MongoDB | Customer tables |
| Optional attachment/document object | MongoDB attachment capability | PostgreSQL binary column |
| Attachment business reference | PostgreSQL | API-local path |
| Scheduling capacity | Future Scheduler / ResourceReservation | RegisterNewCustomer |

---

## 7. Forbidden couplings

```text
Postman → PostgreSQL/MongoDB                 FORBIDDEN
NestJS controller → direct registration SQL FORBIDDEN
Temporal Workflow → DB driver directly      FORBIDDEN
MongoDB audit → Customer source of truth     FORBIDDEN
PostgreSQL → raw attachment binary store     FORBIDDEN in mk0
RegisterNewCustomer → Appointment            FORBIDDEN
RegisterNewCustomer → ResourceReservation    FORBIDDEN
```

All side effects are mediated through explicit application/orchestration ports.

---

## 8. Cross-store consistency

PostgreSQL and MongoDB do not provide one shared transaction to mk0.

Therefore Temporal provides workflow-mediated consistency rather than pretending a distributed transaction exists.

Rules:

- Customer finalization occurs only after mandatory persistence effects complete.
- Retry after a PostgreSQL write must reuse the same registration identity.
- Retry after a MongoDB attachment commit must resolve the same logical attachment.
- Audit append must have a stable deduplication/event identity when retried.
- A permanent attachment failure cannot produce a successful Customer outcome.
- Orphan/partial document effects must remain discoverable for reconciliation.

---

## 9. Future extension

Only after mk0 is certified:

```text
CTA
 ↓
NestJS
 ↓
Temporal Orchestration
 ├── Services Engine       FUTURE
 ├── Scheduler Engine      FUTURE
 ├── Integration Engine    FUTURE
 └── Persistence
```

The future Scheduler must respect the TimeSlots authority rule and use `ResourceReservation` for actual capacity locking.

---

## 10. mk0 architecture success condition

```text
valid Postman command
→ NestJS accepts/maps
→ Temporal durably starts RegisterNewCustomer
→ exactly one PostgreSQL Customer registration
→ MongoDB execution/audit evidence exists
→ optional attachment documents are persisted/referenced
→ retry does not duplicate business effects
→ worker restart does not lose progress
→ zero scheduling side effects
```
