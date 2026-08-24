# Brainstorming — mk0

## Problem statement

We want a small first slice of the future agentic architecture that can be exercised without an Agent or UI.

The first caller is Postman. The first business operation is **Register New Customer**.

The architecture must prove that a request can enter through an HTTP boundary, become a durable workflow, persist business truth, persist an execution trail, and optionally persist attachments without mixing those responsibilities.

## Working architecture

```text
External CTA
  Postman now
  Agent/UI/WhatsApp later
        │
        ▼
NestJS
  HTTP + DTO + correlation + idempotency
        │
        ▼
Orchestration Engine
  Temporal Workflow
        │
        ├── Activity: persist customer business record
        ├── Activity: persist attachment(s), when present
        ├── Activity: link committed attachment metadata
        └── Activity: append/query operational audit where required
        │
        ▼
Persistence
  MongoDB business data
  MongoDB audit/execution log
  Local attachment database/store
```

## What mk0 is trying to learn

### H1 — The API can remain channel-agnostic

If Postman can trigger the same command contract that a future Agent will use, we avoid rebuilding workflow semantics for each CTA.

### H2 — NestJS should be a boundary, not an orchestrator

The HTTP request can disappear, clients can disconnect, and workflows can retry. Durable business progress therefore belongs to Temporal, not to a long NestJS request handler.

### H3 — Persistence needs multiple authorities

Customer data, workflow/audit events, and attachment bytes have different lifecycle and query requirements. Treating them as one generic repository would hide important failure modes.

### H4 — Idempotency must exist before retries

Temporal retries and client retries are both normal. Without idempotency, `RegisterNewCustomer` can create duplicate customers.

### H5 — Optional attachment handling creates a distributed consistency problem

MongoDB customer data and a local attachment database/store do not share a transaction. We therefore need an explicit registration state and deterministic retry/recovery semantics.

## Proposed registration states

These states are mk0 workflow/business-registration states, not Temporal internal states:

```text
RECEIVED
  ↓
VALIDATED
  ↓
PERSISTING_CUSTOMER
  ↓
PERSISTING_ATTACHMENTS   (only when attachments exist)
  ↓
FINALIZING
  ↓
ACTIVE
```

Failure does not imply deletion. A failed execution keeps enough durable identity to retry safely.

Possible terminal/observable failure state:

`REGISTRATION_FAILED`

The canonical Customer domain status may later use a smaller vocabulary. Until the data-model decision is frozen, implementation must not invent extra persisted business statuses beyond the approved schema.

## Decisions already closed

- First CTA: Postman/API.
- HTTP/application runtime boundary: NestJS.
- Durable workflow runtime: Temporal.
- First workflow: Register New Customer.
- Customer business data: MongoDB.
- Execution/audit log: MongoDB.
- Attachment content: separate local attachment database/store.
- Data-model baseline: DataModel v3 / TimeSlots.
- No Services Engine implementation in the first vertical.
- No Scheduler Engine implementation in the first vertical.
- No Agent implementation in mk0.
- No production code until documentation gates close.

## Open design questions that mk0 must close

1. Which exact Customer fields are mandatory at API ingress?
2. Is a normalized phone mandatory for mk0, or is email-only registration legal?
3. What constitutes the material payload for idempotency comparison?
4. How long is an idempotency record retained?
5. Does a failed optional attachment fail the whole registration or produce a partial customer outcome?
6. Which attachment metadata must be stored in MongoDB?
7. What is the first local attachment-store technology?
8. Which audit events are application-authored versus derived from Temporal visibility/history?
9. How much PII can appear in audit records?
10. What is the HTTP status contract: async `202` only, or a bounded synchronous wait option later?

## mk0 recommendation on unresolved items

For the first stable build, prefer the strictest behavior that is easy to reason about:

- API starts a durable workflow and returns `202 Accepted`.
- Client polls workflow status.
- `Idempotency-Key` is mandatory.
- A requested attachment is part of the command contract; the registration is not `ACTIVE` until it is stored successfully.
- Binary attachment content never enters MongoDB.
- MongoDB contains only attachment metadata/references.
- Audit documents use IDs and classifications; raw request bodies are not logged by default.

## Explicit non-goals

mk0 does not yet solve:

- service catalog execution;
- availability search;
- `ResourceReservation` creation;
- appointment booking;
- quotes;
- work orders;
- Agent reasoning;
- WhatsApp;
- frontend;
- distributed deployment;
- attachment cloud storage;
- authentication/authorization model beyond preserving a boundary for it.

Those enter only after this vertical proves its contracts.
