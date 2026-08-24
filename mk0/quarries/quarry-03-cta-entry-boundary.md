# Quarry 03 — CTA / Controlled Entry Boundary

## Status

**PROJECT DECISION LOCKED / DESIGN BOUNDARY IDENTIFIED**

## Project decision

mk0 does not select an application framework.

The first CTA may be:

- Postman;
- CLI;
- a minimal executable test harness using the Temporal client contract.

Classification: `PROJECT_DECISION`.

## Boundary rule

The CTA exists only to turn external test input into a controlled `RegisterNewCustomer` command and to observe/query the durable result.

Conceptual flow:

```text
external test input
→ structural validation
→ normalized command
→ Temporal start
→ workflowId
→ later status/result query
```

The CTA is not the durable business-process engine.

## Structural validation before Temporal

Reject before Workflow start when the command is unusable structurally, including:

- malformed envelope;
- missing businessSlug;
- missing Customer type/name;
- missing idempotency identity;
- missing required contact locator;
- malformed attachment reference;
- forbidden scheduling/service fields.

A rejected command creates no Customer, no committed attachment and no business workflow side effect.

Classification: `DESIGN_REQUIREMENT`.

## Durable validation after acceptance

Validation that needs persisted state or business policy may be executed durably through Workflow/Activities after Temporal accepts the command.

The Build must keep this split explicit so input validation is not duplicated inconsistently.

## Continuity rule

A CTA connection/session is disposable.

Required proof:

```text
CTA starts workflow
→ receives workflowId
→ CTA disconnects/stops
→ Temporal keeps executing
→ CTA reconnects later
→ queries workflowId
→ sees same durable outcome
```

Therefore the architecture does not depend on a permanently open HTTP/TCP connection.

Classification: `DESIGN_REQUIREMENT`.

## Forbidden CTA behavior

```text
CTA → PostgreSQL direct write
CTA → MongoDB direct write
CTA → final attachment commit bypassing Temporal
CTA → business retry loops
CTA → hidden scheduling/service side effects
```

## Future framework rule

A future HTTP framework may be introduced only as a replaceable transport adapter around this command/start/query contract.

It must not:

- become orchestration authority;
- own Customer persistence sequencing;
- bypass Temporal;
- change canonical command semantics;
- create a second business path.

## Build-time unknowns

Still intentionally open:

- whether first proof uses CLI or Postman-compatible adapter;
- exact Temporal SDK/client language/version;
- whether Postman talks through a tiny HTTP/gRPC bridge or is deferred until after CLI proof;
- authentication for future external callers;
- transport-specific status/error mapping.

These are Build choices, not architecture choices.
