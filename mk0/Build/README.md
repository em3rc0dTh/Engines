# Build — mk0

## Status

**AUTHORIZED — STAGED B0–B6**

Approval record:

```text
mk0/Plan/pre-build-approval-2026-08-24.md
```

`B7 AttachmentStore` remains explicitly gated until attachment technology + synthetic fixtures + expected SHA-256 values are frozen.

No application/web framework is selected or required for mk0.

## Authorized build target

```text
CTA channel
   CLI first
   Postman transport later
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
   └── AttachmentStore → B7 gated
```

## Authorized sequence

```text
B0  runtime/repository skeleton                         ← ACTIVE
B1  canonical contracts + versioned RegistrationPolicy
B2  real Temporal runtime/topology + visibility proof
B3  first CLI CTA Adapter
B4  Worker + Task Queue + interactive RegisterNewCustomer
B5  PostgreSQL duplicate/customer/registration Activities
B6  MongoDB mandatory interaction/audit Activities
B7  AttachmentStore                                    ← GATED
```

Build must not skip forward by embedding later business logic inside an earlier stage.

## B0 frozen runtime choice

```text
Language/runtime:        TypeScript / Node.js 20+
Temporal TypeScript SDK: 1.22.0
Temporal local runtime:  official Temporal CLI development server
Temporal endpoint:       localhost:7233
Temporal Web UI:         localhost:8233
Namespace:               default for B0 laboratory proof
Task Queue:              engines-mk0-registration
PostgreSQL:              Docker service
MongoDB:                 Docker service
Web/application framework: none
```

B0 proves runtime boundaries, not Customer semantics.

## Non-negotiable Temporal rule

mk0 must not use:

- an in-process fake Workflow engine;
- a hand-written state-machine loop presented as Temporal;
- database flags as a substitute for Temporal Workflow state;
- a CTA process that must remain alive for Workflow progress;
- a reduced custom orchestrator that bypasses Task Queue/Worker semantics.

The proof must use a real Temporal Service, real Workflow execution, real Task Queue dispatch, real Worker execution and real Activity retry/recovery behavior.

## CTA rule

The channel and adapter remain replaceable.

```text
CLI now
Postman next
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

The CLI may speak to Temporal through the official client SDK while preserving the canonical CTA contract. It does not become Workflow authority.

A structurally legal registration session may start with incomplete Customer business data. Customer completeness is resolved by the versioned `RegistrationPolicy` inside Temporal.

## Runtime/repository boundaries

```text
mk0/runtime/
  package.json
  tsconfig.json
  .env.example
  docker-compose.yml
  src/
    config/
    orchestration/
      temporal/
        workers/
        workflows/
        activities/
    cta/
      cli/
    persistence/
      postgres/
      mongo/
  scripts/
  evidence/
```

B0 may create these boundaries and connectivity smoke probes. Business workflow behavior belongs to B1+.

## Frozen constraints

- no web framework dependency in the architecture;
- all channels converge on one CTA Adapter contract;
- CTA validates structural/session input before Temporal start, not final Customer completeness;
- CTA/adapter never writes business persistence directly;
- Temporal owns durable sequencing/retries/recovery;
- real Task Queue/Worker semantics are required;
- Workflow code calls no DB/file/network driver directly;
- Activities are retry-safe/idempotent;
- registration session identity is business-scoped by `(operation, businessSlug, idempotencyKeyHash)`;
- normalized material initial-start input is fingerprinted for exact replay/conflict detection;
- later `ProvideCustomerData` Updates evolve Workflow state without rewriting the initial-start fingerprint;
- PostgreSQL is canonical Customer + registration/idempotency truth;
- MongoDB stores execution/audit/workflow context, not a shadow Customer truth;
- required MongoDB success-gating milestones must exist before `CREATED` or `ALREADY_EXISTS` is reported as successful;
- exhausted mandatory-audit failure cannot be converted into success;
- attachments use a separate persistence contract and remain gated in B7;
- CTA disconnect must not stop an accepted Workflow;
- Worker restart must not lose accepted Workflow progress;
- CTA reconnect/query must resolve the same durable outcome;
- RegisterNewCustomer creates zero scheduling side effects.

## B0 completion rule

B0 is not complete because files exist.

It completes only when runtime evidence proves:

```text
Node runtime/version observed
Temporal Service reachable at configured endpoint
Temporal Web UI reachable
real Worker polls engines-mk0-registration
real B0 smoke Workflow executes through Temporal
PostgreSQL connectivity succeeds
MongoDB connectivity succeeds
runtime can stop/restart reproducibly
no Customer/Appointment business mutation exists
```

Until that evidence exists:

> **B0 = IMPLEMENTED IN REPOSITORY / RUNTIME UNPROVEN.**
