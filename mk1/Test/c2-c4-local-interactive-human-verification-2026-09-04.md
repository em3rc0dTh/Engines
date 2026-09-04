# C2/C4 local interactive E2E — human verification

Date: 2026-09-04
Operator: Eduardo
Initial branch under test: `build/mk1-c2-c4-local-interactive-e2e`
Status: **TELEGRAM HUMAN VERIFIED — WHATSAPP B2 RETEST PENDING**

> Privacy note: user-entered phone numbers and email addresses are intentionally not copied into this public evidence record.

## Test 1 — Telegram normal registration

Observed path:

```text
Telegram presentation
  → explicit consent
  → real ChannelExecutionCore
  → PostgreSQL channel ledger
  → real Temporal RegisterNewCustomer
  → name requested
  → phone requested
  → email requested
  → Customer CREATED
```

Observed Temporal truth:

```text
start
knownFields   = (none)
missingFields = customer.name, customer.contact.phone, customer.contact.email

name supplied
knownFields   = customer.name
missingFields = customer.contact.phone, customer.contact.email

phone supplied
knownFields   = customer.name, customer.contact.phone
missingFields = customer.contact.email

email supplied
Temporal      = COMPLETED / CREATED / next=NONE
missingFields = (none)
```

The simulator emitted `MESSAGING_LOCAL_E2E_PASS` with:

```text
channel        TELEGRAM
phonePrefilled false
scripted       false
agent          false
mcp            false
```

Verdict: **PASS**.

## Test 2 — Telegram invalid phone recovery

The operator intentionally supplied alphabetic phone material.

Observed:

```text
ERROR: CHANNEL_EVENT_INVALID
The same Temporal Workflow remains active; enter a new value.
```

The Workflow remained:

```text
RUNNING / WAITING_FOR_REQUIRED_DATA / next=PROVIDE_CUSTOMER_DATA
knownFields   = customer.name
missingFields = customer.contact.phone, customer.contact.email
```

The operator then used the simulated native contact-sharing path, supplied a valid email, and the **same Workflow** completed `CREATED` with `MESSAGING_LOCAL_E2E_PASS`.

Verdict: **PASS**.

This human run proves invalid Customer ingress is rejected without fabricating completion and without silently starting a second Workflow.

## Test 3 — WhatsApp sender-phone prefill + discovered duplicate gap

Observed path before the blocker:

```text
WhatsApp presentation
  → explicit consent
  → locally HMAC-verified synthetic sender
  → sender phone supplied to Temporal at start
  → name requested
  → email requested
```

Temporal correctly started with:

```text
knownFields   = customer.contact.phone
missingFields = customer.name, customer.contact.email
```

The phone was **not** requested again.

The email entered by the operator matched a Customer created during the earlier Telegram run. The canonical Customer duplicate policy therefore produced a legitimate `SOFT_MATCH` and the real Workflow moved toward `RESOLVE_DUPLICATE`.

At the time of this human run, the simulator deliberately failed closed with:

```text
LOCAL_E2E_DUPLICATE_REQUIRES_UNIQUE_INPUT
```

That result is classified as a **Customer Engine prerequisite gap**, not a WhatsApp transport/adapter failure. Plan 07 had already reserved `RESOLVE_CUSTOMER_DUPLICATE` as a required shared operation.

Verdict:

```text
WhatsApp phone prefill                     PASS
WhatsApp no redundant phone prompt         PASS
WhatsApp real Temporal progression         PASS
Customer soft-duplicate completion         BLOCKED BEFORE B2
overall WhatsApp human local E2E            RETEST REQUIRED
```

## Follow-up gate

The gap is addressed on:

```text
build/mk1-b2-customer-soft-duplicate-resolution
```

The human retest must reproduce a cross-channel soft match and observe:

```text
WAITING_FOR_DUPLICATE_DECISION / RESOLVE_DUPLICATE
  → explicit Use existing / Create new choice
  → same Temporal Workflow continues
  → ALREADY_EXISTS or CREATED
  → MESSAGING_LOCAL_E2E_PASS
```

## Current claim boundary

Allowed now:

```text
C2 Telegram local interactive deterministic E2E ✅ HUMAN VERIFIED
C4 WhatsApp local sender-phone prefill           ✅ HUMAN VERIFIED
B2 WhatsApp duplicate-resolution path            ⏳ HUMAN RETEST PENDING
```

Not allowed yet:

- C2/C4 full local E2E human verification as a combined gate;
- real Telegram Bot API certification;
- real Meta Cloud API/Kapso certification;
- public webhook certification;
- production readiness.
