# Quarry 02 — Temporal

## Status

**EXTRACTED / DESIGN CONSTRAINTS IDENTIFIED**

## Source

Official Temporal documentation:

https://docs.temporal.io/

## Source facts relevant to mk0

Temporal is designed for durable execution so workflows can resume after failures/restarts rather than relying on the lifetime of one HTTP request/process.

Classification: `SOURCE_FACT`.

Temporal distinguishes Workflow orchestration logic from side-effecting Activities.

Classification: `SOURCE_FACT`.

## mk0 design consequences

### Temporal owns durable sequencing

The `RegisterNewCustomer` state machine belongs in the Orchestration Engine, not in a NestJS controller.

Classification: `PROJECT_DECISION`.

### Persistence belongs behind Activities

MongoDB writes and local attachment-store operations are side effects and therefore belong in Activities/adapters rather than Workflow code.

Classification: `DESIGN_DECISION` grounded in Temporal workflow semantics.

### Activities must tolerate retry

A persistence Activity can perform its write and then lose its completion acknowledgement. Re-execution must not create a second customer/attachment.

Classification: `DESIGN_REQUIREMENT`.

### Workflow input should remain bounded

Large binary attachments should not be treated as ordinary Workflow input/history payloads. mk0 therefore introduces opaque attachment ingress references and a commit Activity.

Classification: `DESIGN_PROPOSAL`, to be validated against final Build-time Temporal payload/converter choices.

### Workflow identity should reinforce idempotency

Recommended Workflow ID:

```text
register-customer:{businessSlug}:{hash(Idempotency-Key)}
```

Classification: `DESIGN_PROPOSAL`.

### Temporal history is not the application audit database

Temporal history proves/orchestrates execution. The user requirement separately calls for a log in MongoDB. mk0 therefore treats the Mongo audit log as an application projection with its own retention/query/PII rules rather than copying the full Temporal history.

Classification: `PROJECT_DECISION`.

## Open Build-time validations

- exact TypeScript SDK versions;
- Workflow ID reuse policy chosen for completed/failed executions;
- retry policy values by Activity;
- timeouts/heartbeats for attachment operations;
- payload codec/data converter choices;
- local Temporal development topology;
- visibility/search attribute strategy;
- Workflow versioning strategy before production history exists.

These remain `UNKNOWN` until Build planning selects exact runtime versions and profiles.
