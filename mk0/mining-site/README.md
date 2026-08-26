# Mining Site — MK0 Evidence Ledger

## Purpose

`mining-site` records source facts, explicit project decisions and extracted reusable conclusions used by MK0. Design must not depend on remembered assumptions.

Canonical quarry location:

```text
mk0/mining-site/quarries/
```

See [`quarries/README.md`](quarries/README.md) for the extracted evidence index.

## Evidence ledger

### MS-001 — VTKALL DataModel v3 / TimeSlots

Role:

- semantic baseline for Customer;
- preserves Appointment vs ResourceReservation distinction;
- prevents `RegisterNewCustomer` from silently creating scheduling side effects.

Key preserved source facts:

```text
Appointment schedules the customer-facing event.
ResourceReservation blocks real operational capacity.
Availability is a derived operational concern, not Customer registration state.
```

Classification: `SOURCE_FACT`.

### MS-002 — Temporal documentation

Source: official Temporal documentation.

Role:

- durable Workflow execution;
- Workflow/Activity separation;
- retries/replay/recovery;
- process-independent orchestration identity.

Classification: `SOURCE_FACT` + derived `DESIGN_REQUIREMENT`.

### MS-003 — Framework decision superseded

MK0 selects no application framework as architecture authority. CLI, Postman-compatible HTTP and laboratory consoles are replaceable CTA implementations.

Classification: `PROJECT_DECISION`.

### MS-004 — First architecture slice

```text
CTA / controlled entry
→ Temporal Orchestration Engine
→ Activities
→ PostgreSQL + MongoDB + optional AttachmentStore
```

Classification: `PROJECT_DECISION`.

### MS-005 — Persistence authority split

- PostgreSQL = canonical business truth;
- MongoDB = semantic execution/audit context;
- AttachmentStore = binary/document object truth;
- Temporal internal persistence = infrastructure state, separate from application databases.

Classification: `PROJECT_DECISION` + `DESIGN_DECISION`.

### MS-006 — Continuity requirement

The CTA may disappear after Workflow acceptance. The same Workflow must remain queryable/recoverable later.

Classification: `PROJECT_DECISION` + `DESIGN_REQUIREMENT`.

### MS-007 — Interactive Customer start boundary

A legal Customer registration may start incomplete and wait durably for policy-required fields.

```text
CTA validates legal session/input shape
→ Temporal starts
→ RegistrationPolicy evaluates completeness
→ Update(s) evolve durable draft
```

Classification: `DESIGN_DECISION`.

### MS-008 — Business-scoped idempotency

Canonical registration identity:

```text
(operation, businessSlug, idempotencyKeyHash)
```

Initial material is fingerprinted; later Updates do not rewrite the original start fingerprint.

Classification: `DESIGN_DECISION`.

### MS-009 — Mandatory audit-before-success

When MongoDB audit is a success gate, required semantic milestones must exist before terminal success. Failure to persist mandatory audit cannot become false success.

Classification: `DESIGN_DECISION` + `TEST_REQUIREMENT`.

### MS-010 — Current channel vocabulary

Current executable proof surfaces:

```text
CLI
Postman-compatible HTTP
Customer Lab Console
Appointment Lab Console
```

Future channels remain replaceable adapters and require explicit product decisions.

Classification: `PROJECT_DECISION`.

### MS-011 — Contact validation boundary

Pragmatic syntax validation for external Customer contact updates belongs at CTA ingress before invalid phone/email material enters Temporal history. Durable Workflow replay semantics for already-recorded histories must not be changed casually.

Classification: `DESIGN_DECISION` + `CERTIFIED_RUNTIME_FACT`.

### MS-012 — Human completion vs minimum completeness

In interactive flows:

```text
minimum required data satisfied
≠
human finished editing
```

Explicit finalization is a separate action when the interaction contract requires it.

Classification: `DESIGN_DECISION` + `CERTIFIED_RUNTIME_FACT`.

### MS-013 — Appointment composition

The second specimen reuses `RegisterNewCustomer` as a Temporal Child Workflow for new Customers rather than duplicating Customer persistence logic.

Classification: `DESIGN_DECISION` + `CERTIFIED_RUNTIME_FACT`.

### MS-014 — Catalog and availability authority

Service/Product/availability fixture data is read from PostgreSQL through Activities. Temporal orchestrates selection but does not become catalog persistence authority.

Classification: `DESIGN_DECISION` + `CERTIFIED_RUNTIME_FACT`.

### MS-015 — Availability is not reservation

A displayed slot is only an observation. Final persistence must revalidate capacity atomically because another Workflow may win the slot first.

Classification: `DESIGN_REQUIREMENT` + `CERTIFIED_RUNTIME_FACT`.

### MS-016 — Scheduler boundary remains open

The Car Wash specimen uses a simplified local `default` resource and 30-minute fixture. It proves orchestration/concurrency, not final TimeSlots/ResourceReservation semantics.

Classification: `SCOPE_BOUNDARY`.

## Evidence handling rule

Significant statements should be classified as one of:

- `SOURCE_FACT`
- `PROJECT_DECISION`
- `DESIGN_DECISION`
- `DESIGN_PROPOSAL`
- `DESIGN_REQUIREMENT`
- `TEST_REQUIREMENT`
- `CERTIFIED_RUNTIME_FACT`
- `SCOPE_BOUNDARY`
- `UNKNOWN`

Never convert proposal, memory or plausible inference into source/project truth without explicit evidence or decision.
