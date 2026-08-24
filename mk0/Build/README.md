# Build — mk0

## Status

**NOT AUTHORIZED YET**

This directory is intentionally documentation-only.

No NestJS app, Temporal worker, PostgreSQL schema, MongoDB implementation, Docker runtime or Postman collection is authorized until the mk0 documentation gates close.

## Future build target

When explicitly authorized, Build must realize only:

```text
1. CTA / API
   Postman → NestJS

2. Orchestration
   Temporal → RegisterNewCustomer

3. Persistence
   PostgreSQL → Customer + registration/idempotency truth
   MongoDB    → execution/audit/context + optional attachments/documents
```

Services Engine, Scheduler Engine, Integration Engine and Agent are not part of this Build target.

## Expected future logical boundaries

This is a conceptual package map, not code/scaffolding:

```text
application-edge/
  nest-api/

orchestration/
  temporal/
    workflows/
    activities/

persistence/
  postgres/
    customer/
    registration-command/
    attachment-reference/

  mongo/
    execution-audit/
    workflow-context/
    attachments/

contracts/
  register-new-customer/
```

## Frozen constraints

- Postman never accesses databases directly.
- NestJS never implements a second direct registration path.
- Temporal owns durable sequencing.
- Temporal Workflow code calls no PostgreSQL/MongoDB drivers directly.
- Activities are retry-safe and idempotent.
- PostgreSQL is canonical Customer/registration truth.
- MongoDB audit/context is not Customer truth.
- Optional attachment/document bytes do not become PostgreSQL Customer columns.
- PostgreSQL contains opaque attachment references where business linkage is required.
- Temporal's own internal persistence is isolated from application PostgreSQL schemas.
- RegisterNewCustomer creates no Appointment or ResourceReservation.
- Tests and golden cases define success before implementation.

## Authorization record

When Build is approved, update this file with:

- approval date;
- approved Design commit;
- approved Golden Dataset version;
- PostgreSQL application topology;
- Temporal infrastructure topology;
- MongoDB topology;
- exact attachment implementation selected for MongoDB;
- exact B0–B10 ticket sequence.

Until then:

> **No code in Build.**
