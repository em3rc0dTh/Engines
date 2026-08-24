# Golden Dataset — mk0

## Version

`mk0.golden.register-customer.v0`

## Purpose

The golden dataset freezes expected behavior **before implementation** for:

```text
Postman → NestJS → Temporal → PostgreSQL + MongoDB
```

Each case defines the expected:

- HTTP/CTA behavior;
- Temporal outcome;
- PostgreSQL Customer/registration effect;
- MongoDB audit/context effect;
- optional MongoDB attachment/document effect;
- PostgreSQL attachment-reference effect;
- scheduling non-effect.

## Case inventory

### GD-001 — Minimal valid Customer

Expected:

- 202 accepted;
- workflow completes;
- exactly one PostgreSQL Customer;
- MongoDB audit milestones exist;
- zero attachment references;
- zero scheduling side effects.

### GD-002 — Full Customer

Document/contact/notes are persisted according to the approved PostgreSQL business projection without inventing missing facts.

### GD-003 — One attachment

Expected:

- one committed MongoDB attachment/document;
- one PostgreSQL Customer attachment reference;
- matching integrity metadata;
- no attachment binary in PostgreSQL Customer storage.

### GD-004 — Multiple attachments

Expected:

- every requested attachment commits once logically;
- every committed attachment is referenced once in PostgreSQL;
- Customer finalization occurs only after all mandatory effects.

### GD-005 — Exact idempotent replay

Same `Idempotency-Key` + same material command.

Expected one logical workflow/Customer outcome and no duplicate attachments.

### GD-006 — Idempotency conflict

Same key + changed material command.

Expected 409 and no second Customer/business side effect.

### GD-007 — Invalid request

Expected API-edge rejection with no Temporal workflow and no persistence side effects.

### GD-008 — Transient PostgreSQL Customer-write failure

Expected Temporal retry/recovery and exactly one Customer after PostgreSQL recovers.

### GD-009 — Transient MongoDB attachment failure

Expected retry/recovery, no early Customer finalization and one committed logical attachment after recovery.

### GD-010 — Permanent attachment integrity mismatch

Expected typed workflow failure and no false successful Customer finalization.

### GD-011 — Temporal worker restart

Expected workflow resume, exactly one Customer and no lost accepted command.

### GD-012 — Scheduling isolation

Expected:

- Appointment delta = 0;
- ResourceReservation delta = 0;
- AvailabilitySlot mutation delta = 0.

## Data rules

Use synthetic people/identifiers only. Do not place real Customer PII in the dataset.

Attachment fixtures, when added, should be tiny synthetic objects with fixed hashes.

## Approval rule

`v0` is approved when:

- every case is machine-readable;
- expected PostgreSQL/MongoDB effects are explicit;
- unresolved fixture hashes are frozen or explicitly marked;
- Design and Golden Dataset agree;
- expected behavior was not reverse-engineered solely from implementation output.

The companion manifest is `register-new-customer-v0.json`.
