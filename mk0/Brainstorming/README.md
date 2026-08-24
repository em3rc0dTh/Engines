# Brainstorming — mk0

## Problem statement

We want the smallest first slice that proves the operational spine without choosing an application framework.

The first CTA may be Postman, CLI, or a tiny test harness. The first workflow is **RegisterNewCustomer**.

## First three zones

```text
1. CTA / controlled entry
   Postman | CLI | test harness

2. Orchestration Engine
   Temporal → RegisterNewCustomer

3. Persistence
   PostgreSQL → Customer + registration/idempotency truth
   MongoDB    → execution/audit/workflow context
   AttachmentStore → optional binary/document persistence
```

## Working sequence

```text
CTA
   ↓ validate command envelope
Temporal RegisterNewCustomer
   ├→ PostgreSQL: reserve registration/idempotency
   ├→ PostgreSQL: persist Customer base from TimeSlots model
   ├→ MongoDB: persist required execution/audit/context
   ├→ AttachmentStore: optional attachment commit
   ├→ PostgreSQL: optional attachment reference
   └→ PostgreSQL: finalize registration
```

## Hypotheses to prove

### H1 — CTA is replaceable

The first caller is only a test surface. Postman, CLI, or a future channel must use the same command semantics.

### H2 — Temporal begins the durable business boundary

No framework is needed to own business sequencing. Once a valid command is accepted, Temporal owns progress, retries, restart recovery, and final workflow state.

### H3 — entry input must be controlled

Structurally invalid input must be rejected before business persistence. Business/state-dependent validation can occur durably in the workflow. The split must be explicit and testable.

### H4 — PostgreSQL owns Customer truth

The Customer is persisted according to the approved DataModel v3 / TimeSlots semantics, without inventing unknown fields.

### H5 — MongoDB owns execution evidence/context

Audit and workflow context remain distinct from canonical Customer truth and from Temporal Event History.

### H6 — attachments are a separate persistence capability

Attachment bytes/documents have their own lifecycle and must not be forced into the Customer relational model or Temporal history.

### H7 — retries must be designed first

Client retries and Temporal Activity retries are normal. A retry after a side effect must resolve existing logical state rather than create another Customer or attachment.

## Proposed workflow phases

```text
RECEIVED
→ VALIDATED
→ IDEMPOTENCY_RESERVED
→ CUSTOMER_PERSISTED
→ ATTACHMENTS_PERSISTED       optional
→ REFERENCES_LINKED           optional
→ AUDIT_CONTEXT_PERSISTED
→ FINALIZING
→ COMPLETED
```

Terminal permanent failure:

`REGISTRATION_FAILED`

Workflow phases are not automatically Customer business statuses.

## Decisions closed for mk0

- Repository/version: `Engines/mk0`.
- First CTA: Postman, CLI, or minimal test harness.
- No required web/application framework.
- Durable orchestration: Temporal.
- First workflow: `RegisterNewCustomer`.
- Customer/registration/idempotency truth: PostgreSQL.
- Execution/audit/workflow context: MongoDB.
- Attachments: separate `AttachmentStore` capability; physical technology remains open until Build.
- Data model baseline: DataModel v3 / TimeSlots.
- No Services, Scheduler, Integration or Agent implementation yet.
- No production code until documentation gates close.

## Explicit non-goals

mk0 does not yet implement a web framework, frontend, Agent, service catalog, scheduling, ResourceReservation, appointment booking, integrations, quotes or work orders.
