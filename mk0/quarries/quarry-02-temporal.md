# Quarry 02 — Temporal

## Status

**EXTRACTED / DESIGN CONSTRAINTS IDENTIFIED**

## Source

Official Temporal documentation:

https://docs.temporal.io/

## Source facts relevant to mk0

Temporal provides durable execution so workflow progress can survive worker/process failures.

Temporal separates Workflow orchestration logic from side-effecting Activities.

Classification: `SOURCE_FACT`.

## mk0 design consequences

### Temporal owns durable sequencing

`RegisterNewCustomer` belongs in the Orchestration Engine, not in a NestJS controller.

Classification: `PROJECT_DECISION`.

### PostgreSQL/MongoDB access belongs behind Activities

Application PostgreSQL writes and MongoDB writes are side effects. Workflow code coordinates them; Activities/adapters perform them.

Classification: `DESIGN_DECISION`.

### Activities must tolerate retry

A side effect can succeed while Activity completion acknowledgement is lost. Retry must not create a second Customer, audit milestone or logical attachment.

Classification: `DESIGN_REQUIREMENT`.

### Workflow input remains bounded

Large optional attachment bytes should not become ordinary Temporal history payloads. The command uses an opaque ingress reference while a MongoDB-backed attachment capability owns the document object.

Classification: `DESIGN_PROPOSAL` pending final Build-time payload/attachment implementation.

### Workflow identity reinforces idempotency

Recommended ID:

```text
register-customer:{businessSlug}:{hash(Idempotency-Key)}
```

Classification: `DESIGN_PROPOSAL`.

### Temporal history is not MongoDB audit

Temporal history is orchestration/runtime history. MongoDB `execution_audit` is an application-facing audit/context projection with its own schema/retention/PII policy.

Classification: `PROJECT_DECISION`.

### Temporal PostgreSQL is not Customer PostgreSQL

If Temporal uses PostgreSQL internally, that schema/database is infrastructure state. Engines application Customer/registration tables remain a distinct business authority.

Classification: `DESIGN_REQUIREMENT`.

## Open Build-time validations

- exact Temporal TypeScript SDK version;
- Workflow ID reuse policy;
- Activity retry policy values;
- Activity timeouts/heartbeats;
- payload converter/codec choices;
- local Temporal topology;
- Temporal internal persistence topology/schema isolation;
- visibility/search attribute strategy;
- workflow versioning strategy.
