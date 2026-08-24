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

## MS-007 — Interactive start boundary correction, 2026-08-24

Earlier CTA material required Customer name/type/contact completeness before Temporal Workflow start.

That rule is **superseded** by the interactive registration decision.

Current rule:

```text
CTA validates legal session/transport envelope
→ Temporal Workflow starts
→ versioned RegistrationPolicy determines Customer completeness
→ incomplete legal draft waits durably
→ ProvideCustomerData Update(s) continue the same Workflow
```

Missing policy-required Customer fields are not automatically a pre-start rejection.

Classification: `DESIGN_DECISION` + `DESIGN_REQUIREMENT`.

## MS-008 — Business-scoped registration idempotency, 2026-08-24

Current registration session authority:

```text
(operation, businessSlug, idempotencyKeyHash)
```

Consequences:

- same opaque key text under different businesses does not collide solely on key text;
- recommended Workflow identity includes `businessSlug`;
- raw idempotency keys should not appear in routine logs.

The normalized material **initial start snapshot** is fingerprinted for exact replay/conflict detection. Later accepted `ProvideCustomerData` Updates evolve Workflow state without rewriting that original fingerprint.

Same business + same operation + same key + materially different initial-start fingerprint resolves to `SESSION_IDEMPOTENCY_CONFLICT` with no additional business effect.

Classification: `DESIGN_DECISION`.

## MS-009 — Mandatory audit-before-success rule, 2026-08-24

MongoDB remains application interaction/audit/context authority.

A registration may be reported successful only after the applicable success-gating logical milestones are durably represented, including session start, policy load, accepted external inputs, duplicate classification, business outcome and registration completion, plus conditional attachment/data-request milestones where applicable.

If required audit persistence remains unavailable after the frozen retry policy is exhausted:

```text
registration MUST NOT be reported successful
```

Temporal Event History remains orchestration evidence for a failure caused by the audit store itself. Writing a failure event to an unavailable MongoDB cannot be a prerequisite for truthfully exposing that failure.

Classification: `DESIGN_DECISION` + `TEST_REQUIREMENT`.

## MS-010 — Current channel vocabulary narrowed, 2026-08-24

Current mk0 executable CTA proof surfaces:

```text
Postman
CLI
```

Current future examples remain intentionally narrow: Form/Web, WhatsApp, Telegram, Mobile, Voice, API/Webhook and Email. Other protocols/channels require an explicit later design decision and are not automatically part of mk0 merely because the adapter boundary is extensible.

Classification: `PROJECT_DECISION`.

## Evidence handling rule

Classify significant statements as one of:

- `SOURCE_FACT`
- `PROJECT_DECISION`
- `DESIGN_DECISION`
- `DESIGN_PROPOSAL`
- `DESIGN_REQUIREMENT`
- `TEST_REQUIREMENT`
- `UNKNOWN`

Never convert a proposal into source/project truth without an explicit decision.
