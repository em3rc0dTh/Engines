# mk0 — Architecture Foundation

## Purpose

mk0 is the first design baseline of `Engines`.

It exists to make the first operational path unambiguous **before coding**.

The first path is deliberately small:

```text
Postman
  ↓
NestJS API boundary
  ↓
Orchestration Engine
  ↓
Temporal workflow: RegisterNewCustomer
  ↓
Persistence
  ├── MongoDB / customer data
  ├── MongoDB / workflow + audit log
  └── SQLite / local attachments
```

## Why this slice first

Registering a customer is a good first workflow because it forces us to settle the architectural rules that every later workflow will need:

- API command contract.
- Request validation.
- Correlation and idempotency.
- Durable orchestration.
- Activity boundaries.
- Business persistence.
- Audit persistence.
- Optional attachment persistence.
- Failure semantics.
- Retry semantics.
- Observable workflow status.
- Golden test cases.

It does this without introducing scheduling or service-selection complexity too early.

## Important terminology

### CTA

For mk0, CTA means the external trigger surface.

The first CTA is **Postman calling the HTTP API**.

Postman is not part of the business architecture. It represents any future caller.

### NestJS Boundary

NestJS owns the HTTP edge:

- route/versioning;
- authentication boundary when introduced;
- DTO validation;
- normalization of transport input;
- correlation metadata;
- idempotency-key acceptance;
- starting/querying the orchestration workflow;
- mapping workflow outcomes to HTTP responses.

NestJS must not become the workflow engine.

### Orchestration Engine

The Orchestration Engine owns business-process coordination.

For mk0 its durable runtime is Temporal.

It decides **which step happens next** and **what to do after failures**, but does not own MongoDB schemas or attachment bytes.

### Persistence

Persistence is a capability boundary, not one database.

mk0 separates three authorities:

1. **Customer Data Store — MongoDB**
   - canonical customer business record;
   - customer lifecycle state;
   - references to persisted attachments.

2. **Execution/Audit Log — MongoDB**
   - append-oriented application/workflow milestones;
   - correlation IDs;
   - activity attempts/outcomes;
   - important state changes;
   - sanitized failure information.

3. **Attachment Database — SQLite local**
   - staged ingress BLOBs;
   - committed binary attachment content;
   - content hash;
   - size/media type;
   - opaque attachment identifier;
   - storage lifecycle state.

SQLite is an mk0 physical choice behind an `AttachmentStore` abstraction, not a permanent public contract.

## First workflow

Canonical name:

`RegisterNewCustomer`

Business outcome:

> A valid request results in exactly one durable customer registration outcome for the same idempotency request, with an auditable execution trail and all requested attachments durably referenced when attachments were included.

## Data model baseline

mk0 uses `DATA_MODEL_VTKALL_DataModel-0_v3_timeslots.md` as the baseline for customer and scheduling semantics.

The first workflow only writes the `Customer` concern.

The TimeSlots boundary remains important because later flows must preserve this rule:

```text
Appointment = customer-facing scheduling record
ResourceReservation = real operational capacity lock
```

`RegisterNewCustomer` must not create either entity implicitly.

## Core invariants

1. No external caller writes directly to MongoDB or SQLite.
2. NestJS does not contain durable workflow sequencing.
3. Temporal Workflow code does not perform direct database/file/network side effects.
4. Persistence side effects occur through explicit Activities/adapters, except technical attachment ingress staging at the API data plane.
5. A staged attachment is not a committed Customer attachment.
6. Repeating the same idempotent request must not create a second customer.
7. Reusing the same idempotency key with a materially different payload is rejected.
8. A customer is not reported as successful until all mandatory registration effects have completed.
9. If attachments were requested, every committed attachment has a stable reference and integrity metadata.
10. Attachment bytes are not stored in the Customer MongoDB document.
11. Audit records never become the source of truth for customer business state.
12. Customer business documents never become the workflow event history.
13. Failure is observable; no silent fallback converts failed persistence into success.
14. PII/secrets must not be copied indiscriminately into workflow/audit logs.
15. `RegisterNewCustomer` does not schedule capacity.
16. Future CTAs must reuse the same application contract.

## Folder map

```text
mk0/
├── Brainstorming/
│   └── README.md
├── Design/
│   ├── README.md
│   ├── 01-system-architecture.md
│   ├── 02-register-new-customer-contract.md
│   ├── 03-temporal-workflow.md
│   ├── 04-persistence-boundaries.md
│   └── 05-mk0-persistence-profile.md
├── Plan/
│   └── README.md
├── Build/
│   └── README.md
├── Test/
│   └── README.md
├── mining-site/
│   └── README.md
├── quarries/
│   ├── README.md
│   ├── quarry-01-timeslot-data-model.md
│   ├── quarry-02-temporal.md
│   ├── quarry-03-nestjs-boundary.md
│   └── quarry-04-attachment-persistence.md
└── golden-dataset/
    ├── README.md
    └── register-new-customer-v0.json
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

Until the first five gates are approved, `Build/` remains documentation-only.
