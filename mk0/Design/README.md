# Design — mk0

This folder freezes the design of the first stable vertical before code exists.

## mk0 architecture scope

```text
CTA / API            → Postman + NestJS
Orchestration Engine → Temporal
Persistence          → PostgreSQL + MongoDB
```

Everything below must remain inside those first three architecture zones.

## Design package

1. [`01-system-architecture.md`](01-system-architecture.md)
   - component responsibilities;
   - authority boundaries;
   - sequence of control;
   - forbidden couplings.

2. [`02-register-new-customer-contract.md`](02-register-new-customer-contract.md)
   - API command contract;
   - request/response envelope;
   - normalization;
   - idempotency;
   - error taxonomy.

3. [`03-temporal-workflow.md`](03-temporal-workflow.md)
   - workflow state machine;
   - Activity boundaries;
   - retry/recovery semantics;
   - workflow identity;
   - observability contract.

4. [`04-persistence-boundaries.md`](04-persistence-boundaries.md)
   - PostgreSQL Customer/registration authority;
   - MongoDB execution/audit/context authority;
   - optional attachment/document authority;
   - cross-store consistency.

5. [`05-mk0-persistence-profile.md`](05-mk0-persistence-profile.md)
   - logical PostgreSQL relational profile;
   - logical MongoDB document/audit profile;
   - optional attachment lifecycle;
   - crash-window recovery;
   - explicit separation from Temporal's own infrastructure persistence.

## Design acceptance gate

Design is considered closed only when:

- Postman has exactly one legal entry through NestJS.
- NestJS stops at the application/orchestration boundary.
- Temporal owns durable `RegisterNewCustomer` sequencing.
- Temporal Workflow code has no direct persistence side effects.
- PostgreSQL is the canonical Customer + registration/idempotency authority.
- MongoDB is the execution/audit/context/document authority.
- Optional attachments are persisted without making PostgreSQL a binary-file store.
- Cross-store failure/retry behavior is deterministic.
- Idempotency prevents duplicate Customer creation.
- `RegisterNewCustomer` cannot create scheduling entities implicitly.
- Tests can be derived from Design without looking at implementation.
- Golden Dataset expectations match these authorities.

## Rule

No implementation is authorized by this Design package. When Build begins later, runtime evidence may force changes, but Design and quarry evidence must be updated before code silently diverges.
