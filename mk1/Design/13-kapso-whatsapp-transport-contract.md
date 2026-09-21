# Design 13 — Kapso WhatsApp transport contract

Date: 2026-09-07
Branch: `build/mk1-c4p-kapso-official`

## Invariant

```text
Kapso
  ↓ transport only
WhatsAppTransportPort
  ↓
WhatsAppAdapter
  ↓
CanonicalChannelEnvelope
  ↓
CustomerRegistrationChannelExecutionCore
  ↓
Temporal RegisterNewCustomer
```

Kapso must not own Customer policy, duplicate resolution, registration phase, persistence, Services, Scheduler, or orchestration.

## Inbound contract

For Kapso v2 phone-number webhooks:

```text
verify raw-body HMAC using X-Webhook-Signature
require whatsapp.message.received for this slice
accept single or buffered v2 payloads
validate configured phone_number_id scope
normalize text / interactive replies
preserve message.id as canonical external message identity
prefer BSUID as sender identity when present
retain verified phone as optional prefill material only
```

`senderPhone` is optional. No provider identifier is silently converted into a phone number when the provider did not supply phone identity.

## Outbound contract

Kapso WhatsApp API uses Meta-compatible message shapes:

```text
phone destination → `to`
BSUID destination → `recipient`
```

The current renderer supports text and interactive reply buttons, which is sufficient for consent and duplicate-choice UI.

## Reliability

Kapso retry/idempotency headers are transport evidence. Engines still uses the durable channel ledger and message ID to guarantee shared exact replay/material-conflict semantics across transports.

## Security

Secrets remain environment-only:

```text
KAPSO_API_KEY
KAPSO_WEBHOOK_SECRET
KAPSO_PHONE_NUMBER_ID
```

No secret or account-specific ID belongs in source, tests, logs, fixtures, or committed evidence.
