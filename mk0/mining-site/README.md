# mining-site — mk0 Evidence Ledger

## Purpose

`mining-site` records the evidence and explicit project decisions used to design mk0. Material is distilled into `quarries/`; Design must not rely on remembered assumptions.

## MS-001 — VTKALL DataModel v3 / TimeSlots

Source:

`em3rc0dTh/demo_test/DATA_MODEL_VTKALL_DataModel-0_v3_timeslots.md`

Role:

- semantic baseline for Customer;
- preserves the later scheduling distinction between Appointment and ResourceReservation;
- keeps RegisterNewCustomer isolated from scheduling.

Key facts:

- Customer is a canonical business entity.
- `Appointment` schedules a customer-facing appointment.
- `ResourceReservation` blocks actual capacity.
- availability is derived from schedule rules + overrides + blocking reservations.
- default recommended micro-slot is 15 minutes.
- only `held`/`booked` reservations block capacity.
- `AvailabilitySlot` is legacy compatibility, not future authority.

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
- PostgreSQL/MongoDB side effects belong in Activities/adapters;
- worker/process restart must not lose accepted workflow progress.

Classification: source + design consequence.

## MS-003 — NestJS documentation

Sources:

- https://docs.nestjs.com/controllers
- https://docs.nestjs.com/providers
- https://docs.nestjs.com/faq/request-lifecycle

Role:

- HTTP/application edge;
- DTO/request lifecycle;
- provider composition.

Design consequence:

NestJS maps the CTA to the orchestration contract; it does not own durable business sequencing.

## MS-004 — Project architecture decision, 2026-08-24

First mk0 slice:

```text
CTA (Postman API)
→ NestJS
→ Orchestration Engine (Temporal)
→ Persistence
```

This supersedes the earlier mistaken interpretation that Services + Scheduler were the first implementation slice.

Classification: `PROJECT_DECISION`.

## MS-005 — Persistence clarification, 2026-08-24

The third first-step zone uses:

```text
PostgreSQL + MongoDB
```

mk0 authority split:

- PostgreSQL = canonical Customer + registration/idempotency business truth;
- MongoDB = execution/audit/workflow context and optional attachments/documents;
- PostgreSQL stores opaque attachment references when needed;
- SQLite is removed from mk0.

Temporal may independently use PostgreSQL internally, but Temporal infrastructure persistence is not application Customer persistence.

Classification: `PROJECT_DECISION` + `DESIGN_DECISION`.

## Evidence handling rule

Classify significant statements as:

- `SOURCE_FACT`
- `PROJECT_DECISION`
- `DESIGN_DECISION`
- `DESIGN_PROPOSAL`
- `DESIGN_REQUIREMENT`
- `UNKNOWN`

Never convert a proposal into source/project truth without an explicit decision.
