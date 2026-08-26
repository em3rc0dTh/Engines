# Quarries — MK0

Quarries are distilled evidence packages inside the MK0 mining site. `mining-site` records source facts and project decisions; quarries extract only the conclusions needed by Design, Plan and Test.

## Canonical location

```text
mk0/mining-site/quarries/
```

The previous top-level `mk0/quarries/` path was removed during MK0 repository closure so there is one canonical evidence-extraction location.

## Quarry index

1. [`quarry-01-timeslot-data-model.md`](quarry-01-timeslot-data-model.md) — Customer/TimeSlots semantic boundary and future Scheduler constraints.
2. [`quarry-02-temporal.md`](quarry-02-temporal.md) — durable orchestration, Activities, retry/replay and persistence isolation.
3. [`quarry-03-cta-entry-boundary.md`](quarry-03-cta-entry-boundary.md) — replaceable CTA/channel boundary and legal-session semantics.
4. [`quarry-04-attachment-persistence.md`](quarry-04-attachment-persistence.md) — AttachmentStore authority and cross-store consistency.
5. [`quarry-05-register-new-appointment.md`](quarry-05-register-new-appointment.md) — second-specimen lessons: Child Workflow reuse, catalog reads, human-date normalization, explicit finalization and atomic slot conflict handling.

## Classification vocabulary

- `SOURCE_FACT`
- `PROJECT_DECISION`
- `DESIGN_DECISION`
- `DESIGN_PROPOSAL`
- `DESIGN_REQUIREMENT`
- `TEST_REQUIREMENT`
- `CERTIFIED_RUNTIME_FACT`
- `SCOPE_BOUNDARY`
- `UNKNOWN`

A plausible idea does not become project truth merely because it sounds correct.

## MK0 boundary

```text
CTA / Lab client
→ Temporal
→ Activities
→ PostgreSQL + MongoDB + AttachmentStore
```

The second Appointment specimen extends the Workflow library but does not authorize a completed Scheduler Engine, Services Engine, Integration Engine or Agent/Hermes layer.

For normative architecture see [`../../Design/`](../../Design/). For current gate truth see [`../../Plan/mk0-gate-status.md`](../../Plan/mk0-gate-status.md).
