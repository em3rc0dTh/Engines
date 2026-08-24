# Engines

`Engines` is the design and implementation home for the reusable operational architecture that will support future agentic systems.

## Current version

**mk0 — documentation-first foundation**

mk0 intentionally contains **no production implementation** yet. Its purpose is to freeze architecture, contracts, data authority, Temporal workflow semantics, persistence boundaries, Postman/API behavior, tests, evidence sources, and the golden dataset before the first stable build.

## mk0 scope — first three architecture zones

mk0 focuses only on the first three areas of the target architecture:

```text
1. CTA / API
   Postman
      ↓ HTTP
   NestJS boundary

2. ORCHESTRATION ENGINE
   Temporal
      ↓
   RegisterNewCustomer

3. PERSISTENCE
   PostgreSQL → canonical business/customer truth
   MongoDB    → execution/audit/workflow context
                + attachment/document persistence when present
```

The first end-to-end path is therefore:

```text
Postman
→ NestJS
→ Temporal RegisterNewCustomer
→ PostgreSQL + MongoDB
```

Services Engine, Scheduler Engine, Integration Engine and Agent are intentionally outside the first mk0 build slice.

## First workflow

> **Register New Customer**

Postman is only the first CTA. A future Agent, web UI, WhatsApp channel, or another client must enter through the same API/application contract instead of bypassing NestJS or writing directly to persistence.

## Persistence authority

- **PostgreSQL** is the source of truth for the registered Customer and transactional registration/idempotency state.
- **MongoDB** stores application execution/audit records, workflow context/documents, and mk0 attachment/document content when attachments are present.
- PostgreSQL stores only the durable attachment/document references required by the business record; it does not become a binary-file store.
- Temporal coordinates writes across both stores. Neither database is the workflow engine.

Temporal may use its own persistence internally depending on deployment. That infrastructure persistence is separate from the mk0 application PostgreSQL business authority.

## Data-model baseline

mk0 uses the existing **DataModel v3 / TimeSlots** model as its canonical business-model baseline.

For the first workflow, the relevant concern is `Customer`.

Important boundary:

- `Appointment` represents the customer-facing appointment/intention.
- `ResourceReservation` represents the real capacity lock.
- Register New Customer creates neither by default.
- Scheduling will be introduced only through an explicit later workflow/capability.

## Repository structure

See [`mk0/README.md`](mk0/README.md).

## Build rule

**No implementation begins until Design, Plan, Test contract, and Golden Dataset gates are approved.**
