# mining-site — mk0 Evidence Ledger

## Purpose

`mining-site` records the evidence and explicit project decisions used to design mk0. Design must not rely on remembered assumptions.

## MS-001 — VTKALL DataModel v3 / TimeSlots

Source:

`em3rc0dTh/demo_test/DATA_MODEL_VTKALL_DataModel-0_v3_timeslots.md`

Role:

- semantic baseline for `Customer`;
- preserves the later Appointment vs ResourceReservation distinction;
- keeps `RegisterNewCustomer` isolated from scheduling.

Key facts used by mk0:

- Customer is a canonical business entity;
- Customer includes business/type/name/document/contact/notes/status/timestamps semantics;
- `ManagedEntity` is separate from Customer;
- `Appointment` is customer-facing scheduling;
- `ResourceReservation` blocks real capacity;
- availability derives from schedule rules + overrides - blocking reservations;
- `AvailabilitySlot` is legacy compatibility rather than future authority.

Classification: `SOURCE_FACT`.

## MS-002 — Temporal documentation

Source:

https://docs.temporal.io/

Role:

- durable workflow runtime;
- Workflow/Activity separation;
- retry/restart model.

Design consequence:

- orchestration belongs to Temporal;
- persistence side effects belong in Activities/adapters;
- an accepted workflow survives CTA/worker/process lifetime changes.

Classification: `SOURCE_FACT` + derived `DESIGN_REQUIREMENT`.

## MS-003 — Framework decision superseded, 2026-08-24

Earlier drafts introduced NestJS as the CTA/application boundary.

That is **superseded**.

Current project decision:

> mk0 selects no application framework. Postman, CLI, or a minimal test harness may be used to prove the CTA → Temporal contract.

NestJS/Express/Fastify or another framework may only be evaluated later as a replaceable adapter if required for ergonomics or external channels.

Classification: `PROJECT_DECISION`.

## MS-004 — First architecture slice, corrected 2026-08-24

Canonical mk0 slice:

```text
CTA / controlled entry
→ Temporal Orchestration Engine
→ Persistence
   ├── PostgreSQL
   ├── MongoDB
   └── optional AttachmentStore
```

Services Engine, Scheduler Engine, Integration Engine and Agent are outside the first slice.

Classification: `PROJECT_DECISION`.

## MS-005 — Persistence clarification, 2026-08-24

Authority split:

- PostgreSQL = canonical Customer + registration/idempotency business truth;
- MongoDB = execution/audit/workflow context;
- attachments = separate persistence capability with opaque business reference back to PostgreSQL;
- exact AttachmentStore technology remains a Build decision;
- Temporal internal persistence is separate from application persistence even if it also uses PostgreSQL.

Classification: `PROJECT_DECISION` + `DESIGN_DECISION`.

## MS-006 — Continuity requirement, 2026-08-24

The CTA must be able to start a workflow, disappear, reconnect and observe the same durable outcome.

Continuity is therefore workflow durability and identity, not a permanently open network connection.

Classification: `PROJECT_DECISION` + `DESIGN_REQUIREMENT`.

## Evidence handling rule

Classify significant statements as one of:

- `SOURCE_FACT`
- `PROJECT_DECISION`
- `DESIGN_DECISION`
- `DESIGN_PROPOSAL`
- `DESIGN_REQUIREMENT`
- `UNKNOWN`

Never convert a proposal into source/project truth without an explicit decision.
