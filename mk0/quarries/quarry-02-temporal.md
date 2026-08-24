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

`RegisterNewCustomer` belongs in the Orchestration Engine, not in a NestJS controller or CTA-local state machine.

Classification: `PROJECT_DECISION`.

### PostgreSQL/MongoDB/AttachmentStore access belongs behind Activities

Application PostgreSQL writes, MongoDB writes and attachment-store operations are side effects. Workflow code coordinates them; Activities/adapters perform them.

Classification: `DESIGN_DECISION`.

### Activities must tolerate retry

A side effect can succeed while Activity completion acknowledgement is lost. Retry must not create a second Customer, registration outcome, required audit milestone or logical attachment.

Classification: `DESIGN_REQUIREMENT`.

### Workflow input remains bounded

Large optional attachment bytes should not become ordinary Temporal history payloads.

The canonical interaction uses an opaque ingress/reference identity while a separate technology-neutral `AttachmentStore` capability owns binary/document object lifecycle.

The physical AttachmentStore technology remains a Build decision.

Classification: `DESIGN_DECISION` for the capability boundary + `BUILD_REQUIREMENT` for physical selection.

### Workflow identity reinforces business-scoped idempotency

Recommended Workflow ID:

```text
register-customer:{businessSlug}:{hash(idempotencyKey)}
```

Authoritative session scope:

```text
(operation, businessSlug, idempotencyKeyHash)
```

The normalized material initial-start snapshot is fingerprinted for exact replay/conflict detection. Later `ProvideCustomerData` Updates use their own stable input identities and do not rewrite the original start fingerprint.

Classification: `DESIGN_DECISION`.

### Temporal history is not MongoDB audit

Temporal history is orchestration/runtime history. MongoDB `execution_audit` is an application-facing audit/context projection with its own schema and PII policy.

Applicable MongoDB success-gating milestones must be present before a registration can be reported successful; MongoDB still does not replace Temporal Event History.

Classification: `PROJECT_DECISION` + `DESIGN_REQUIREMENT`.

### Temporal PostgreSQL is not Customer PostgreSQL

If Temporal uses PostgreSQL internally, that schema/database is infrastructure state. Engines application Customer/registration tables remain a distinct business authority.

Classification: `DESIGN_REQUIREMENT`.

### Workflow replay compatibility is an invariant; the exact mechanism is Build-time

A deployed Workflow change must preserve deterministic replay/version compatibility for executions whose Event History was created by an older implementation.

The exact Temporal SDK/version and SDK-specific versioning mechanism are selected during authorized Build and must satisfy that invariant.

Classification: `DESIGN_REQUIREMENT` + `BUILD_REQUIREMENT`.

## Open Build-time validations

- exact Temporal SDK language/version;
- Workflow ID reuse policy details allowed by the selected SDK/runtime;
- Activity retry policy values;
- Activity timeouts/heartbeats;
- payload converter/codec choices;
- local Temporal topology;
- Temporal internal persistence topology/schema isolation;
- visibility/search attribute strategy;
- SDK-specific workflow versioning/replay mechanism;
- AttachmentStore physical technology when attachment cases are enabled.
