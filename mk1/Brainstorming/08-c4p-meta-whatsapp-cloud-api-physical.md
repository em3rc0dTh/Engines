# Brainstorming 08 — C4P Meta WhatsApp Cloud API physical proof

Date: 2026-09-04
Branch: `build/mk1-c4p-whatsapp-cloud-api-official`

## Goal

Connect a real WhatsApp user to the already-integrated Customer registration Engine through Meta's official WhatsApp Cloud API without moving business policy into the provider layer.

```text
real WhatsApp user
→ Meta Cloud API
→ public HTTPS webhook
→ provider verification/normalization
→ WhatsAppAdapter
→ CustomerRegistrationChannelExecutionCore
→ PostgreSQL
→ Temporal RegisterNewCustomer
→ Customer
→ Graph API reply
```

## Frozen architectural choices

- Direct Meta Cloud API is the first physical WhatsApp provider target.
- `WhatsAppTransportPort` remains the provider seam; Kapso stays optional later.
- No WhatsApp Web automation, QR-session scraping, browser emulation or reverse-engineered client.
- Meta may own delivery/authentication mechanics only; it may not own Customer completeness, duplicate policy, Workflow state or persistence.
- `businessSlug` remains trusted deployment configuration.
- verified sender WhatsApp identity may seed the canonical phone candidate after explicit registration consent.
- consent rejection creates no Workflow and no Customer.

## Physical test path

For development, Engines can expose its local webhook through a temporary public HTTPS tunnel. The tunnel is transport test infrastructure only, not production architecture.

The first real flow should be:

```text
customer sends a message to Meta test/business number
→ Engines returns registration consent buttons
→ user accepts
→ sender phone is prefilled
→ Temporal asks name + email
→ invalid input remains recoverable
→ Customer CREATED
→ completion message returns through Meta
```

## Secret boundary

Never commit or print:

```text
WHATSAPP_APP_SECRET
WHATSAPP_ACCESS_TOKEN
WHATSAPP_WEBHOOK_VERIFY_TOKEN
```

Provider identifiers such as phone-number ID may be logged for routing diagnostics, but personal customer phone/email material should not be copied into public evidence receipts.

## Out of scope

- campaigns/templates as a product feature;
- Appointment over WhatsApp;
- advisor handoff;
- Scheduler runtime;
- production hosting;
- Agent/MCP/LLM routing.
