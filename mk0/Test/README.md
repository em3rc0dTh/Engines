# Test — mk0

## Purpose

Tests are specified before Build so implementation cannot redefine success.

```text
T0 — command/normalization
T1 — CTA controlled-entry validation
T2 — Temporal workflow
T3 — PostgreSQL persistence
T4 — MongoDB persistence
T5 — AttachmentStore persistence when enabled
T6 — full CTA → Temporal → persistence runtime
```

No web framework test layer is required.

## T0 — Command tests

Must prove:

- deterministic TimeSlots-aligned Customer normalization;
- material command fingerprint stability;
- correlation excluded from material fingerprint;
- same logical command → same fingerprint;
- material change → different fingerprint;
- optional attachment identities included correctly;
- no scheduling fields accepted.

## T1 — CTA controlled-entry tests

Accept:

- minimal valid Customer;
- full valid Customer;
- valid optional attachment ingress references;
- explicit idempotency identity;
- optional correlation identity.

Reject before Workflow start:

- malformed command envelope;
- missing businessSlug;
- missing Customer type/name;
- missing idempotency identity;
- missing usable contact locator under frozen contract;
- malformed attachment reference;
- forbidden scheduling/service fields.

For every rejected command prove:

```text
workflowStarted = false
PostgreSQL Customer delta = 0
committed attachment delta = 0
```

## T2 — Temporal tests

Happy path:

```text
accept
→ reserve idempotency
→ persist Customer in PostgreSQL
→ persist required MongoDB audit/context
→ finalize
```

Attachment path:

```text
accept
→ persist Customer base
→ commit attachment(s) through AttachmentStore
→ link reference(s) in PostgreSQL
→ append audit/context in MongoDB
→ finalize
```

Failure injection covers:

- before PostgreSQL side effect;
- after PostgreSQL side effect but before Activity acknowledgement;
- before MongoDB side effect;
- after MongoDB side effect but before acknowledgement;
- before/after attachment commit;
- after attachment reference link but before final workflow completion;
- worker restart between Activities.

Expected: one logical Customer, one logical registration, no duplicate logical attachment/reference.

## T3 — PostgreSQL integration

Prove:

- Customer projection matches approved TimeSlots Customer semantics;
- one registration identity creates one Customer;
- idempotency uniqueness works;
- same key/different fingerprint conflicts;
- attachment reference linking is idempotent;
- finalization fails when mandatory effects are absent;
- no Appointment/ResourceReservation/availability mutation occurs.

## T4 — MongoDB integration

Prove:

- required audit milestones persist;
- stable event identity prevents retry duplication;
- query by workflow/correlation/customer works;
- routine audit/context does not contain unrestricted request bodies, secrets, raw attachment bytes or unnecessary PII;
- MongoDB does not become a shadow canonical Customer store.

## T5 — AttachmentStore integration

Once physical technology is selected, prove:

- stage/resolve ingress;
- commit stable attachment identity;
- SHA-256/length integrity;
- content retrieval/streaming;
- retry after commit returns same logical object;
- expired ingress rejection;
- corruption/hash mismatch detection;
- orphan/reconciliation discovery;
- no storage internals leak into caller contract.

## T6 — Full runtime scenarios

### R-001 Minimal registration

```text
CTA → Temporal → PostgreSQL + MongoDB
```

Proof:

- Temporal durably accepts workflow;
- workflow completes;
- exactly one PostgreSQL Customer exists;
- MongoDB required audit/context exists;
- final query returns same Customer identity.

### R-002 Registration with attachments

Proof:

- staged attachment referenced safely;
- attachment commits through AttachmentStore;
- PostgreSQL stores business reference only;
- integrity metadata matches;
- workflow completes.

### R-003 Exact replay

Same command + same idempotency key.

Proof: one Customer and one logical registration outcome.

### R-004 Idempotency conflict

Same key + materially changed command.

Proof: changed command rejected; no second Customer.

### R-005 PostgreSQL temporary outage

Proof: Temporal retries and completes after recovery with one Customer.

### R-006 MongoDB temporary outage

Proof: no false success; retry/recovery follows mandatory audit/context policy.

### R-007 AttachmentStore temporary outage

Proof: no false finalization; completes after transient recovery.

### R-008 Attachment integrity failure

Proof: typed permanent failure and diagnosable partial state.

### R-009 Temporal worker restart

Proof: accepted workflow resumes without duplicate business effects.

### R-010 CTA disconnect/reconnect

Sequence:

```text
CTA starts workflow
→ workflowId is received
→ CTA process/session stops
→ Temporal continues
→ CTA reconnects later
→ query same workflowId
→ observe same durable final outcome
```

This is the required continuity proof.

### R-011 Scheduling isolation

Proof:

- Appointment delta = 0;
- ResourceReservation delta = 0;
- AvailabilitySlot mutation delta = 0.

## Required runtime evidence

Capture:

- git commit SHA;
- Golden Dataset case ID;
- CTA command fixture;
- safe idempotency test key/hash;
- Temporal workflow ID/run ID;
- final workflow status;
- PostgreSQL Customer ID/verification;
- MongoDB audit/context evidence;
- attachment metadata/hash where applicable;
- CTA reconnect proof for continuity case;
- zero-scheduling assertion.

## Release gate

mk0 is stable only when mandatory Golden Dataset cases pass through the complete CTA → Temporal → persistence runtime and match predeclared outcomes.
