# Golden Dataset — mk0

## Version

`mk0.golden.register-customer.v0`

## Purpose

The golden dataset freezes expected behavior before implementation for:

```text
Postman / CLI
→ CTA Adapter
→ full Temporal Orchestration Engine
→ PostgreSQL + MongoDB + optional AttachmentStore
```

No framework or HTTP status is part of the canonical expected behavior. A future HTTP adapter may map the same outcomes to HTTP codes without changing dataset semantics.

The Temporal requirement is not technology-neutral: **mk0 must prove a real Temporal Service + Workflow + Task Queue + Worker + Activity execution path.** A custom in-process state machine does not satisfy the golden contract.

Each case defines expected:

- CTA command acceptance/rejection;
- Temporal outcome;
- PostgreSQL Customer/registration effect;
- MongoDB audit/context effect;
- optional AttachmentStore effect;
- PostgreSQL attachment-reference effect;
- scheduling non-effect.

## Case inventory

### GD-001 — Minimal valid Customer

Expected durable Workflow acceptance, completion, exactly one PostgreSQL Customer, required MongoDB audit/context, no attachments and zero scheduling side effects.

### GD-002 — Full Customer

Document/contact/notes persist according to the approved TimeSlots Customer projection without inventing missing facts.

### GD-003 — One attachment

Expected one committed AttachmentStore object, one PostgreSQL Customer attachment reference, matching integrity metadata and no binary forced into Customer relational storage.

### GD-004 — Multiple attachments

Every requested attachment commits once logically and finalization waits for all mandatory references.

### GD-005 — Exact idempotent replay

Same idempotency key + same material command produces one logical Workflow/Customer outcome.

### GD-006 — Idempotency conflict

Same key + changed material command is rejected with no second Customer/business side effect.

### GD-007 — Invalid structural input

Rejected before Temporal start with zero persistence side effects.

### GD-008 — Transient PostgreSQL Customer-write failure

Temporal retries/recoveries and exactly one Customer exists after PostgreSQL recovery.

### GD-009 — Transient AttachmentStore failure

Temporal retries; Customer is not finalized early; one logical attachment exists after recovery.

### GD-010 — Permanent attachment integrity mismatch

Typed terminal failure and no false successful Customer finalization.

### GD-011 — Temporal Worker restart

Workflow resumes with one Customer and no lost accepted command.

### GD-012 — Scheduling isolation

Appointment, ResourceReservation and AvailabilitySlot mutation deltas remain zero.

### GD-013 — CTA disconnect/reconnect continuity

CTA starts the Workflow and receives its Workflow identity, then the CTA session/process disappears. Temporal continues independently. A later CTA session queries the same Workflow identity and observes the same durable final result.

### GD-014 — Full Temporal runtime proof

The successful Customer registration must be observed through:

```text
Temporal Client
→ Temporal Service
→ Task Queue
→ Worker
→ RegisterNewCustomer Workflow
→ Activities
```

Evidence must prove:

- a real Temporal Workflow ID/Run ID exists;
- the Workflow appears in Temporal visibility/UI/CLI or equivalent official visibility;
- Worker Task Queue execution is observed;
- at least one persistence Activity executes through the Worker;
- Event History exists;
- the result is not produced by an in-process fake orchestrator.

This is the canonical proof that Engines uses Temporal's platform potency rather than only copying its programming model.

## Data rules

Use synthetic people/identifiers only. Do not place real Customer PII in the dataset.

Attachment fixtures, when added, should be tiny synthetic objects with frozen hashes.

## Approval rule

`v0` is approved when:

- every case is machine-readable;
- expected PostgreSQL/MongoDB/AttachmentStore effects are explicit;
- unresolved fixture hashes are frozen or explicitly marked;
- Design and Golden Dataset agree;
- real Temporal runtime evidence is required by the contract;
- expected behavior was not reverse-engineered solely from implementation output.

The companion manifest is `register-new-customer-v0.json`.
