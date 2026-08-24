# Engines

`Engines` is the design and implementation home for the reusable operational architecture that will support future agentic systems.

## Current version

**mk0 — documentation-first foundation**

mk0 intentionally contains **no production implementation** yet. Its job is to freeze the first real operational spine before choosing application frameworks.

## mk0 scope — first three architecture zones

```text
1. CTA / ENTRY
   Postman or CLI/test harness
      ↓ validated command

2. ORCHESTRATION ENGINE
   Temporal
      ↓ RegisterNewCustomer Workflow + Activities

3. PERSISTENCE
   PostgreSQL → canonical Customer + registration/idempotency truth
   MongoDB    → execution/audit/workflow context
   Attachment store → separate persistence capability when binary attachments exist
```

Canonical first path:

```text
CTA/Postman or CLI
→ Temporal RegisterNewCustomer
→ PostgreSQL + MongoDB + optional attachment persistence
```

**No web/application framework is part of mk0 architecture.** NestJS, Express, Fastify or any later HTTP layer may be evaluated only as a future CTA adapter. They are not required to prove mk0.

## What mk0 must prove

- the CTA can repeatedly submit a controlled input command;
- malformed/unsafe input is rejected before it can create business side effects;
- Temporal durably accepts and orchestrates the workflow;
- Temporal produces the persistence inputs required to register a Customer according to the approved DataModel v3 / TimeSlots semantics;
- PostgreSQL persists the canonical Customer and registration/idempotency state;
- MongoDB persists the required execution/audit/context evidence;
- attachments, when present, are persisted through a separate attachment capability and referenced safely from business data;
- retries/restarts do not duplicate Customers, logs or logical attachments;
- the final outcome is queryable and auditable.

## First workflow

> **Register New Customer**

Postman is only the first test CTA. A CLI or another future channel may invoke the same command contract. No caller may bypass Temporal to write business persistence directly.

## Data-model baseline

mk0 uses **DataModel v3 / TimeSlots** as the canonical business-model baseline.

For the first workflow the relevant concern is `Customer`. `RegisterNewCustomer` creates no `Appointment`, `ResourceReservation`, availability mutation, service execution or scheduling side effect.

## Persistence authority

- **PostgreSQL**: canonical Customer + registration/idempotency truth.
- **MongoDB**: application execution/audit/workflow context.
- **Attachment persistence**: separate capability when attachments exist; exact technology is a Build decision.
- **Temporal**: durable sequencing, not Customer truth.

Temporal may use its own infrastructure database. That persistence is isolated from the application business databases.

## Repository structure

See [`mk0/README.md`](mk0/README.md).

## Build rule

**No framework and no production implementation is selected until Design, Plan, Test contract and Golden Dataset gates are approved.**
