# mk0 — Architecture Foundation

## Purpose

mk0 is the first design baseline of `Engines`.

It exists to make the first operational path unambiguous **before coding**.

## Scope lock — only the first three architecture zones

```text
1. CTA / API
   Postman
      ↓
   NestJS API boundary

2. ORCHESTRATION ENGINE
   Temporal
      ↓
   RegisterNewCustomer

3. PERSISTENCE
   PostgreSQL
   MongoDB
```

The complete mk0 path is:

```text
Postman
  ↓ HTTP/API
NestJS
  ↓ start/query command
Temporal Orchestration Engine
  ↓ Activities
Persistence
  ├── PostgreSQL / Customer + registration truth
  └── MongoDB / execution audit + workflow context + attachments/documents
```

No Services Engine, Scheduler Engine, Integration Engine or Agent implementation belongs to this first slice.

## First workflow

Canonical name:

`RegisterNewCustomer`

Business outcome:

> A valid command produces exactly one durable Customer registration for the same idempotency request, persists the Customer transactionally, preserves an application execution trail, and persists/references optional attachments when they exist.

## 1. CTA / API — Postman + NestJS

Postman is the first caller, not business authority.

NestJS owns the application edge:

- HTTP route/versioning;
- DTO and transport validation;
- normalization;
- correlation metadata;
- `Idempotency-Key` acceptance;
- optional attachment ingress;
- starting/querying the Temporal workflow;
- mapping typed outcomes to HTTP responses.

NestJS must not become the durable workflow engine and must not implement a second direct-to-database registration path.

## 2. Orchestration Engine — Temporal

Temporal owns durable process sequencing:

```text
ACCEPTED
→ VALIDATED
→ IDEMPOTENCY_RESERVED
→ CUSTOMER_PERSISTED
→ optional ATTACHMENTS_PERSISTED
→ REFERENCES_LINKED
→ FINALIZED
→ COMPLETED
```

Workflow code coordinates. Side-effecting PostgreSQL/MongoDB operations happen through Activities/adapters.

Temporal is not the source of truth for Customer business data. Its own infrastructure persistence, if PostgreSQL is used by a Temporal deployment, is separate from the application's PostgreSQL business schema.

## 3. Persistence — PostgreSQL + MongoDB

### PostgreSQL — canonical business authority

PostgreSQL answers:

> What Customer was registered and what is the transactional state of that registration?

mk0 places here, conceptually:

- Customer identity/business record;
- normalized contact/document fields required by the approved Customer contract;
- registration/idempotency receipt;
- registration state/version;
- opaque attachment/document references when applicable.

### MongoDB — execution/document authority

MongoDB answers:

> What application execution/audit/context evidence exists, and which optional document/attachment objects were persisted for this workflow?

mk0 places here, conceptually:

- `execution_audit` events;
- workflow/application context documents;
- optional staged/committed attachment/document metadata/content behind an attachment persistence contract.

MongoDB audit is **not** a replacement for Temporal Event History, and MongoDB is **not** the canonical Customer store in mk0.

### Cross-store rule

PostgreSQL and MongoDB do not share one transaction. Temporal therefore mediates consistency:

- a Customer is not reported as successfully finalized until every mandatory effect has completed;
- retries must not create a second Customer;
- retries must not create duplicate logical attachments;
- if MongoDB succeeds and PostgreSQL linking/finalization fails, the workflow must recover/reconcile instead of pretending atomic rollback;
- failures remain observable.

## Data-model baseline — TimeSlots

mk0 uses `DATA_MODEL_VTKALL_DataModel-0_v3_timeslots.md` as the semantic baseline.

For this first workflow we only use the `Customer` concern.

The scheduling distinction is preserved for later slices:

```text
Appointment = customer-facing scheduling record
ResourceReservation = real operational capacity lock
```

`RegisterNewCustomer` creates neither.

## Core invariants

1. Postman calls only the NestJS API.
2. Postman never writes directly to PostgreSQL or MongoDB.
3. NestJS does not contain durable workflow sequencing.
4. Temporal owns `RegisterNewCustomer` sequencing.
5. Temporal Workflow code performs no direct PostgreSQL/MongoDB/network/filesystem side effects.
6. Side effects live behind Activities/adapters.
7. PostgreSQL is canonical Customer/registration truth.
8. MongoDB is execution/audit/context/document persistence, not Customer authority.
9. Same idempotency key + same material command yields one registration outcome.
10. Same idempotency key + different material command is rejected.
11. Optional attachments cannot produce a false successful Customer finalization.
12. PostgreSQL stores opaque attachment references rather than becoming a binary content store.
13. Audit/context records do not become Customer truth.
14. PII/secrets are not copied indiscriminately into audit logs.
15. RegisterNewCustomer creates no Appointment, ResourceReservation or scheduling mutation.
16. Future CTAs must reuse the same application contract.

## Folder map

```text
mk0/
├── Brainstorming/
├── Design/
│   ├── 01-system-architecture.md
│   ├── 02-register-new-customer-contract.md
│   ├── 03-temporal-workflow.md
│   ├── 04-persistence-boundaries.md
│   └── 05-mk0-persistence-profile.md
├── Plan/
├── Build/
├── Test/
├── mining-site/
├── quarries/
└── golden-dataset/
```

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

`Build/` remains documentation-only until the gates are approved.
