# Test — mk0

## Purpose

Tests are designed before Build so implementation cannot redefine success after the fact.

The test strategy verifies contracts at five levels:

```text
T0 — pure contract/normalization
T1 — NestJS API boundary
T2 — Temporal workflow behavior
T3 — persistence integration
T4 — full Postman → API → Temporal → persistence runtime
```

---

## T0 — Pure contract tests

Must cover:

- customer-name trimming;
- phone normalization behavior;
- email normalization behavior;
- material command fingerprint stability;
- correlation metadata excluded from command fingerprint;
- attachment order/fingerprint canonicalization;
- same logical command produces same fingerprint;
- materially changed command produces different fingerprint;
- error classification serialization;
- no scheduling fields accepted in RegisterNewCustomer command.

---

## T1 — NestJS API contract tests

### Accept

- minimal valid JSON command;
- full valid JSON command;
- valid staged attachment reference(s);
- explicit caller correlation ID;
- server-generated correlation ID.

### Reject before Workflow start

- missing `Idempotency-Key`;
- malformed JSON;
- missing businessSlug;
- missing customer name;
- no usable contact locator;
- malformed attachment ingress reference;
- unsupported content type at staging endpoint;
- oversized staging request according to frozen Build limits;
- scheduling fields attempting to enter RegisterNewCustomer.

### Response contract

A successfully accepted command returns:

- `202`;
- request ID;
- correlation ID;
- workflow ID;
- workflow type;
- `ACCEPTED`;
- status URL.

No `202` may be returned if Temporal did not durably accept/start the workflow.

---

## T2 — Temporal Workflow tests

### Happy path

```text
accept
→ validate
→ reserve idempotency
→ create customer base
→ finalize
→ completed
```

### Attachment path

```text
accept
→ create customer base
→ commit A
→ commit B
→ link A+B
→ verify
→ finalize
```

### Retry behavior

Inject failure:

- before customer side effect;
- after customer side effect but before Activity completion;
- before attachment side effect;
- after attachment side effect but before Activity completion;
- after attachment link but before finalization completion.

Expected:

- no duplicate customer;
- no accidental duplicate attachment references;
- workflow eventually reaches correct terminal state when failure is transient.

### Permanent failure

Inject attachment hash mismatch.

Expected:

- no retry storm;
- typed permanent failure;
- customer not reported as successfully completed/active registration;
- audit contains terminal failure milestone;
- state remains diagnosable/idempotently recoverable.

### Worker restart

Stop worker while workflow is between Activities, restart it, and prove completion without business duplication.

---

## T3 — MongoDB integration tests

### Customer store

- create base exactly once;
- retrieve by ID;
- repeat same registration identity returns same logical record;
- no unique-phone assumption unless policy later freezes it;
- attachment link operation is idempotent;
- finalization checks required attachments.

### Command receipts

- unique `(operation, businessSlug, idempotencyKeyHash)`;
- same fingerprint accepted as replay;
- different fingerprint rejected as conflict;
- raw key not required in normal persisted/logged representation.

### Audit store

- append milestone;
- stable event identity prevents accidental duplicate logical milestone;
- query by workflow/correlation/customer;
- audit event does not contain prohibited raw request payload/attachment bytes.

---

## T3B — Local attachment-store integration tests

Required once technology is selected:

- stage/resolve ingress;
- commit attachment;
- read committed metadata;
- read content;
- verify SHA-256;
- retry commit returns same committed identity or equivalent idempotent outcome;
- corrupt content is detected;
- expired ingress reference is rejected;
- committed opaque ID does not expose host path;
- orphan candidate can be enumerated/reconciled.

---

## T4 — Full runtime scenarios

### R-001 Minimal registration

Postman sends valid customer with no attachments.

Proof:

- 202;
- workflow completes;
- one Customer exists;
- audit milestones exist;
- customer GET returns same business data.

### R-002 Registration with attachments

Proof:

- attachments staged;
- registration starts;
- attachment content committed to local store;
- Mongo customer contains references only;
- hashes match;
- workflow completes.

### R-003 Client replay

Repeat identical Postman request with same idempotency key.

Proof:

- no second customer;
- no second logical workflow outcome;
- no duplicate attachments.

### R-004 Idempotency conflict

Reuse same key with changed name/contact/attachment identity.

Proof:

- 409;
- no second customer/workflow side effect.

### R-005 Mongo temporary outage

Proof:

- accepted workflow remains durable;
- retry succeeds after Mongo recovers;
- one customer only.

### R-006 Attachment store temporary outage

Proof:

- workflow remains running/retrying according to policy;
- customer not finalized early;
- completes after recovery.

### R-007 Attachment integrity error

Proof:

- typed failure;
- no false success;
- audit explains classification without exposing bytes/path.

### R-008 Worker restart

Proof:

- Temporal resumes;
- no loss of accepted workflow;
- no duplicate side effects.

### R-009 No hidden scheduling

After successful customer registration, query persistence.

Proof:

- no Appointment created;
- no ResourceReservation created;
- no AvailabilitySlot mutation caused by registration.

---

## Required evidence per runtime test

Capture:

- git commit SHA;
- golden case ID;
- Postman request identifier;
- idempotency key hash or safe test key;
- HTTP response;
- workflow ID/run ID;
- final workflow status;
- resulting customer ID;
- customer document snapshot with sensitive test-only fixtures;
- relevant audit events;
- attachment metadata/hash where applicable;
- assertion that no unexpected scheduling records exist.

---

## Release gate

mk0 is not stable because unit tests are green.

It is stable only when all mandatory golden cases pass through the full runtime and the observed output matches the predeclared expected result.
