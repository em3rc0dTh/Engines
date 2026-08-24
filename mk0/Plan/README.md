# Plan — mk0

## Objective

Reach a first stable implementation only after the first three architecture zones are frozen:

```text
CTA/API → Orchestration → Persistence
```

No coding is authorized by this plan yet.

## M0 — Reality / source lock

Deliverables:

- TimeSlots/DataModel source frozen;
- NestJS boundary evidence frozen;
- Temporal Workflow/Activity constraints frozen;
- user architecture decision frozen;
- persistence technology correction frozen: PostgreSQL + MongoDB, no SQLite.

Pass when no Services/Scheduler/Agent concern is accidentally pulled into the first workflow.

## M1 — Architecture lock

Pass when this exact path is unambiguous:

```text
Postman
→ NestJS
→ Temporal RegisterNewCustomer
→ PostgreSQL + MongoDB
```

Authorities must be explicit:

- PostgreSQL = Customer/registration/idempotency business truth;
- MongoDB = execution/audit/context + optional documents/attachments;
- Temporal = durable sequencing;
- NestJS = API/application edge.

## M2 — RegisterNewCustomer API contract lock

Deliverables:

- registration endpoint;
- optional attachment ingress endpoint;
- request/response envelope;
- required Customer fields;
- `Idempotency-Key`;
- correlation contract;
- `202 Accepted` semantics;
- workflow status query;
- Customer verification query;
- typed error taxonomy.

Pass when a Postman collection could be written from documentation alone.

## M3 — Temporal workflow lock

Deliverables:

- workflow type/ID;
- phases;
- PostgreSQL Activities;
- MongoDB Activities;
- retry taxonomy;
- idempotency rules;
- worker-restart semantics;
- cross-store consistency policy;
- status projection;
- workflow versioning rules.

Pass when every side effect is outside Workflow code and every retryable Activity has a duplication-prevention strategy.

## M4 — Persistence contract lock

Deliverables:

### PostgreSQL

- Customer relational projection;
- registration/idempotency relation;
- attachment-reference relation;
- indexes/uniqueness/invariants;
- finalization semantics.

### MongoDB

- execution audit collection contract;
- workflow context contract;
- optional attachment ingress/commit contract;
- retention/reconciliation rules;
- PII/logging policy.

### Cross-store

- failure windows;
- recovery semantics;
- distinction from Temporal internal persistence.

Pass when every write has exactly one authority.

## M5 — Test contract lock

Deliverables:

- pure contract tests;
- NestJS boundary tests;
- Temporal workflow tests;
- PostgreSQL integration tests;
- MongoDB integration tests;
- cross-store failure/retry tests;
- worker restart tests;
- Postman runtime tests;
- Golden Dataset mapping.

Pass when every architecture invariant has at least one test that would fail if violated.

## M6 — Golden Dataset v0

Minimum cases:

- GD-001 minimal valid Customer;
- GD-002 full Customer;
- GD-003 Customer with one attachment;
- GD-004 Customer with multiple attachments;
- GD-005 same key/same command replay;
- GD-006 same key/different command conflict;
- GD-007 invalid command/no workflow;
- GD-008 transient PostgreSQL Customer-write failure/recovery;
- GD-009 transient MongoDB attachment failure/recovery;
- GD-010 permanent attachment integrity mismatch;
- GD-011 Temporal worker restart;
- GD-012 proof of zero scheduling side effects.

Pass when expected outcomes are fixed before implementation.

## BUILD AUTHORIZATION GATE

Build may begin only after M0–M6 are approved.

Future build sequence, not authorization today:

```text
B0  repository/runtime skeleton
B1  NestJS CTA/API boundary
B2  Temporal client + worker boundary
B3  PostgreSQL Customer + registration/idempotency persistence
B4  MongoDB execution/audit/context persistence
B5  MongoDB optional attachment/document persistence
B6  RegisterNewCustomer workflow + Activities
B7  Postman collection
B8  end-to-end runtime verification
B9  retry/failure/restart certification
B10 mk0 stable candidate
```

## mk0 stable definition

mk0 stable means this chain is certified:

```text
Postman
→ NestJS
→ Temporal RegisterNewCustomer
→ PostgreSQL canonical Customer
→ MongoDB audit/context
→ optional MongoDB attachment + PostgreSQL reference
→ queryable durable outcome
```

and remains correct under duplicate submission, transient PostgreSQL failure, transient MongoDB failure, Activity retry after side effect and Temporal worker restart.

Only after that should we bring Services Engine, Scheduler Engine or Agent into another slice/version.
