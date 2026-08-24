# Engines

`Engines` is the design and implementation home for the reusable operational architecture that will support future agentic systems.

## Current version

**mk0 — documentation-first foundation**

mk0 intentionally contains **no production implementation** yet. Its purpose is to freeze architecture, contracts, data authority, Temporal workflow semantics, persistence boundaries, Postman/API behavior, tests, evidence sources, and the golden dataset before the first stable build.

## mk0 vertical slice

The first executable architecture is:

```text
Postman CTA
    ↓ HTTP/API
NestJS Boundary
    ↓ command
Orchestration Engine
    ↓ Temporal workflow + activities
Persistence
    ├── Customer business data → MongoDB
    ├── Workflow / audit log    → MongoDB
    └── Attachments, if any     → local attachment database/store
```

The first workflow is:

> **Register New Customer**

Postman is only the first CTA. A future Agent, web UI, WhatsApp channel, or other client must enter through the same API/application contract instead of bypassing NestJS or writing directly to persistence.

## Data-model baseline

mk0 uses the existing **DataModel v3 / TimeSlots** model as its canonical business-model baseline.

For the first workflow, the relevant aggregate is `Customer`.

Important boundary:

- `Appointment` represents the customer-facing appointment/intention.
- `ResourceReservation` represents the real capacity lock.
- Register New Customer creates neither by default.
- Scheduling will be introduced only through an explicit later workflow/capability.

## Repository structure

See [`mk0/README.md`](mk0/README.md).

## Build rule

**No implementation begins until Design, Plan, Test contract, and Golden Dataset gates are approved.**
