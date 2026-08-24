# Build — mk0

## Status

**NOT AUTHORIZED YET**

This directory is intentionally documentation-only.

No application framework is selected or required for mk0.

## Future build target

When authorized, Build must realize only:

```text
CTA channel
   Postman / CLI first
        ↓
CTA Adapter contract
        ↓
FULL TEMPORAL ORCHESTRATION ENGINE
   Temporal Service
   Workflow
   Task Queue
   Worker
   Activities
   durable Event History
   retry/recovery/query/update semantics
        ↓
Persistence Activities
   ├── PostgreSQL → Customer + registration/idempotency truth
   ├── MongoDB    → execution/audit/workflow context
   └── AttachmentStore → optional binary/document persistence
```

## Non-negotiable Temporal rule

mk0 must not use:

- an in-process fake Workflow engine;
- a hand-written state-machine loop presented as Temporal;
- database flags as a substitute for Temporal Workflow state;
- a CTA process that must remain alive for Workflow progress;
- a reduced custom orchestrator that bypasses Task Queue/Worker semantics.

The first proof must use a real Temporal Service, real Workflow execution, real Task Queue dispatch, real Worker execution and real Activity retry/recovery behavior.

## CTA rule

The channel and adapter remain replaceable.

```text
Postman
CLI
Form later
WhatsApp later
Telegram later
API/Webhook later
...
    ↓
CTA Adapter
    ↓
Temporal
```

A CLI may be the first executable CTA Adapter because it can speak to Temporal through the official client/SDK without introducing a web framework.

Postman can be proven through a thin transport-compatible CTA Adapter. That adapter remains transport only and cannot own orchestration or persistence sequencing.

A structurally legal registration session may start with incomplete Customer business data. Customer completeness is resolved by the versioned `RegistrationPolicy` inside Temporal, producing durable waiting/Update behavior when required.

## Expected logical boundaries

```text
contracts/
  register-new-customer/

cta/
  adapter-contract/
  cli/
  postman-transport/          later in mk0 proof

orchestration/
  temporal/
    workflows/
    activities/
    workers/
    task-queues/

persistence/
  postgres/
    customer/
    registration-command/
    attachment-reference/

  mongo/
    execution-audit/
    workflow-context/

  attachments/
    attachment-store-adapter/
```

This is conceptual and does not authorize scaffolding yet.

## Frozen constraints

- no web framework dependency in the architecture;
- all channels converge on one CTA Adapter contract;
- CTA validates structural/session input before Temporal start, not final Customer completeness;
- CTA/adapter never writes business persistence directly;
- full Temporal owns durable sequencing/retries/recovery;
- real Task Queue/Worker semantics are required;
- Workflow code calls no DB/file/network driver directly;
- Activities are retry-safe/idempotent;
- registration session identity is business-scoped by `(operation, businessSlug, idempotencyKeyHash)`;
- normalized material initial-start input is fingerprinted for exact replay/conflict detection;
- later `ProvideCustomerData` Updates evolve Workflow state without rewriting the initial-start fingerprint;
- PostgreSQL is canonical Customer + registration/idempotency truth;
- Customer persistence follows approved DataModel v3 / TimeSlots semantics;
- MongoDB stores execution/audit/workflow context, not a shadow Customer truth;
- required MongoDB success-gating milestones must exist before `CREATED` or `ALREADY_EXISTS` is reported as successful;
- exhausted mandatory-audit failure cannot be converted into success;
- attachments use a separate persistence contract;
- CTA disconnect must not stop an accepted Workflow;
- Worker restart must not lose accepted Workflow progress;
- CTA reconnect/query must resolve the same durable outcome;
- RegisterNewCustomer creates zero scheduling side effects.

## Authorization record

When Build is approved, record:

- approval date;
- approved Design commit;
- approved Golden Dataset version;
- Temporal Service topology;
- namespace;
- Task Queue/Worker topology;
- Temporal SDK language/version;
- PostgreSQL topology;
- MongoDB topology;
- chosen AttachmentStore technology if attachment cases are enabled;
- chosen first CTA Adapter implementation;
- Postman transport decision;
- exact Build ticket sequence.

Until then:

> **No code in Build.**
