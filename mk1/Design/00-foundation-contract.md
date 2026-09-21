# MK1 Foundation Contract — Blocks 1 / 2 / 6

## Status

**G0 NORMATIVE FOUNDATION CONTRACT**

This contract freezes what MK1 may safely assume from MK0 without overstating future platform capabilities.

MK0 proved a reusable architecture with two executable business specimens. MK1 must preserve that architecture while extending it through independently certified engines and workflows.

---

## 1. CTA / Channel Boundary Contract

### Frozen invariants

A CTA/channel adapter may:

- parse channel-specific input;
- validate transport structure;
- identify correlation/session metadata;
- normalize data into a canonical operation/update;
- start/query/update an existing Temporal Workflow;
- stage or reference attachments through the approved AttachmentStore boundary;
- render canonical workflow state/results back into channel-specific presentation.

A CTA/channel adapter must not:

- write canonical business tables directly;
- own durable workflow phase/state;
- decide business completeness independently of the workflow/policy;
- duplicate Services or Scheduler business rules;
- implement side-effect retries that belong to Temporal Activities;
- become the source of truth for Customer, Appointment, Service or Reservation state.

### Certified implementations carried forward

- CLI adapter path;
- HTTP/Postman path;
- Lab Console using the same orchestration boundary.

### Open implementations

Telegram, WhatsApp, email, voice/IVR, mobile and web-chat adapters remain independent future certifications. Their absence does not invalidate the CTA architecture already proven.

---

## 2. Orchestration Contract

Temporal remains the durable orchestration authority.

### Temporal owns

- Workflow identity;
- Event History;
- deterministic durable state;
- Query/Update/Signal interaction where defined;
- Task Queue dispatch;
- Workflow and Child Workflow execution;
- Activity coordination;
- retries/backoff/timeouts;
- durable waiting/timers;
- replay/recovery after process loss;
- workflow-visible orchestration failures;
- cancellation/compensation only when explicitly designed for a workflow.

### Workflow code must not

- directly call PostgreSQL, MongoDB, object storage or external network SDKs;
- make transport-specific presentation decisions;
- assume one process owns durable execution;
- bypass final business invariants that belong to authoritative persistence.

### Certified Workflow Library entries

- `RegisterNewCustomer`;
- `RegisterNewAppointment`.

### Certified composition behavior

`RegisterNewAppointment` may reuse `RegisterNewCustomer` as a Child Workflow instead of duplicating Customer creation authority.

This establishes a mandatory MK1 design rule:

> Existing certified business capabilities are composed through their approved workflow/port contracts rather than reimplemented inside newer workflows.

### Router boundary

The currently certified router behavior is deterministic operation-to-workflow selection. Natural-language classification, confidence handling, generalized context enrichment and multi-intent arbitration are not part of the frozen foundation claim.

Agent inference, when introduced later, may propose an operation but cannot replace the orchestration contract.

---

## 3. Persistence Authority Contract

### PostgreSQL

PostgreSQL is canonical transactional/business truth for relational entities and invariants.

Existing certified examples include:

- Customer and registration command truth;
- Customer attachment references;
- Service/Product laboratory catalog rows;
- appointment command truth;
- Appointment rows;
- atomic final slot-conflict protection.

Future Services/Scheduler tables extend PostgreSQL authority without moving orchestration history into it.

### MongoDB

MongoDB stores flexible application execution/audit/context projections where required.

It must not become a shadow copy of canonical business entities merely for convenience.

Certified examples include Customer registration audit and Appointment audit, including mandatory audit verification before terminal success for the certified paths.

### AttachmentStore

The certified AttachmentStore contract separates binary/document truth from PostgreSQL business rows.

The MK0 implementation is local filesystem storage with content-addressed integrity and SHA-256 verification. MinIO/S3 are replaceable future implementations and require their own certification before production claims.

---

## 4. Cross-Block Transaction Rule

The durable flow remains:

```text
CHANNEL
  ↓
CTA ADAPTER
  ↓
TEMPORAL WORKFLOW
  ↓
ACTIVITIES / PORTS
  ├── PostgreSQL
  ├── MongoDB
  ├── AttachmentStore
  └── future integrations
```

No new MK1 engine may reverse this authority flow.

A channel cannot write around Temporal. A Workflow cannot directly write around Activities. Audit cannot silently replace business truth. A read of availability cannot be treated as a reservation without final authoritative validation.

---

## 5. Evidence Classification

MK1 uses four classifications:

```text
CERTIFIED       executable evidence exists for the stated claim
PROVEN/PARTIAL  behavior exists but does not establish the full target engine/capability
ABSENT          not implemented or no truthful evidence exists
DEFERRED        intentionally outside the current gate
```

The words `implemented`, `documented`, `observed` and `designed` are never synonyms for `CERTIFIED`.

---

## 6. Foundation Closure Claim

The following statement is approved for Stage 2:

> **Blocks 1, 2 and 6 provide a certified architectural foundation: replaceable CTA boundaries, durable Temporal orchestration, and explicit persistence authorities. Their future breadth—additional channels, generalized intent routing, a larger Workflow Library and production storage adapters—remains incrementally certifiable work.**

This foundation may be treated as frozen for regression while Services Engine and Scheduler Engine are developed.
