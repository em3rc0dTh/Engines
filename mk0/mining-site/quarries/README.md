# Quarries — mk0

Quarries are distilled evidence packages. `mining-site` records sources and project decisions; each quarry extracts only the conclusions needed by Design.

## Current quarries

- `quarry-01-timeslot-data-model.md` — Customer + TimeSlots semantic boundaries.
- `quarry-02-temporal.md` — durable orchestration, Activities, retry and infrastructure-persistence isolation.
- `quarry-03-cta-entry-boundary.md` — framework-agnostic CTA, controlled session input and Temporal start/query/update boundary.
- `quarry-04-attachment-persistence.md` — attachment persistence contract and cross-store consistency.

## mk0 scope reminder

```text
Postman | CLI | minimal test harness
→ Temporal
→ PostgreSQL + MongoDB + optional AttachmentStore
```

No application framework is part of the mk0 architecture baseline.

Services, Scheduler, Integration and Agent are outside this first slice.

## Classification vocabulary

- `SOURCE_FACT`
- `PROJECT_DECISION`
- `DESIGN_DECISION`
- `DESIGN_PROPOSAL`
- `DESIGN_REQUIREMENT`
- `TEST_REQUIREMENT`
- `UNKNOWN`

The purpose is to prevent a plausible design idea from silently becoming project truth.

For known pre-Build cross-document closure decisions and precedence, see `../Design/06-mk0-closure-decisions.md`.
