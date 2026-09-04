# C2/C4 — Local interactive customer-registration E2E

Date: 2026-09-04
Status: BRAINSTORMING FROZEN FOR BUILD

## Goal

Give a human operator a local conversation surface that behaves like Telegram or WhatsApp while executing the real Engines path underneath:

```text
simulated provider conversation
        ↓
real TelegramAdapter / WhatsApp transport+adapter
        ↓
CanonicalChannelEnvelope
        ↓
real CustomerRegistrationChannelExecutionCore
        ↓
real PostgreSQL durable channel ledger
        ↓
real Temporal RegisterNewCustomer Workflow
        ↓
real Customer persistence/audit
```

No Telegram Bot API token, Meta token, Kapso key, public webhook, Agent, MCP or LLM is required.

## Why this gate exists

The adapter unit tests prove normalization. They do not let a human see the provider conversation react to live Temporal `missingFields` and produce a real Customer.

This gate closes that gap without pretending that a real external provider has been certified.

## Expected human behavior

### WhatsApp mode

The lab transport owns a synthetic verified sender phone. After consent the phone enters the canonical start draft, so Temporal should report phone as known and ask only for remaining required fields.

```text
consent YES
→ sender phone prefilled
→ ask name
→ ask email
→ Customer CREATED
```

### Telegram mode

Telegram identity is not a phone number. The conversation therefore follows Temporal V2 policy and asks for name, phone and email. At the phone step the human may use a synthetic `request_contact` equivalent or type a phone.

```text
consent YES
→ ask name
→ ask phone / share contact
→ ask email
→ Customer CREATED
```

## Authority rule

The simulator must never hard-code registration completeness or field order. It renders the `CustomerRegistrationRenderIntent` projected from the real Temporal registration state.

## Negative input behavior

Invalid phone/email input must be rejected by the canonical ingress/core path. The same Workflow remains alive and the UI asks again using a new provider event identity.

## Explicit non-claims

Passing this gate does not certify:

- Telegram Bot API connectivity;
- Meta Cloud API connectivity;
- Kapso connectivity;
- public webhooks;
- outbound campaigns;
- Appointment;
- Scheduler;
- Agent/MCP;
- production readiness.
