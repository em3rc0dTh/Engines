# Design — MK0

This folder contains the normative design package for the MK0 orchestration laboratory.

## Architecture scope

```text
replaceable CTA channels
        ↓
CTA Adapter contract
        ↓
Temporal Orchestration Engine
        ↓
Activities / ports
        ↓
PostgreSQL + MongoDB + AttachmentStore
```

No application framework is part of the architecture authority boundary.

## Design package

1. [`01-system-architecture.md`](01-system-architecture.md) — system architecture, CTA boundary, Temporal authority and persistence roles.
2. [`02-register-new-customer-contract.md`](02-register-new-customer-contract.md) — canonical Customer registration operation, validation and outcomes.
3. [`03-temporal-workflow.md`](03-temporal-workflow.md) — Workflow/Activity/Worker/Task Queue durability model.
4. [`04-persistence-boundaries.md`](04-persistence-boundaries.md) — PostgreSQL, MongoDB and attachment authority separation.
5. [`05-mk0-persistence-profile.md`](05-mk0-persistence-profile.md) — physical persistence profile and deferred choices.
6. [`06-mk0-closure-decisions.md`](06-mk0-closure-decisions.md) — first-specimen closure decisions and precedence rules.
7. [`07-register-new-appointment-specimen.md`](07-register-new-appointment-specimen.md) — second specimen proving workflow composition, catalog reads, date/slot interaction and atomic appointment booking.

## Design acceptance now proven

MK0 has evidence that:

- external channels converge through one CTA boundary;
- legal incomplete input can enter a durable conversation;
- invalid transport/contact/date material can be rejected before it corrupts durable business state;
- Temporal owns durable sequencing, recovery and replay;
- Workflow code has no direct persistence-driver authority;
- `RegisterNewCustomer` persists Customer truth through Activities and can be reused as a Child Workflow;
- `RegisterNewAppointment` composes the Customer capability rather than duplicating it;
- Service/Product/availability fixture truth is read from PostgreSQL through Activities;
- an available slot is revalidated atomically at final persistence time;
- MongoDB remains semantic audit rather than shadow business truth;
- explicit finalization is distinct from minimum input completeness;
- retries/replay cannot create duplicate logical effects.

## Scheduler boundary preserved

The second specimen intentionally uses a minimal local capacity fixture to prove orchestration. It does not claim completion of the future Scheduler/TimeSlots model.

The preserved future distinction remains:

```text
Appointment = customer-facing schedule
ResourceReservation = real capacity block
```

## Rule

A future framework, channel SDK, Scheduler, Agent or Integration layer may extend Engines only if it preserves the authority boundaries proven here. It must not create a second business path around Temporal.
