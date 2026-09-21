# Quarry 02 — Channel Idempotency and Recovery Patterns

## Purpose

Mine the already-certified MK0/MK1 runtime for reusable correctness patterns before C1B introduces durable channel correlation.

## Specimens inspected

### Appointment start idempotency

`TemporalRegisterNewAppointmentPort.start()` already provides the exact recovery primitive C1B needs for channel start replay:

```text
workflow identity material
  operation + businessSlug + idempotencyKey
        ↓ SHA-256
stable Temporal workflowId
```

On `WorkflowExecutionAlreadyStartedError`, the port queries the existing Workflow initial fingerprint. Exact initial material returns the existing Workflow identity; different material raises `APPOINTMENT_SESSION_IDEMPOTENCY_CONFLICT`.

Implication for C1B:

> The canonical inbound start event identity should become the Appointment start idempotency key instead of inventing a parallel workflow-start dedupe mechanism.

### Appointment Update identity

The existing CTA exposes explicit Appointment Updates with mandatory `inputId`:

```text
ProvideAppointmentCustomer
ResolveAppointmentCustomer
SelectAppointmentService
SelectAppointmentProduct
SetAppointmentDate
SelectAppointmentSlot
FinalizeAppointment
```

Implication for C1B:

> The durable inbound channel event identity should deterministically produce the existing `inputId`. Transport retry then reuses the same Workflow-level logical update identity.

### Canonical JSON fingerprinting

MK0 already freezes deterministic `canonicalJson()` semantics: recursively sorted object keys, undefined values omitted, array ordering retained.

Implication:

> Channel material fingerprinting should reuse this canonicalization rather than introducing provider-specific or JSON-string-order-dependent hashes.

### Services S4 command ledger

S4 established the policy that one logical identity plus material hash yields:

```text
same identity + same material -> replay
same identity + different material -> typed conflict
```

It also established that rejected commands must not leave partial business state.

Implication:

> C1B should apply the same identity/material distinction to inbound transport events, while keeping channel correlation separate from Services business truth.

### C1A Workflow visibility

C1A already proved that WebChat can query the actual Appointment state and project the Workflow into a deterministic 12-step view. Browser state is presentation only.

Implication:

> C1B must preserve the C1A projection and replace only conversation/event correlation authority. It must not create a second phase engine.

## Authority classification

```text
Temporal
  Workflow phase/history/update execution

PostgreSQL
  channel conversation binding
  inbound event identity/fingerprint/result

Browser / Telegram process
  transport state only

Mongo
  optional semantic transport evidence
```

## Failure windows to prove

### F1 — duplicate before execution

Same event is submitted twice before any business operation is needed.

Expected: first claim executes; second exact replay returns the durable result.

### F2 — conflict

Same `(channel,business,eventId)` arrives with different canonical material.

Expected: typed conflict; no CTA/Workflow call for conflicting material.

### F3 — adapter restart

Binding exists; WebChat server stops and restarts.

Expected: external conversation resolves to the same Workflow from PostgreSQL.

### F4 — crash after Workflow effect, before event completion

This is the hardest logical window.

Expected safety mechanism:

```text
channel event identity
→ stable Appointment idempotencyKey/inputId
→ replay reaches same Workflow logical operation
```

The channel ledger may resume/re-execute, but the business effect stays singular.

## Anti-patterns rejected

```text
in-memory Map as binding authority
localStorage as canonical workflow binding
provider name inside Appointment Workflow policy
separate Telegram business workflow
random inputId regenerated on retry
fingerprint based on raw provider JSON ordering
channel ledger used as shadow Appointment database
```

## Conclusion

C1B should compose already-certified idempotency primitives rather than duplicate them. The new work is a durable transport ledger and generic channel execution boundary; Temporal and existing Workflow input identities remain the final protection against transport crash/retry ambiguity.
