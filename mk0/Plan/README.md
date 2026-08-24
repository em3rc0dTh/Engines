# Plan — mk0

## Objective

Certify the first three architecture zones without selecting an application framework:

```text
CTA channel
→ CTA Adapter
→ full Temporal Orchestration Engine
→ PostgreSQL + MongoDB + optional AttachmentStore
```

The first proof is not just one-shot persistence. It is a durable interactive registration session that can ask for missing information, receive later input, check existing-customer policy and then persist the correct outcome.

No coding is authorized yet.

## M0 — Reality / source lock

Deliverables:

- TimeSlots/DataModel Customer source frozen;
- BusinessProfile/WorkflowProfile role in required-field policy recognized;
- Temporal Workflow/Activity/Worker/Task Queue/message-passing constraints frozen;
- project decision frozen: no required web framework in mk0;
- omnichannel CTA Adapter boundary frozen;
- persistence authority frozen: PostgreSQL Customer truth + MongoDB interaction/audit/context;
- AttachmentStore kept as a separate technology-neutral capability.

## M1 — Architecture lock

Pass when this is unambiguous:

```text
Postman / CLI now
Form / WhatsApp / Telegram / API later
        ↓
CTA Adapter
        ↓
Full Temporal RegisterNewCustomer orchestration
        ↓
PostgreSQL + MongoDB + optional AttachmentStore
```

Authorities:

- CTA channel = external input/output;
- CTA Adapter = channel mapping + Temporal start/query/update boundary;
- Temporal = durable session state, message handling, sequencing, retries, Event History, Task Queues/Workers and recovery;
- PostgreSQL = canonical Customer/registration truth;
- MongoDB = application interaction/audit/context;
- AttachmentStore = optional binary/document authority.

## M2 — Interactive RegisterNewCustomer contract lock

Deliverables:

- framework-agnostic start/session envelope;
- partial Customer draft support;
- versioned RegistrationPolicy contract;
- policy-driven required fields;
- `GetRegistrationState` Query contract;
- `ProvideCustomerData` Update contract;
- business-scoped session identity `(operation, businessSlug, idempotencyKeyHash)`;
- normalized initial-start fingerprint semantics;
- same-session conflicting-start behavior;
- later Update identity and retry semantics independent from the frozen start fingerprint;
- normalization rules;
- duplicate classification policy (`HARD_UNIQUE`, `SOFT_MATCH`, `NON_UNIQUE`);
- terminal `CREATED` vs `ALREADY_EXISTS` outcomes;
- optional attachment ingress/reference contract;
- channel-neutral state/response projection.

Pass when Postman and CLI can conduct the same multi-step registration without business logic living in either CTA, and a repeated start can be distinguished deterministically from later Workflow Updates.

## M3 — Temporal orchestration lock

Deliverables:

- real Temporal Service topology assumptions;
- Workflow type/ID/session idempotency;
- Task Queue/Worker responsibility;
- `loadRegistrationPolicy` Activity;
- waiting-for-data phases;
- Query/Update handlers;
- PostgreSQL duplicate-check/create Activities;
- MongoDB interaction/audit Activity;
- AttachmentStore Activities when needed;
- retry/backoff/timeout taxonomy;
- Worker restart behavior while waiting and after side effects;
- CTA disconnect/reconnect behavior;
- cross-store consistency;
- Workflow versioning/replay strategy;
- Temporal Web UI/visibility evidence requirements.

Pass when missing-information collection, duplicate detection and persistence are visibly controlled by the same durable Temporal Workflow.

## M4 — Persistence contract lock

### PostgreSQL

- Customer projection from DataModel v3 / TimeSlots;
- registration/session relation;
- business-scoped idempotency tuple;
- immutable initial-start fingerprint storage/comparison;
- policy-defined duplicate lookup rules;
- attachment-reference relation;
- finalization invariants.

### MongoDB

