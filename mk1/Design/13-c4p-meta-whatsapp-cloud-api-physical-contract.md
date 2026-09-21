# Design 13 — C4P Meta WhatsApp Cloud API physical contract

Date: 2026-09-04
Branch: `build/mk1-c4p-whatsapp-cloud-api-official`
Status: BUILD ACTIVE

## Invariant

**ENGINE FIRST. Meta is a transport provider, not a business engine.**

```text
Meta Cloud API
  ↓
OfficialMetaCloudApiTransport
  ↓
WhatsAppAdapter
  ↓
CanonicalChannelEnvelope
  ↓
CustomerRegistrationChannelExecutionCore
  ↓
Temporal RegisterNewCustomer
```

## Provider ingress contract

Webhook callback:

```text
GET  /webhooks/whatsapp   provider subscription verification
POST /webhooks/whatsapp   provider events
GET  /health              local operational health
```

GET verification accepts the challenge only when `hub.mode=subscribe` and `hub.verify_token` matches deployment configuration.

POST processing order is frozen:

```text
raw body
→ X-Hub-Signature-256 verification with app secret
→ object == whatsapp_business_account
→ messages change extraction
→ phone_number_id scope check
→ provider message normalization
→ WhatsAppAdapter
```

No payload may reach the Customer core before signature verification.

## Canonical physical identity

For an inbound Meta message:

```text
provider message id      = wamid...
provider sender id       = message.from / WhatsApp user id
business phone identity  = metadata.phone_number_id

conversationId material  = <phone_number_id>:<sender-wa-id>
messageId material       = wamid...
senderId material        = <sender-wa-id>
```

The existing adapter then emits:

```text
externalConversationId = whatsapp:<phone_number_id>:<sender-wa-id>
externalMessageId      = whatsapp:message:<wamid>
externalSenderId       = whatsapp:user:<sender-wa-id>
```

This preserves business-phone scoping and provider event identity while keeping Customer-domain identity separate.

## Supported inbound physical slice

```text
text
interactive.button_reply
interactive.list_reply
button payload
```

Status notifications and unsupported media/reaction types are authenticated and acknowledged but do not cross the Customer CTA boundary in C4P.

## Consent and phone prefill

First unbound user text renders consent only. It does not start Temporal.

Affirmative interactive consent crosses the existing adapter and may seed the authenticated WhatsApp sender number as a Customer phone candidate. Customer/Temporal still decides validation/completeness.

Expected first Workflow state after accepted consent:

```text
knownFields   = customer.contact.phone
missingFields = customer.name, customer.contact.email
```

WhatsApp must not ask for a phone it already received through verified provider identity.

## Outbound contract

The provider transport maps Engine render output to official Graph API `messages` requests:

```text
text render
→ type=text
→ text.body

interactive render
→ type=interactive
→ interactive.type=button
→ reply buttons with canonical callback IDs
```

Access token never enters canonical envelopes, Temporal state, persistence or logs.

## Failure behavior

```text
bad GET verify token           → 403
bad POST HMAC                  → 401
wrong phone_number_id          → 500/retry, no CTA mutation
invalid Customer material      → provider error text + same Workflow remains active
provider/Temporal failure      → 500 so Meta can retry
```

Durable channel identity semantics inherited from C1B/B2 remain authoritative for provider retries.

## Physical development endpoint

A temporary public HTTPS tunnel may expose local port `8790`. The tunnel is test transport infrastructure only. It must never become Customer/Workflow authority.

## Non-claims

C4P does not certify production webhook queues, high-volume delivery, template/campaign policy, Appointment, Scheduler, Agent/MCP, Kapso or production readiness.
