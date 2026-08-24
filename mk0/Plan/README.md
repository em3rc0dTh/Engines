# Plan — mk0

## Objective

Reach a first stable implementation only after the architecture and executable contracts are frozen.

No coding is authorized by this document yet. It defines the sequence and gates that will authorize Build later.

---

## Phase M0 — Reality and source lock

Deliverables:

- identify authoritative TimeSlots/DataModel source;
- identify Temporal design constraints;
- identify NestJS boundary responsibilities;
- capture unresolved assumptions in quarries;
- freeze vocabulary used by mk0.

Gate M0 passes when:

- every important design statement has a source or is explicitly labeled a new design decision;
- no legacy `AvailabilitySlot` semantics are mistaken for future scheduling truth;
- RegisterNewCustomer scope is separated from scheduling.

---

## Phase M1 — Architecture lock

Deliverables:

- system context;
- component responsibilities;
- forbidden couplings;
- authority matrix;
- future extension boundary.

Gate M1 passes when:

- there is exactly one business command path;
- NestJS is boundary, not durable orchestrator;
- Temporal is orchestration authority;
- Persistence has three explicit authorities;
- future Agent/Services/Scheduler can attach without bypassing the API contract.

---

## Phase M2 — RegisterNewCustomer contract lock

Deliverables:

- API routes;
- request/response envelope;
- customer required/optional fields;
- attachment ingress reference model;
- `202 Accepted` semantics;
- workflow status query;
- customer verification query;
- idempotency behavior;
- error taxonomy.

Gate M2 passes when Postman collections/tests could be authored from documentation alone.

---

## Phase M3 — Temporal workflow lock

Deliverables:

- workflow type/ID strategy;
- workflow phases;
- Activity list;
- retry taxonomy;
- idempotent side-effect rules;
- cross-store consistency policy;
- workflow status projection;
- versioning rules.

Gate M3 passes when:

- no side effect remains in Workflow code conceptually;
- every retryable Activity has an idempotency strategy;
- attachment/customer failure windows have explicit outcomes.

---

## Phase M4 — Persistence contract lock

Deliverables:

- Customer MongoDB document contract;
- command receipt contract;
- audit event contract;
- attachment-store contract;
- customer attachment reference contract;
- staging/commit/reference lifecycle;
- index/invariant proposal;
- failure taxonomy;
- PII/logging policy.

Gate M4 passes when each write has exactly one authority and failure behavior is deterministic.

---

## Phase M5 — Test contract lock

Deliverables:

- unit test matrix;
- Temporal workflow tests;
- persistence integration tests;
- restart/retry/failure injection tests;
- Postman contract tests;
- golden dataset mapping.

Gate M5 passes when every invariant has at least one test that would fail if the invariant were violated.

---

## Phase M6 — Golden Dataset v0

Deliverables:

At minimum:

- GD-001 minimal valid customer;
- GD-002 full customer;
- GD-003 customer with one attachment;
- GD-004 customer with multiple attachments;
- GD-005 same idempotency key/same command replay;
- GD-006 same idempotency key/different command conflict;
- GD-007 invalid command/no workflow started;
- GD-008 transient Mongo failure/recovery;
- GD-009 transient attachment failure/recovery;
- GD-010 permanent attachment hash mismatch;
- GD-011 worker restart during workflow;
- GD-012 proof that no Appointment/ResourceReservation is created.

Gate M6 passes when expected outcomes are fixed before implementation.

---

## BUILD AUTHORIZATION GATE

Build can begin only if M0–M6 are closed.

The first build sequence will then be:

```text
B0 repository/runtime skeleton
B1 NestJS API boundary
B2 Temporal client/worker boundary
B3 Mongo customer + command receipt persistence
B4 Mongo audit projection
B5 local attachment store implementation
B6 RegisterNewCustomer workflow
B7 Postman collection
B8 integration/runtime verification
B9 failure/restart verification
B10 mk0 stable candidate
```

This is a future sequence, not authorization to code today.

---

## Release definition for mk0 stable

mk0 stable does not mean the whole agentic architecture is complete.

It means this exact chain is certified:

```text
Postman
→ NestJS
→ Temporal RegisterNewCustomer
→ MongoDB customer persistence
→ MongoDB audit persistence
→ optional local attachment persistence
→ queryable durable outcome
```

And it remains correct under:

- duplicate client submission;
- worker restart;
- transient Mongo failure;
- transient attachment-store failure;
- Activity retry after side effect;
- permanent attachment integrity failure.

Only after that should the next engine slice be selected.
