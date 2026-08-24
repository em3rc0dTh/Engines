# Plan — mk0

## Objective

Certify the first three architecture zones without selecting an application framework:

```text
CTA / controlled input
→ Temporal orchestration
→ PostgreSQL + MongoDB + optional AttachmentStore
```

No coding is authorized yet.

## M0 — Reality / source lock

Deliverables:

- TimeSlots/DataModel Customer source frozen;
- Temporal Workflow/Activity constraints frozen;
- project decision frozen: no required framework in mk0;
- persistence authority frozen: PostgreSQL Customer truth + MongoDB audit/context;
- attachment persistence kept as a separate technology-neutral capability.

## M1 — Architecture lock

Pass when this is unambiguous:

```text
Postman | CLI | minimal harness
→ Temporal RegisterNewCustomer
→ PostgreSQL + MongoDB + optional AttachmentStore
```

Authorities:

- CTA = controlled command entry and observation;
- Temporal = durable sequencing/retry/restart authority;
- PostgreSQL = canonical Customer + registration/idempotency truth;
- MongoDB = execution/audit/workflow context;
- AttachmentStore = optional binary/document authority.

## M2 — RegisterNewCustomer command contract lock

Deliverables:

- framework-agnostic command envelope;
- required/optional TimeSlots Customer fields;
- pre-start structural validation;
- normalization;
- idempotency/fingerprint semantics;
- Temporal start acceptance projection;
- workflow status/result query projection;
- typed failure taxonomy;
- optional attachment ingress/reference contract.

Pass when both a CLI test client and a Postman-compatible adapter could be produced from documentation without changing business semantics.

## M3 — Temporal workflow lock

Deliverables:

- workflow type/ID;
- workflow phases;
- PostgreSQL Activities;
- MongoDB Activities;
- AttachmentStore Activities when needed;
- retry taxonomy;
- idempotent side-effect rules;
- worker restart behavior;
- cross-store consistency;
- query/status projection;
- workflow versioning.

## M4 — Persistence contract lock

### PostgreSQL

- Customer projection from DataModel v3 / TimeSlots;
- registration/idempotency relation;
- attachment-reference relation;
- finalization invariants.

### MongoDB

- execution audit contract;
- workflow context contract;
- PII/logging rules;
- query/index requirements.

### AttachmentStore

- stage/commit/read/integrity contract;
- stable opaque IDs;
- retry safety;
- TTL/reconciliation/orphan behavior;
- physical technology intentionally deferred.

## M5 — Test contract lock

Must cover:

- command/normalization tests;
- CTA pre-start validation tests;
- Temporal workflow tests;
- PostgreSQL integration tests;
- MongoDB integration tests;
- AttachmentStore integration tests when enabled;
- cross-store retry/failure tests;
- CTA disconnect/reconnect observation;
- Temporal worker restart;
- Golden Dataset mapping.

## M6 — Golden Dataset v0

Minimum cases:

- GD-001 minimal valid Customer;
- GD-002 full Customer;
- GD-003 Customer with one attachment;
- GD-004 multiple attachments;
- GD-005 exact idempotent replay;
- GD-006 idempotency conflict;
- GD-007 invalid structural input/no workflow;
- GD-008 transient PostgreSQL failure/recovery;
- GD-009 transient attachment persistence failure/recovery;
- GD-010 permanent attachment integrity mismatch;
- GD-011 Temporal worker restart;
- GD-012 zero scheduling side effects;
- GD-013 CTA disconnect after workflow acceptance then reconnect/query same outcome.

## BUILD AUTHORIZATION GATE

Build may begin only after M0–M6 are approved.

Future first build sequence:

```text
B0  runtime/repository skeleton with no web framework
B1  framework-free command contract + validation library
B2  minimal CTA client/harness (CLI first is acceptable)
B3  Temporal client + worker
B4  PostgreSQL Customer + registration/idempotency persistence
B5  MongoDB execution/audit/context persistence
B6  AttachmentStore implementation selected only if attachment cases are enabled
B7  RegisterNewCustomer Workflow + Activities
B8  optional Postman-compatible thin adapter, only if useful for test ergonomics
B9  full end-to-end runtime verification
B10 failure/retry/restart/CTA reconnect certification
B11 mk0 stable candidate
```

A framework is not a prerequisite for B0–B11.

## mk0 stable definition

```text
controlled CTA command
→ Temporal durable workflow
→ TimeSlots-aligned Customer persistence in PostgreSQL
→ required MongoDB audit/context
→ optional attachment persistence + PostgreSQL reference
→ same durable outcome remains observable after CTA reconnect
```

Only after this is certified should another engine slice or application framework be selected.