- interaction/audit event contract;
- Workflow context contract;
- event deduplication identity;
- explicit success-gating audit milestones;
- rule that missing required audit cannot be reported as successful registration;
- typed failure behavior when the audit store is unavailable beyond retry policy;
- PII/logging/retention rules;
- query/index requirements.

### AttachmentStore

- stage/commit/read/integrity contract;
- stable opaque IDs;
- retry safety;
- TTL/reconciliation/orphan behavior;
- physical technology intentionally deferred.

## M5 — Test contract lock

Must cover:

- partial-intent start;
- Query missing fields;
- multi-round ProvideCustomerData Updates;
- repeated Update delivery/idempotency;
- exact start replay with same initial fingerprint;
- same-business/same-key conflicting initial-start snapshot;
- cross-business opaque-key reuse does not collide;
- policy version lock;
- hard duplicate existing-Customer result;
- soft duplicate behavior;
- new Customer creation;
- success-gating MongoDB audit evidence;
- no successful completion when required audit cannot be persisted;
- Task Queue/Worker execution proof;
- CTA disconnect/reconnect while waiting;
- Worker restart while waiting;
- PostgreSQL/MongoDB/AttachmentStore failure tests;
- zero scheduling side effects;
- Golden Dataset mapping.

## M6 — Golden Dataset v0

Minimum cases include:

- GD-001 minimal valid Customer;
- GD-002 full Customer;
- GD-003 Customer with one attachment;
- GD-004 multiple attachments;
- GD-005 exact start/session replay;
- GD-006 same-business same-session conflicting initial start snapshot;
- GD-007 invalid start envelope/no Workflow;
- GD-008 transient PostgreSQL failure/recovery;
- GD-009 transient attachment persistence failure/recovery;
- GD-010 permanent attachment integrity mismatch;
- GD-011 Temporal Worker restart;
- GD-012 zero scheduling side effects;
- GD-013 CTA disconnect/reconnect continuity;
- GD-014 real Temporal Service + Task Queue + Worker proof;
- GD-015 intent-only start → WAITING_FOR_REQUIRED_DATA;
- GD-016 multi-round data collection through Updates;
- GD-017 policy-defined hard duplicate → ALREADY_EXISTS / no second Customer;
- GD-018 policy-defined soft duplicate → non-silent possible-duplicate outcome.

The Golden Dataset profile must additionally encode:

- business-scoped idempotency;
- frozen initial-start fingerprint vs later Updates;
- mandatory audit-before-success expectations;
- current CTA proof surfaces without silently expanding deferred channels.

## BUILD AUTHORIZATION GATE

Build may begin only after M0–M6 are approved.

Future first build sequence:

```text
B0  runtime/repository skeleton with no web framework
B1  versioned RegistrationPolicy + canonical interaction contracts
B2  full Temporal local/runtime topology + Web UI
B3  first CTA Adapter (CLI is acceptable for core proof)
B4  Temporal Worker + Task Queue + interactive RegisterNewCustomer Workflow
B5  PostgreSQL policy/duplicate lookup + Customer persistence Activities
B6  MongoDB interaction/audit Activities
B7  AttachmentStore implementation if attachment cases are enabled
B8  complete waiting/query/update/duplicate/persistence orchestration
B9  Postman-compatible CTA Adapter
B10 end-to-end laboratory verification
B11 failure/retry/Worker-restart/CTA-reconnect certification
B12 mk0 stable candidate
```

No web framework is a prerequisite.

## mk0 stable definition

```text
Postman or CLI starts RegisterNewCustomer intent
→ real Temporal Workflow loads versioned policy
→ Workflow asks/exposes missing data
→ CTA provides data to same Workflow
→ Temporal orchestrates duplicate lookup
→ ALREADY_EXISTS or CREATED deterministically
→ PostgreSQL shows canonical Customer result
→ MongoDB shows all required success-gating interaction/audit evidence
→ Temporal Web UI shows the orchestration path
→ CTA/Worker restart does not lose durable state
→ retries never create a second logical Customer, input, audit milestone or attachment
```

Only after this is certified should another workflow/engine slice or application framework be selected.
