# Design — mk0

This folder freezes the first stable vertical before code exists.

## Architecture scope

```text
CTA channels
Postman / CLI now
Form / WhatsApp / Telegram / API / Webhook later
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
6. [`06-mk0-closure-decisions.md`](06-mk0-closure-decisions.md) — normative closure decisions for interactive start semantics, business-scoped idempotency, immutable session fingerprints, mandatory audit evidence, current channel vocabulary and attachment deferral.

## Design acceptance gate

Design closes only when all are explicit:

- every current/future CTA converges through one canonical CTA Adapter contract;
- malformed structural/session input cannot create business side effects;
- a legal registration session may start with incomplete Customer data and wait durably for policy-required fields;
- no web/application framework is required to prove the vertical;
- the real Temporal platform owns durable `RegisterNewCustomer` sequencing;
- Workflows, Activities, Workers and Task Queues have explicit roles;
- retry/recovery is Temporal-managed, not recreated in the CTA;
- Temporal Workflow code has no direct persistence side effects;
- the workflow maps approved TimeSlots Customer semantics into explicit persistence inputs;
- registration session idempotency is scoped by `(operation, businessSlug, idempotencyKeyHash)`;
- the evolving Customer draft is not treated as the immutable start fingerprint;
- PostgreSQL is canonical Customer + registration/idempotency truth;
- MongoDB is execution/audit/workflow-context authority;
- success-gating MongoDB audit milestones are explicit and retry-safe;
- optional attachments use a separate persistence contract;
- retries and worker restarts cannot duplicate logical business effects;
- final success requires every mandatory business and audit effect;
- CTA disconnect/reconnect does not change the accepted workflow outcome;
- `RegisterNewCustomer` creates zero scheduling side effects;
- tests and Golden Dataset can be derived without reading implementation code.

## Rule

A future framework or channel-specific SDK is only a replaceable CTA Adapter implementation detail. It must never become orchestration authority or create a direct persistence path around Temporal.

When interpreting older extracted material during closure, [`06-mk0-closure-decisions.md`](06-mk0-closure-decisions.md) resolves known cross-document drift until each originating artifact is corrected.
