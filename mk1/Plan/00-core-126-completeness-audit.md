# G0 — Core Blocks 1 / 2 / 6 Completeness Audit

## Audit rule

This document intentionally separates **certified architectural behavior** from **complete implementation of every capability shown in the target architecture diagram**.

MK0 conclusively proves the reusable spine. It does not prove that every future channel, router capability, workflow, storage adapter or business operation already exists.

## Executive verdict

```text
1. CTA / Channel Adapter core             ✅ CERTIFIED
1. Full omnichannel surface               ❌ NOT COMPLETE

2. Temporal orchestration core            ✅ CERTIFIED
2.1 Full Intent & Workflow Router         ❌ NOT COMPLETE
2.2 Full target Workflow Library          ❌ NOT COMPLETE
2.3 Core Orchestration Coordinator        ✅ CERTIFIED FOR MK0 SPECIMENS

6. Persistence authority model            ✅ CERTIFIED
6. Production object-storage surface      ❌ NOT COMPLETE
6. Platform-wide persistence breadth      🟡 PARTIAL / GROWS WITH ENGINES
```

Therefore the statement **“1, 2 and 6 are completely finished in everything shown in the diagram” is not yet supportable**.

The supportable statement is:

> MK0 certified the CTA boundary, the Temporal orchestration spine and the persistence authority split strongly enough to use them as the stable foundation for the next engines.

---

## 1 — CTA / Channel Adapter

### Certified

- HTTP/Postman entry against the local Compose laboratory.
- CLI entry.
- Lab Console interaction through the same orchestration boundary.
- Transport validation before illegal input reaches Temporal where appropriate.
- Canonical start/query/update operations.
- Correlation/idempotency material carried into the orchestration boundary.
- No direct business persistence from CTA code.
- Customer and Appointment flows both reuse the channel/orchestration separation.
- Physical Postman proof: 37/37 Customer laboratory assertions passed.

### Not yet certified as channels

- WhatsApp.
- Telegram.
- Web Chat widget as a distinct adapter.
- Mobile application adapter.
- Voice / IVR.
- Email conversation adapter.
- External webhook/event ingress as a separately certified channel.
- Future channels.

### Verdict

```text
CTA architecture / replaceability contract      PASS
Postman / HTTP                                   PASS
CLI                                               PASS
Omnichannel implementation                       OPEN
```

A new channel is therefore valuable as a **replaceability proof**, not because MK0 failed, but because it would prove the same Service/Scheduler/Temporal behavior through another transport without duplicating business logic.

---

## 2 — Orchestration Engine

### 2.1 Intent & Workflow Router

#### Proven

- Legal operation envelopes are accepted/rejected at the CTA boundary.
- Deterministic operation-to-workflow routing exists for the implemented operations.
- Appointment can resolve an existing Customer, detect ambiguity, reject an absent explicit Customer ID, or create a new Customer through a Child Workflow.
- Workflow selection remains outside channel-specific business logic.

#### Not yet implemented/certified as a general router

- Natural-language Intent Classification.
- General Customer Recognition before workflow start.
- Context Enrichment as a reusable router capability.
- Dynamic Workflow Selection from inferred intent.
- Multi-intent arbitration.
- Router confidence/ambiguity policy.
- Router-level fallbacks and escalation.

#### Classification

```text
Explicit operation routing           ✅ PROVEN
Customer resolution inside booking   ✅ PROVEN
General intent classification         ❌ ABSENT
General workflow router               🟡 MINIMAL / DETERMINISTIC ONLY
```

### 2.2 Workflow Library

#### Certified library entries

1. `RegisterNewCustomer`
2. `RegisterNewAppointment`

#### Certified behavior inside those workflows

`RegisterNewCustomer`:

- intent-only start;
- durable waiting for missing data;
- multiple customer-data Updates;
- validation and normalization;
- duplicate semantics;
- idempotent replay;
- Customer persistence;
- mandatory Mongo audit before success;
- AttachmentStore lifecycle;
- restart/process-loss recovery;
- read-only execution trace.

`RegisterNewAppointment`:

- existing Customer resolution;
- new Customer creation through `RegisterNewCustomer` Child Workflow;
- Service catalog read;
- Product catalog read;
- Service selection;
- Product selection;
- date normalization/validation;
- slot discovery;
- explicit finalization;
- atomic booking;
- idempotent appointment replay;
- slot-race conflict handling;
- mandatory appointment audit before terminal success.

#### Target-library capabilities not yet certified

- Service Recommendation as its own reusable decision/capability.
- Reschedule Appointment.
- Cancel Appointment.
- Follow-up / Reminders.
- General Corrections / Updates after a completed business operation.
- Generic workflow compensation.
- Booking modification lifecycle.
- Workflow catalog/version registry as a product surface.

Important distinction:

`ProvideCustomerData`, Service/Product selection, date changes before finalization and slot reselection after a conflict prove **interactive Updates inside an active Workflow**. They do **not** certify a general post-completion Corrections/Updates capability.

### 2.3 Orchestration Coordinator

#### Certified for the two MK0 specimens

- durable step execution;
- durable workflow state;
- Query/Update interaction;
- Child Workflow composition;
- Activity coordination;
- retry policies;
- replay/recovery;
- typed failures in important negative paths;
- idempotency conflict handling;
- atomic persistence revalidation for booking;
- audit-before-success rules;
- observable execution evidence.

#### Not yet broadly certified

- compensation workflows;
- explicit cancellation semantics across all workflow types;
- upgrade/version migration behavior across deployed workflow revisions;
- generic orchestration policies shared by a broad workflow catalog.

