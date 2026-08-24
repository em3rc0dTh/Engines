# Test — mk0

## Purpose

Tests are specified before Build so implementation cannot redefine success.

```text
T0 — contract/normalization
T1 — NestJS CTA/API boundary
T2 — Temporal workflow
T3 — PostgreSQL persistence
T4 — MongoDB persistence
T5 — full Postman → NestJS → Temporal → PostgreSQL/MongoDB runtime
```

## T0 — Contract tests

Must prove:

- deterministic Customer normalization;
- material command fingerprint stability;
- correlation metadata excluded from fingerprint;
- same logical command → same fingerprint;
- material command change → different fingerprint;
- attachment ingress identities included correctly when present;
- no Appointment/ResourceReservation fields enter `RegisterNewCustomer`.

## T1 — NestJS API tests

Accept:

- minimal valid Customer;
- full valid Customer;
- optional valid attachment ingress reference(s);
- caller correlation ID;
- server-generated correlation ID.

Reject before workflow start:

- missing `Idempotency-Key`;
- malformed body;
- missing required Customer fields;
- invalid attachment ingress reference;
- unsupported/oversized attachment ingress according to later frozen limits;
- scheduling fields in the registration command.

Successful durable start must return `202 Accepted`; no 202 is valid if Temporal did not accept the workflow.

## T2 — Temporal tests

Happy path:

```text
accept
→ reserve idempotency
→ persist Customer in PostgreSQL
→ append MongoDB audit/context
→ finalize
```

Attachment path:

```text
accept
→ persist Customer base in PostgreSQL
→ commit attachment(s) in MongoDB
→ link reference(s) in PostgreSQL
→ append audit/context
→ finalize
```

Failure injection must cover:

- failure before PostgreSQL side effect;
- Activity failure after PostgreSQL side effect but before acknowledgement;
- failure before MongoDB attachment side effect;
- Activity failure after MongoDB attachment side effect but before acknowledgement;
- failure after PostgreSQL attachment link but before workflow completion;
- worker restart between Activities.

Expected: no duplicate Customer and no duplicate logical attachment/reference.

## T3 — PostgreSQL integration tests

### Customer/registration

- create one Customer registration exactly once;
- retrieve Customer by ID;
- repeat same registration identity returns same logical Customer;
- command/idempotency uniqueness works;
- same key/different fingerprint conflicts;
- Customer attachment reference linking is idempotent;
- finalization refuses to succeed when mandatory attachment references are missing;
- no scheduling tables/entities are mutated by registration.

### Temporal separation

Prove application Customer queries do not depend on Temporal internal persistence tables/schemas.

## T4 — MongoDB integration tests

### Audit/context

- append required milestone;
- stable event identity protects against retry duplication;
- query by workflow/correlation/customer;
- no unrestricted request body/raw PII/binary blob in routine audit events.

### Optional attachments/documents

Once the exact MongoDB implementation is chosen, prove:

- stage/resolve ingress;
- commit attachment/document;
- verify SHA-256/length;
- retry commit returns same logical attachment;
- expired ingress is rejected;
- corrupt/mismatched content is detected;
- committed object remains recoverable after downstream PostgreSQL-link failure;
- orphan/reconciliation candidates are discoverable.

## T5 — Full runtime scenarios

### R-001 Minimal registration

```text
Postman → NestJS → Temporal → PostgreSQL + MongoDB audit
```

Proof:

- 202;
- workflow completes;
- one PostgreSQL Customer exists;
- MongoDB audit milestones exist;
- Customer GET returns canonical business result.

### R-002 Registration with attachments

Proof:

- attachment ingress accepted;
- workflow starts;
- attachment commits in MongoDB;
- PostgreSQL stores reference only;
- hashes/metadata match;
- workflow completes.

### R-003 Exact client replay

Same command + same key.

Proof:

- one Customer;
- one logical registration outcome;
- no duplicate logical attachments.

### R-004 Idempotency conflict

Same key + materially changed command.

Proof:

- 409;
- no second Customer or changed-command side effect.

### R-005 PostgreSQL temporary outage

Proof:

- accepted workflow remains durable;
- Activity retries after recovery;
- exactly one Customer.

### R-006 MongoDB temporary outage

Proof:

- workflow remains correct/retryable;
- no false successful finalization;
- completes after recovery for transient failure.

### R-007 Attachment integrity error

Proof:

- typed permanent failure;
- Customer not falsely finalized;
- MongoDB/PostgreSQL partial state remains diagnosable.

### R-008 Temporal worker restart

Proof:

- accepted workflow resumes;
- no business duplication;
- final state correct.

### R-009 Scheduling isolation

Proof after successful registration:

- Appointment delta = 0;
- ResourceReservation delta = 0;
- AvailabilitySlot mutation delta = 0.

## Required runtime evidence

Capture:

- git commit SHA;
- Golden Dataset case ID;
- Postman request identifier;
- safe idempotency test key/hash;
- HTTP response;
- Temporal workflow ID/run ID;
- final workflow status;
- PostgreSQL Customer ID/verification;
- relevant MongoDB audit/context evidence;
- attachment metadata/hash when applicable;
- scheduling non-effect assertion.

## Release gate

mk0 is not stable because unit tests are green. It is stable only when mandatory golden cases pass through the complete first-three-zone runtime with expected results.
