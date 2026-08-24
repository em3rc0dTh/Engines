# Quarries — mk0

Quarries are distilled evidence packages. `mining-site` records sources and project decisions; each quarry extracts only the conclusions needed by Design.

## Current quarries

- `quarry-01-timeslot-data-model.md` — Customer + TimeSlots semantic boundaries.
- `quarry-02-temporal.md` — durable orchestration, Activities, retry and infrastructure-persistence isolation.
- `quarry-03-nestjs-boundary.md` — Postman/NestJS CTA and application-edge responsibility.
- `quarry-04-attachment-persistence.md` — PostgreSQL reference + MongoDB attachment/document persistence boundary.

## mk0 scope reminder

```text
Postman/NestJS
→ Temporal
→ PostgreSQL + MongoDB
```

Services, Scheduler, Integration and Agent are outside this first slice.

## Classification vocabulary

- `SOURCE_FACT`
- `PROJECT_DECISION`
- `DESIGN_DECISION`
- `DESIGN_PROPOSAL`
- `DESIGN_REQUIREMENT`
- `UNKNOWN`

The purpose is to prevent a plausible design idea from silently becoming project truth.
