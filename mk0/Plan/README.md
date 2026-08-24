# Plan — mk0

## Objective

Certify the first three architecture zones without selecting an application framework:

```text
CTA channel
→ CTA Adapter
→ full Temporal Orchestration Engine
→ PostgreSQL + MongoDB + optional AttachmentStore
```

No coding is authorized yet.

## M0 — Reality / source lock

Deliverables:

- TimeSlots/DataModel Customer source frozen;
- Temporal durable execution / Workflow / Activity / Worker / Task Queue constraints frozen;
- project decision frozen: no required web framework in mk0;
- project decision frozen: omnichannel CTA Adapter boundary;
- persistence authority frozen: PostgreSQL Customer truth + MongoDB audit/context;
- attachment persistence kept as a separate technology-neutral capability.

## M1 — Architecture lock

Pass when this is unambiguous:

```text
Postman / CLI now
Form / MCP / WhatsApp / Telegram / API later
        ↓
CTA Adapter
        ↓
Full Temporal RegisterNewCustomer orchestration
        ↓
PostgreSQL + MongoDB + optional AttachmentStore
```

Authorities:

- CTA channel = raw external input/output;
- CTA Adapter = structural validation + canonical command mapping + Temporal start/query boundary;
- Temporal = durable sequencing, Event History, retries, Task Queues/Workers and recovery;
- PostgreSQL = canonical Customer + registration/idempotency truth;
- MongoDB = execution/audit/workflow context;
- AttachmentStore = optional binary/document authority.

## M2 — RegisterNewCustomer command contract lock

Deliverables:

- framework-agnostic canonical command envelope;
- required/optional TimeSlots Customer fields;
- pre-start structural validation;
- normalization;
- idempotency/fingerprint semantics;
- channel metadata policy;
- Temporal Workflow start acceptance projection;
- Workflow Query/status/result projection;
- typed failure taxonomy;
- optional attachment ingress/reference contract.

Pass when a CLI CTA Adapter and a Postman-compatible CTA Adapter can both be produced from documentation without changing business semantics.

## M3 — Temporal orchestration lock

Deliverables:

- Temporal Service topology assumptions;
- Workflow type/ID;
- Task Queue/Worker responsibility;
- Workflow phases;
- PostgreSQL Activities;
- MongoDB Activities;
- AttachmentStore Activities when needed;
- retry/backoff/timeout taxonomy;
- idempotent side-effect rules;
- Worker restart behavior;
- CTA disconnect/reconnect behavior;
- cross-store consistency;
- Query/status projection;
- Signals/Updates reserved interaction contract;
- Workflow versioning/replay strategy;
- visibility/operational evidence requirements.

Pass when the design uses real Temporal semantics instead of recreating orchestration in the CTA or database layer.

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
- CTA Adapter pre-start validation tests;
- Temporal Workflow tests;
- Task Queue/Worker execution proof;
- PostgreSQL integration tests;
- MongoDB integration tests;
- AttachmentStore integration tests when enabled;
- cross-store retry/failure tests;
- CTA disconnect/reconnect observation;
- Temporal Worker restart;
- Golden Dataset mapping.

## M6 — Golden Dataset v0

Minimum cases:

- GD-001 minimal valid Customer;
- GD-002 full Customer;
- GD-003 Customer with one attachment;
- GD-004 multiple attachments;
- GD-005 exact idempotent replay;
- GD-006 idempotency conflict;
- GD-007 invalid structural input/no Workflow;
- GD-008 transient PostgreSQL failure/recovery;
- GD-009 transient attachment persistence failure/recovery;
- GD-010 permanent attachment integrity mismatch;
- GD-011 Temporal Worker restart;
- GD-012 zero scheduling side effects;
- GD-013 CTA disconnect after Workflow acceptance then reconnect/query same outcome;
- GD-014 prove the path uses a real Temporal Service + Task Queue + Worker, not an in-process fake orchestrator.

## BUILD AUTHORIZATION GATE

Build may begin only after M0–M6 are approved.

Future first build sequence:

```text
B0  runtime/repository skeleton with no web framework
B1  canonical RegisterNewCustomer command + validation contract
B2  full Temporal local/runtime topology
B3  first CTA Adapter implementation (CLI is acceptable for core proof)
B4  Temporal Worker + Task Queue + RegisterNewCustomer Workflow shell
B5  PostgreSQL Customer + registration/idempotency persistence Activities
B6  MongoDB execution/audit/context Activities
B7  AttachmentStore implementation if attachment cases are enabled
B8  complete RegisterNewCustomer orchestration
B9  Postman-compatible CTA Adapter for channel proof
B10 end-to-end runtime verification
B11 failure/retry/Worker-restart/CTA-reconnect certification
B12 mk0 stable candidate
```

No web framework is a prerequisite for B0–B12.

## mk0 stable definition

```text
Postman or CLI CTA
→ CTA Adapter
→ real Temporal Service / Workflow / Task Queue / Worker / Activities
→ TimeSlots-aligned Customer persistence in PostgreSQL
→ required MongoDB audit/context
→ optional attachment persistence + PostgreSQL reference
→ same durable outcome remains observable after CTA reconnect
```

Only after this is certified should another engine slice or application framework be selected.
