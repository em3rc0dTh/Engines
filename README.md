# Engines

`Engines` is the design and implementation home for the reusable operational architecture that will support future agentic systems.

## Current version

**mk0 — documentation-first foundation**

mk0 intentionally contains **no production implementation** yet. Its job is to freeze the first real operational spine before choosing application frameworks or channel-specific products.

## mk0 scope — first three architecture zones

```text
1. CTA / OMNICHANNEL ENTRY
   Postman / CLI now
   Form / WhatsApp / Telegram / API / Webhook later
                 ↓
             CTA Adapter
                 ↓ canonical command

2. ORCHESTRATION ENGINE
   Full Temporal platform
   ├── workflow routing
   ├── Workflow Library
   ├── durable Workflow Execution
   ├── Activities
   ├── Task Queues / Workers
   ├── retries / timeouts / recovery
   ├── Queries / Signals / Updates when required
   └── visibility / durable history
                 ↓
      RegisterNewCustomer first workflow

3. PERSISTENCE / STORAGE
   PostgreSQL      → canonical Customer + registration/idempotency truth
   MongoDB         → execution/audit/workflow context
   AttachmentStore → binary/document objects when present
```

Canonical first path:

```text
CTA channel
→ CTA Adapter
→ Temporal Orchestration Engine
→ PostgreSQL + MongoDB + optional AttachmentStore
```

**No NestJS, Express, Fastify or other web/application framework is part of mk0 architecture.** A future HTTP adapter may use a framework, but the framework remains replaceable and outside the orchestration authority.

## Architectural meaning of the CTA Adapter

The CTA Adapter is a contract boundary, not a chosen framework.

It converts channel-specific input into the same canonical command. Today the sender can be Postman or CLI. Later the sender can be a form, WhatsApp message, Telegram message, mobile app, voice channel, API/webhook or another future channel explicitly admitted by a later design decision.

All channels must converge on the same orchestration contract instead of creating channel-specific business workflows.

## What mk0 must prove

- controlled input can enter from the CTA boundary;
- structurally invalid input is rejected before business side effects;
- a structurally valid registration intent may start with incomplete Customer business data and wait durably for policy-required fields;
- the accepted command starts the full Temporal-managed workflow;
- Temporal durably owns state, retries, worker recovery and workflow progress;
- the first Workflow is `RegisterNewCustomer`;
- the workflow follows the approved DataModel v3 / TimeSlots Customer semantics;
- PostgreSQL persists canonical Customer and registration/idempotency state;
- MongoDB persists required execution/audit/context evidence;
- attachments, when present, are persisted through a separate attachment capability and safely referenced from business data;
- CTA disconnect/reconnect does not interrupt an accepted workflow;
- retries/restarts do not duplicate Customers, logs or logical attachments;
- the final outcome is queryable and auditable.

## First workflow

> **Register New Customer**

The CTA does not register the Customer itself. It submits the controlled command. Temporal manages the workflow and Activities that produce the persistence effects.

## Data-model baseline

mk0 uses **DataModel v3 / TimeSlots** as the canonical business-model baseline.

For the first workflow the relevant concern is `Customer`. `RegisterNewCustomer` creates no `Appointment`, `ResourceReservation`, availability mutation, service execution or scheduling side effect.

## Persistence authority

- **PostgreSQL**: canonical Customer + registration/idempotency truth.
- **MongoDB**: application execution/audit/workflow context.
- **AttachmentStore**: separate binary/document persistence capability; physical technology remains a Build decision.
- **Temporal**: orchestration authority and durable execution history, not Customer truth.

Temporal may use its own infrastructure database. That persistence is isolated from the Engines application business databases.

## Repository structure

See [`mk0/README.md`](mk0/README.md).

## Build rule

**No application framework and no production implementation is selected until Design, Plan, Test contract and Golden Dataset gates are approved.**
