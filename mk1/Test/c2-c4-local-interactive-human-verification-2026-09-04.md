# C2/C4 local interactive E2E — human verification

Date: 2026-09-04
Operator: Eduardo
Initial branch under test: `build/mk1-c2-c4-local-interactive-e2e`
Follow-up branch: `build/mk1-b2-customer-soft-duplicate-resolution`
Status: **C2/C4 LOCAL INTERACTIVE E2E ✅ HUMAN VERIFIED**

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

## Test 3 — WhatsApp sender-phone prefill exposed the B2 prerequisite

Before B2 existed, the operator exercised WhatsApp and observed:

```text
knownFields   = customer.contact.phone
missingFields = customer.name, customer.contact.email
```

The verified sender phone was not requested again. The supplied email matched an existing Customer, producing the legitimate canonical `SOFT_MATCH` condition. At that time the local simulator failed closed because deterministic duplicate resolution had not yet been implemented.

That finding created the bounded B2 Customer soft-duplicate resolution gate. It was a Customer-domain prerequisite, not a WhatsApp adapter defect.

Verdict:

```text
WhatsApp sender-phone prefill              PASS
WhatsApp no redundant phone prompt         PASS
WhatsApp real Temporal progression         PASS
Customer duplicate-resolution prerequisite DISCOVERED
```

## Test 4 — WhatsApp full local interactive completion after B2

On `build/mk1-b2-customer-soft-duplicate-resolution`, the operator reran the local messaging laboratory interactively with WhatsApp.

Observed Temporal sequence:

```text
start
Temporal      = RUNNING / RESERVING_REGISTRATION / next=PROVIDE_CUSTOMER_DATA
knownFields   = customer.contact.phone
missingFields = customer.name, customer.contact.email

name supplied
Temporal      = RUNNING / WAITING_FOR_REQUIRED_DATA / next=PROVIDE_CUSTOMER_DATA
knownFields   = customer.name, customer.contact.phone
missingFields = customer.contact.email

email supplied
Temporal      = COMPLETED / CREATED / next=NONE
knownFields   = customer.name, customer.contact.phone, customer.contact.email
missingFields = (none)
```

The simulator emitted:

```text
Outcome         CREATED
channel         WHATSAPP
phonePrefilled  true
scripted        false
agent           false
mcp             false
MESSAGING_LOCAL_E2E_PASS
```

No phone prompt was rendered after the verified WhatsApp sender phone had been accepted at Workflow start.

Verdict: **PASS**.

## Human gate closure

The human verification requirement for the local C2/C4 gate was:

```text
Telegram interactive path reaches real Temporal Customer completion
WhatsApp interactive path reaches real Temporal Customer completion
provider-derived WhatsApp phone is not requested again
at least one invalid human input is rejected while the same Workflow remains active
```

All four conditions have now been observed by the operator.

Allowed claim:

```text
C2 Telegram local interactive deterministic E2E ✅ HUMAN VERIFIED
C4 WhatsApp local interactive deterministic E2E ✅ HUMAN VERIFIED
C2/C4 LOCAL INTERACTIVE E2E                  ✅ HUMAN VERIFIED
```

## B2 human-observation boundary

B2 itself is already deterministic runtime-certified by GitHub Actions. The final WhatsApp human run above followed the unique-input `CREATED` path, so the specific human UI path:

```text
WAITING_FOR_DUPLICATE_DECISION
  → RESOLVE_DUPLICATE
  → USE_EXISTING or CREATE_NEW
```

was **not separately observed by the operator in this final run**.

Therefore the precise state is:

```text
B2 Customer soft-duplicate resolution       ✅ AUTOMATED / RUNTIME CERTIFIED
B2 duplicate-decision UI path               ⏳ HUMAN OBSERVATION OPTIONAL / NOT REQUIRED FOR C2/C4 CLOSURE
```

## Non-claims

This human verification does not certify:

- real Telegram Bot API;
- a real Telegram bot token/account path;
- real Meta Cloud API or Kapso;
- public webhook reachability;
- Appointment over messaging;
- Scheduler runtime;
- Agent/MCP/LLM routing;
- production readiness.