### Verdict for block 2

```text
Temporal durable orchestration spine             ✅ CERTIFIED
Coordinator behavior for Customer + Appointment  ✅ CERTIFIED
General intent/router layer                       ❌ OPEN
Full workflow library shown in target diagram     ❌ OPEN
```

So block 2 is **foundationally certified but not feature-complete as drawn**.

---

## 6 — Persistence / Storage Layer

### PostgreSQL — certified authority

Certified canonical relational truth currently covers:

- Customers;
- registration/session command truth;
- Customer attachment references;
- Service catalog fixture;
- Service products fixture;
- availability-rule fixture;
- appointment commands;
- Appointments;
- atomic slot conflict invariant.

### MongoDB — certified authority

Certified semantic/application audit currently covers:

- Customer registration execution/audit context;
- Appointment execution/audit context;
- mandatory audit verification before terminal success in the certified workflows.

MongoDB is explicitly **not** a shadow copy of canonical Customer/Appointment business truth.

### AttachmentStore — certified boundary

Certified in MK0:

- local filesystem implementation;
- stage / resolve / commit lifecycle;
- content-addressed integrity;
- SHA-256 verification;
- retry-safe commit behavior;
- failure without false success on integrity mismatch.

### Not yet certified for the final storage diagram

- MinIO adapter.
- S3 adapter.
- production bucket/security/lifecycle configuration.
- production backup/restore/disaster-recovery semantics.
- platform-wide persistence for future engines that do not yet exist.

### Verdict for block 6

```text
Authority split and local persistence semantics   ✅ CERTIFIED
PostgreSQL + MongoDB + local AttachmentStore       ✅ CERTIFIED
Production object storage                          ❌ OPEN
Future-engine persistence breadth                  🟡 INCREMENTAL
```

The persistence **architecture** is safe to treat as foundation-complete. The production storage surface is not.

---

# Gap Matrix Requested for Stage 2

| Capability | Current classification | Where it belongs next |
|---|---|---|
| New Customer | ✅ Certified | Frozen capability; regression only |
| Customer Recognition | 🟡 Proven inside Appointment resolution | Router/Customer capability hardening |
| Booking / New Appointment | ✅ Certified | Scheduler regression base |
| Service catalog read | ✅ Proven at specimen scale | Services Engine |
| Product/package selection | ✅ Proven at specimen scale | Services Engine |
| Service Recommendation | ❌ Not certified | Services Engine |
| Reschedule | ❌ Not implemented | Scheduler + Workflow Library |
| Cancel | ❌ Not implemented | Scheduler + Workflow Library |
| Follow-up / Reminders | ❌ Not implemented | Workflow Library + Integration Engine later |
| Corrections / Updates while workflow active | ✅ Proven | Carry forward |
| Corrections after completed operation | ❌ Not certified | Workflow Library / business lifecycle |
| Intent Classification | ❌ Not implemented | Router layer; Agent-independent baseline first |
| Explicit deterministic workflow selection | ✅ Proven | Carry forward |
| Context Enrichment | ❌ Not generalized | Router / Services context |
| Audit Customer | ✅ Certified | Regression |
| Audit Appointment | ✅ Certified | Regression |
| PostgreSQL business truth | ✅ Certified | Extend per new engine |
| Mongo semantic audit | ✅ Certified | Extend per new engine |
| AttachmentStore local | ✅ Certified | Regression |
| S3 / MinIO | ❌ Not certified | Later production storage adapter |

---

# Gate Decision

We do **not** need to reopen MK0 or rewrite the certified spine.

We do need to prevent the architectural diagram from being read as if all future sub-capabilities already exist.

The Stage-2 program should proceed in this order:

```text
G0  Core 1/2/6 completeness audit             ← current
G1  Services Engine certification
G2  Scheduler Engine certification
G3  New CTA channel proof (Telegram preferred candidate)
```

Services and Scheduler must receive independent contracts and closure receipts rather than being declared complete merely because Appointment touched small parts of them.

---

# Proposed Services Engine closure target

The existing `service_catalog` / `service_products` fixture is the seed, not the finished engine.

At minimum the Services Engine certification should make explicit and test:

- business-scoped Service identity;
- Product / Package identity;
- active/inactive lifecycle;
- duration;
- price/currency model or an explicit decision to defer pricing;
- requirements;
- dependencies;
- business rules/policies;
- Service availability constraints that belong to Service semantics rather than scheduling execution;
- recommendation eligibility rules;
- deterministic catalog reads;
- version/change behavior needed by running Workflows;
- idempotent mutation semantics if catalog write APIs are included;
- audit/evidence requirements.

A certification specimen should prove that at least two materially different service definitions can use the same engine contract without code branching by business name.

---

# Proposed Scheduler Engine closure target

The current appointment fixture proves slot calculation and atomic conflict handling, but deliberately uses one `default` resource and simple 30-minute rules.

A Scheduler Engine certification should explicitly cover:

- staff/specialist/resource availability;
- resource identity;
- schedule rules and overrides;
- service/product duration interaction;
- capacity constraints;
- conflict detection;
- atomic reservation/booking;
- `ResourceReservation` or an equivalent canonical reservation model;
- reschedule lifecycle;
- cancel/release lifecycle;
- timezone semantics;
- stale-availability revalidation;
- idempotency;
- concurrent race behavior;
- recovery after Worker/CTA loss;
- audit before terminal success;
- optional optimal-slot suggestion only after correctness is proven.

Only after those gates pass should the diagram mark the Services and Scheduler blocks as certified engines.
