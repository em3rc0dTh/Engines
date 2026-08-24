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

No framework or HTTP status is part of the canonical expected behavior.

The Temporal requirement is explicit: **mk0 must prove a real Temporal Service + Workflow + Task Queue + Worker + Activity + Query/Update execution path.** A custom in-process state machine does not satisfy the golden contract.

The dataset also freezes the closure decisions in `Design/06-mk0-closure-decisions.md`:

- a structurally legal registration session may start with incomplete Customer data;
- session idempotency is scoped by `(operation, businessSlug, idempotencyKeyHash)`;
- the normalized initial start snapshot is fingerprinted, while later `ProvideCustomerData` Updates do not rewrite that fingerprint;
- success-gating MongoDB audit milestones must exist before a registration may be reported successful;
- the current mk0 CTA proof surfaces are Postman and CLI.

## Case inventory

### GD-001 — Minimal valid Customer

Complete-at-start Customer follows the policy and produces one PostgreSQL Customer plus required MongoDB audit/context.

### GD-002 — Full Customer

Document/contact/notes persist according to approved TimeSlots semantics without inventing missing facts.

### GD-003 — One attachment

One committed AttachmentStore object, one PostgreSQL business reference and matching integrity metadata.

### GD-004 — Multiple attachments

Every requested attachment commits once logically and finalization waits for mandatory effects.

### GD-005 — Exact start/session replay

Same business-scoped registration-session identity and same initial-start fingerprint resolve the same logical Workflow/session rather than creating a second registration attempt.

### GD-006 — Same-session immutable start conflict

Reuse the same `RegisterNewCustomer` + `businessSlug` + idempotency key with a materially different normalized **initial start snapshot**.

Expected:

```text
secondStartAccepted = false
secondErrorCode = SESSION_IDEMPOTENCY_CONFLICT
additionalPostgresCustomerDelta = 0
```

This case is intentionally same-business. Reusing the same opaque key value under a different `businessSlug` is a different business-scoped idempotency identity and is not this conflict.

### GD-007 — Invalid start envelope

Malformed/unknown operation, missing businessSlug or missing session identity is rejected before Workflow start with zero business persistence effects.

Missing Customer business fields are **not** this case; those belong to GD-015.

### GD-008 — Transient PostgreSQL failure

Temporal retries/recovery produce the correct single logical result after PostgreSQL recovers.

### GD-009 — Transient AttachmentStore failure

No false finalization; one logical attachment exists after recovery.

### GD-010 — Permanent attachment integrity mismatch

Typed terminal failure and no false successful Customer finalization.

### GD-011 — Temporal Worker restart

Workflow resumes with no lost accepted session or duplicated business effect.

### GD-012 — Scheduling isolation

Appointment, ResourceReservation and AvailabilitySlot mutation deltas remain zero.

### GD-013 — CTA disconnect/reconnect continuity

CTA disconnects after Workflow start. Temporal keeps the durable registration state. A later CTA session queries/updates the same Workflow identity and observes the same state/outcome.

### GD-014 — Full Temporal runtime proof

Evidence must show:

```text
Temporal Client
→ Temporal Service
→ Task Queue
→ Worker
→ RegisterNewCustomer Workflow
→ Query / Update / Activities
```

Required evidence includes Workflow ID/Run ID, visibility/Web UI or CLI evidence, Worker polling/execution, Event History and persistence Activity execution.

### GD-015 — Intent-only / partial start

Start with a legal registration session but no complete Customer.

Expected:

```text
workflowStarted = true
phase = WAITING_FOR_REQUIRED_DATA
missingFields = exact fields from frozen RegistrationPolicy
customerCreated = false
```

This proves Temporal, not the CTA, owns missing-information state.

### GD-016 — Multi-round data collection

Provide required Customer data in at least two separate `ProvideCustomerData` Updates.

Expected:

- same Workflow identity throughout;
- the original start fingerprint remains unchanged;
- state survives between Updates;
- missing fields shrink deterministically;
- accepted interactions are represented in MongoDB audit according to policy;
- creation occurs only after required data is complete.

### GD-017 — Policy-defined hard duplicate

First create a Customer. Start a second registration whose completed draft matches a `HARD_UNIQUE` identifier under the frozen policy.

Expected:

```text
phase = ALREADY_EXISTS
created = false
existing customerId returned
PostgreSQL Customer delta = 0
```

### GD-018 — Policy-defined soft duplicate

Completed draft matches only a `SOFT_MATCH` attribute such as a fixture phone/email under the test policy.

Expected: Workflow exposes the configured possible-duplicate state/outcome and does not silently convert it into a hard uniqueness rule.

## Mandatory audit success rule

A successful Golden Dataset case must prove the applicable logical MongoDB audit milestones defined by the closure design, including:

```text
REGISTRATION_SESSION_STARTED
REGISTRATION_POLICY_LOADED
REQUIRED_DATA_REQUESTED          when applicable
CUSTOMER_DATA_ACCEPTED           per logical accepted input
DUPLICATE_CHECK_COMPLETED
EXISTING_CUSTOMER_RESOLVED       or CUSTOMER_CREATED
ATTACHMENT_COMMITTED             when applicable
REGISTRATION_COMPLETED
```

Retry-safe representation is required; duplicate physical audit events caused solely by retry are not acceptable.

If required audit cannot be persisted after the frozen retry policy is exhausted, the registration cannot be reported as successful. Temporal Event History remains the durable orchestration evidence for a failure caused by the unavailable audit store.

## Data rules

Use synthetic people/identifiers only. Do not place real Customer PII in the dataset.

Attachment fixtures, when added, should be small synthetic objects with frozen hashes.

The Golden Dataset must also freeze at least one RegistrationPolicy fixture containing:

```text
required fields
normalization rules
hard unique key(s)
soft match key(s)
completion behavior
```

## Approval rule

`v0` is approved when:

- every case is machine-readable;
- interactive state expectations are explicit;
- policy fixtures are versioned;
- business-scoped idempotency and initial-start fingerprint behavior are explicit;
- expected PostgreSQL/MongoDB/AttachmentStore effects are explicit;
- mandatory audit-before-success behavior is explicit;
- unresolved attachment fixture hashes are frozen or explicitly marked;
- Design and Golden Dataset agree;
- real Temporal runtime/message-passing evidence is required;
- expected behavior was not reverse-engineered solely from implementation output.

The companion manifest is `register-new-customer-v0.json`.
