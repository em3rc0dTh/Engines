# Brainstorming — mk0

## Problem statement

We want the smallest first slice of the target agentic platform that proves the architectural spine without building an Agent, Services Engine or Scheduler yet.

The first CTA is Postman. The first workflow is **Register New Customer**.

## First three zones

```text
1. CTA / API
   Postman → NestJS

2. Orchestration Engine
   Temporal → RegisterNewCustomer

3. Persistence
   PostgreSQL → Customer + registration/idempotency truth
   MongoDB    → execution audit + workflow context + optional attachments/documents
```

## Why this is the right mk0 cut

This slice forces us to solve the reusable foundations every later workflow needs:

- one external command path;
- transport validation;
- idempotency;
- correlation;
- durable workflow sequencing;
- retry-safe Activities;
- canonical business persistence;
- audit/context persistence;
- optional document persistence;
- cross-store consistency;
- failure/restart behavior;
- observable result contract.

It deliberately avoids service catalog and scheduling complexity.

## Working sequence

```text
Postman
   ↓
NestJS
   ↓
Temporal RegisterNewCustomer
   ├→ PostgreSQL: reserve command/idempotency
   ├→ PostgreSQL: create Customer base
   ├→ MongoDB: append audit/context
   ├→ MongoDB: optional attachment commit
   ├→ PostgreSQL: optional attachment reference
   └→ PostgreSQL: finalize registration
```

## Hypotheses to prove

### H1 — CTA remains replaceable

Postman is only the first caller. A future Agent/UI/channel should invoke the same NestJS application contract rather than obtaining special access to Temporal or persistence.

### H2 — NestJS remains an edge, not an orchestrator

NestJS maps HTTP to an application command. Durable sequencing belongs to Temporal.

### H3 — PostgreSQL owns business truth

Customer registration is transactional business data and belongs in the primary relational business authority.

### H4 — MongoDB owns execution/context/document concerns

Audit events, workflow context and optional document/attachment objects have different shapes and query/lifecycle behavior from the canonical Customer row/relations.

### H5 — Temporal mediates cross-store consistency

PostgreSQL and MongoDB do not share one transaction. Workflow state and idempotent Activities must make failure/retry safe.

### H6 — retries must be designed before Build

Client retries and Temporal Activity retries are normal. A retry after a side effect must not create another Customer or another logical attachment.

## Proposed workflow phases

```text
RECEIVED
→ VALIDATED
→ IDEMPOTENCY_RESERVED
→ CUSTOMER_PERSISTED
→ ATTACHMENTS_PERSISTED       optional
→ REFERENCES_LINKED           optional
→ FINALIZING
→ COMPLETED
```

Terminal permanent failure:

`REGISTRATION_FAILED`

The exact persisted Customer status vocabulary must follow the approved business schema; workflow phases are not automatically Customer statuses.

## Decisions closed for mk0

- Repository/version: `Engines/mk0`.
- First CTA: Postman/API.
- API boundary: NestJS.
- Durable orchestration: Temporal.
- First workflow: RegisterNewCustomer.
- Customer/registration truth: PostgreSQL.
- Execution/audit/context: MongoDB.
- Optional attachments/documents: MongoDB persistence capability with opaque reference back to PostgreSQL.
- SQLite: not part of mk0.
- Data model baseline: DataModel v3 / TimeSlots.
- No Services Engine implementation yet.
- No Scheduler Engine implementation yet.
- No Integration Engine implementation yet.
- No Agent implementation yet.
- No production code until documentation gates close.

## Remaining design questions

1. Exact Customer relational projection of the canonical Customer model.
2. Required contact rule for mk0: phone, email, or either.
3. Idempotency retention duration.
4. Exact mandatory audit milestone policy.
5. Exact MongoDB attachment mechanism during Build.
6. Attachment size/count limits.
7. Attachment ingress TTL and reconciliation policy.
8. PII allowed in MongoDB audit/context.
9. Exact 202/status-query lifecycle.
10. Separate PostgreSQL schemas/databases for application vs Temporal infrastructure in local topology.

## Explicit non-goals

mk0 does not yet implement:

- service catalog;
- availability search;
- Appointment booking;
- ResourceReservation;
- quotes;
- work orders;
- integrations;
- Agent reasoning;
- WhatsApp;
- frontend.

Those belong after this first architectural spine is certified.
