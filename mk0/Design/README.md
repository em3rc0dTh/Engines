# Design — mk0

This folder freezes the first stable vertical before code exists.

## Architecture scope

```text
CTA channels
Postman / CLI now
Form / MCP / WhatsApp / Telegram / API / Webhook later
        ↓
CTA Adapter contract
        ↓
Full Temporal Orchestration Engine
        ↓
PostgreSQL + MongoDB + optional AttachmentStore
```

No application framework is selected by mk0 Design.

## Design package

1. [`01-system-architecture.md`](01-system-architecture.md) — omnichannel CTA Adapter, full Temporal authority, persistence boundaries and control flow.
2. [`02-register-new-customer-contract.md`](02-register-new-customer-contract.md) — framework-agnostic canonical command/input contract, validation, idempotency and observable outcomes.
3. [`03-temporal-workflow.md`](03-temporal-workflow.md) — full Temporal platform model, durable Workflow, Activities, Task Queues/Workers, retry/restart semantics and status projection.
4. [`04-persistence-boundaries.md`](04-persistence-boundaries.md) — PostgreSQL Customer authority, MongoDB audit/context authority and separate attachment boundary.
5. [`05-mk0-persistence-profile.md`](05-mk0-persistence-profile.md) — physical persistence design choices that are frozen vs intentionally deferred.

## Design acceptance gate

Design closes only when all are explicit:

- every current/future CTA converges through one canonical CTA Adapter contract;
- malformed structural input cannot create business side effects;
- no web/application framework is required to prove the vertical;
- the real Temporal platform owns durable `RegisterNewCustomer` sequencing;
- Workflows, Activities, Workers and Task Queues have explicit roles;
- retry/recovery is Temporal-managed, not recreated in the CTA;
- Temporal Workflow code has no direct persistence side effects;
- the workflow maps approved TimeSlots Customer semantics into explicit persistence inputs;
- PostgreSQL is canonical Customer + registration/idempotency truth;
- MongoDB is execution/audit/workflow-context authority;
- optional attachments use a separate persistence contract;
- retries and worker restarts cannot duplicate logical business effects;
- final success requires every mandatory effect;
- CTA disconnect/reconnect does not change the accepted workflow outcome;
- `RegisterNewCustomer` creates zero scheduling side effects;
- tests and Golden Dataset can be derived without reading implementation code.

## Rule

A future framework or channel-specific SDK is only a replaceable CTA Adapter implementation detail. It must never become orchestration authority or create a direct persistence path around Temporal.
