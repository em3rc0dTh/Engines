# Engines

`Engines` is the design and implementation home for the reusable operational engines that will support VertikALL-style agentic systems.

## Current version

**mk0 — documentation-first foundation**

mk0 does **not** implement production code yet. Its purpose is to freeze the architecture, contracts, data authority, Temporal workflow semantics, Postman/API entry contract, test model, evidence sources, and golden dataset before the first stable build.

## mk0 scope

The first three engines are:

1. **Services Engine** — service/offering semantics and service-related operational capability.
2. **Scheduler Engine** — availability and real capacity reservation semantics.
3. **Orchestration Engine** — durable business workflow coordination, initially through Temporal.

The **Agent is outside these engines**. Postman is the first CTA/entry surface for mk0. A future Agent, web UI, WhatsApp channel, or another client must call the same contracts rather than bypassing them.

The first Temporal workflow is:

> **Register New Customer**

The canonical data-model baseline for mk0 is the existing **DataModel v3 / TimeSlots** model. Register New Customer uses the `Customer` portion of that model; it must not create an `Appointment` or `ResourceReservation` unless a later workflow explicitly requests scheduling.

## Repository structure

See [`mk0/README.md`](mk0/README.md).

## Build rule

No implementation should begin until the documentation gates in `mk0/Plan` are closed.
