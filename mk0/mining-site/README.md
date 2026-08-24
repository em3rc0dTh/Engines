# mining-site — mk0 Evidence Ledger

## Purpose

`mining-site` is the intake ledger for external/internal evidence used to design mk0.

Material is mined here first, then distilled into `quarries/`. Design documents should depend on quarry conclusions or explicit new decisions, not on remembered assumptions.

---

## MS-001 — VTKALL DataModel v3 / TimeSlots

Source:

`em3rc0dTh/demo_test/DATA_MODEL_VTKALL_DataModel-0_v3_timeslots.md`

Repository URL:

https://github.com/em3rc0dTh/demo_test/blob/e3a122e866edb19eebdd023ccfb601f1d8a53b19/DATA_MODEL_VTKALL_DataModel-0_v3_timeslots.md

Role in mk0:

- canonical baseline for `Customer` shape;
- establishes `Case` as broader operational root in the larger model;
- establishes WorkTeam/TimeSlots concepts for later scheduling;
- establishes the critical distinction between Appointment and ResourceReservation.

Key extracted facts:

- Customer target shape separates personal/contact data from managed entities.
- `Appointment` schedules the customer-facing appointment.
- `ResourceReservation` blocks real team capacity.
- availability derives from WorkTeam schedule rules + overrides + reservations.
- default operational micro-slot is 15 minutes unless configured otherwise.
- only reservation states `held` and `booked` block capacity.
- `AvailabilitySlot` is legacy compatibility, not future source of truth.

Use:

**AUTHORITATIVE PROJECT BASELINE for mk0 business-model alignment**, subject to future project ADR changes.

---

## MS-002 — Temporal documentation

Source:

https://docs.temporal.io/

Role in mk0:

- durable workflow runtime;
- crash/restart recovery model;
- Workflow/Activity separation;
- basis for first customer-onboarding workflow.

Important design interpretation:

- durable orchestration belongs in Temporal;
- side-effecting persistence belongs in Activities;
- accepted workflows must survive normal worker/process failure;
- Activity implementations must tolerate retry.

Use:

**NORMATIVE PLATFORM DOCUMENTATION** for Temporal-specific implementation decisions during Build.

---

## MS-003 — NestJS documentation

Sources:

https://docs.nestjs.com/controllers

https://docs.nestjs.com/providers

https://docs.nestjs.com/faq/request-lifecycle

Role in mk0:

- HTTP controller boundary;
- DTO/request lifecycle;
- provider/module dependency structure;
- application-edge composition.

Important design interpretation:

- controllers accept/map HTTP requests;
- complex work is delegated through providers/services;
- mk0 further narrows that responsibility by delegating durable sequencing to the Orchestration Engine.

Use:

**NORMATIVE FRAMEWORK DOCUMENTATION** for NestJS-specific implementation decisions during Build.

---

## MS-004 — User architecture decision, 2026-08-24

Decision:

The first mk0 slice is:

```text
CTA (Postman API)
→ Nest
→ Orchestration Engine
→ Persistence
```

Persistence requirements:

- register-client business data persisted;
- log persisted in MongoDB;
- attachments, if present, persisted in another local database/store.

Use:

**PROJECT AUTHORITY / PRODUCT DECISION**.

This decision supersedes the earlier interpretation that Services Engine + Scheduler Engine were the first implemented slice.

---

## Evidence handling rule

Every quarry should identify whether a statement is:

- `SOURCE_FACT` — directly supported by source;
- `PROJECT_DECISION` — explicitly decided for Engines/mk0;
- `DESIGN_PROPOSAL` — proposed and still gateable;
- `UNKNOWN` — not yet resolved.

Do not silently convert `DESIGN_PROPOSAL` into `SOURCE_FACT`.
