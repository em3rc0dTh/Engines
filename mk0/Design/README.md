# Design — mk0

This folder freezes the first stable vertical before code exists.

## Architecture scope

```text
CTA / ENTRY           → Postman | CLI | minimal test harness
Orchestration Engine  → Temporal
Persistence           → PostgreSQL + MongoDB + optional AttachmentStore
```

No application framework is selected by mk0 Design.

## Design package

1. [`01-system-architecture.md`](01-system-architecture.md) — boundaries, authority and control flow.
2. [`02-register-new-customer-contract.md`](02-register-new-customer-contract.md) — framework-agnostic command/input contract, validation, idempotency and observable outcomes.
3. [`03-temporal-workflow.md`](03-temporal-workflow.md) — durable workflow, Activities, retry/restart semantics and status projection.
4. [`04-persistence-boundaries.md`](04-persistence-boundaries.md) — PostgreSQL Customer authority, MongoDB audit/context authority and attachment boundary.
5. [`05-mk0-persistence-profile.md`](05-mk0-persistence-profile.md) — physical persistence design choices that are frozen vs intentionally deferred.

## Design acceptance gate

Design closes only when all are explicit:

- the CTA has one controlled command-entry contract;
- malformed structural input cannot create business side effects;
- no framework is required to prove the vertical;
- Temporal owns durable `RegisterNewCustomer` sequencing;
- Temporal Workflow code has no direct persistence side effects;
- the workflow maps approved TimeSlots Customer semantics into explicit persistence inputs;
- PostgreSQL is canonical Customer + registration/idempotency truth;
- MongoDB is execution/audit/workflow-context authority;
- optional attachments use a separate persistence contract;
- retries and worker restarts cannot duplicate logical business effects;
- final success requires every mandatory effect;
- `RegisterNewCustomer` creates zero scheduling side effects;
- tests and Golden Dataset can be derived without reading implementation code.

## Rule

Framework selection is a later Build choice only if runtime evidence proves one is useful. It must remain replaceable and outside the durable business authority.
