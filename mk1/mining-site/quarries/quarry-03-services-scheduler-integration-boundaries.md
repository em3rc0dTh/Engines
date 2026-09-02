# Quarry 03 — Services / Scheduler / Integration Boundaries

## Purpose

Extract reusable architecture facts before Scheduler build work begins.

## Existing certified facts

- Services S0–S5 are already certified.
- A running Workflow may retain an immutable Offering revision while catalog head advances.
- Temporal is orchestration authority.
- PostgreSQL is canonical transactional/business truth.
- MongoDB is semantic/audit evidence, not shadow business truth.
- C1B gives durable provider-independent channel correlation and idempotency.
- `availability shown != reservation persisted` remains frozen.

## Boundary findings

### Q3.1 — Service semantics are not schedule semantics

Nominal Offering duration belongs to Services because it describes the offering. Concrete free/busy feasibility belongs to Scheduler because it depends on resources, schedules, capacity and existing allocations.

### Q3.2 — Scheduler must consume frozen semantics

When a Workflow has selected Offering revision N, Scheduler demand must be derived from that revision N snapshot. Re-reading mutable Offering head N+1 during availability or confirmation would violate S5.

### Q3.3 — Resource cannot mean only employee

The same scheduling engine must cover people, rooms, bays, vehicles, machines, equipment or pooled capacity. Vertical meaning must be expressed through resource kind/capabilities/data rather than business-type branches.

### Q3.4 — Availability, hold and reservation are separate states

A slot candidate is a query result. A hold is temporary capacity protection. A reservation is canonical committed allocation. Only the last one is booking truth.

### Q3.5 — Confirmation must revalidate

Slot selection cannot be trusted as reservation authority. Confirmation must atomically re-check resource/capacity state under concurrency.

### Q3.6 — Integration is a provider boundary, not business authority

External payment, ERP, mapping, messaging and webhook systems need adapters and delivery mechanics, but the Integration Engine must not become a second copy of Customer/Services/Scheduler/Appointment truth.

### Q3.7 — Telegram remains CTA

Interactive Telegram messages are channel ingress and therefore belong to the CTA/Channel Adapter architecture. This distinction protects the Step-5 Integration Engine from swallowing user-interaction semantics.

## Risks to prevent

```text
Service row stores employee IDs
Scheduler re-reads mutable catalog head
frontend owns availability state
slot selection writes Appointment directly
provider webhook mutates business tables directly
Telegram gets a separate Appointment Workflow
Integration Engine becomes central god-service
```

## Design consequences

The next Scheduler contract must include business scope, generic resources, capabilities, schedule templates/overrides, capacity, query windows, slot candidates, optional holds, atomic reservations, cancellation/release, typed conflicts, time zones, idempotency and revision-aware demand.

The Services → Scheduler handoff should be an explicit immutable `SchedulingDemand`, not a loose set of UI parameters.
