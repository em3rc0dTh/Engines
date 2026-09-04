# Plan 07 — C2/C4 RegisterNewCustomer transport slice

Date: 2026-09-04
Status: DESIGN/PLAN READY — BUILD NOT STARTED

## Objective

Implement Telegram and WhatsApp as two independent CTA transports that both exercise the same existing `RegisterNewCustomer` Temporal Workflow.

No Appointment business flow is included in this first messaging slice.

## Branch sequence

When build starts, keep transports separate:

```text
build/mk1-c2-telegram-customer-registration
build/mk1-c4-whatsapp-customer-registration
```

Do not combine provider runtime code and Engine-domain policy changes into the same branch.

If the Customer Engine registration policy is changed to require both phone and email, open a separate domain branch first.

## Shared prerequisite — Channel Core customer actions

Before either provider can complete registration, extend the transport-independent channel core with Customer registration operation support:

```text
START_CUSTOMER_REGISTRATION
PROVIDE_CUSTOMER_DATA
FINALIZE_CUSTOMER_REGISTRATION
RESOLVE_CUSTOMER_DUPLICATE (when required)
```

The implementation must reuse:

```text
channel_conversation_bindings
channel_inbound_events
stable operation input identity
Temporal RegisterNewCustomer port
existing PostgreSQL Customer authority
existing Mongo registration audit
```

No new provider-specific durable business store.

## C2 Telegram slice

Build:

```text
Telegram Bot API transport runner
TelegramAdapter
TelegramRenderer
contact-share input mapping
same ChannelExecutionCore Customer operation
```

Initial supported material:

```text
text
callback_query.data
contact share
```

Telegram-specific test points:

- chat/user IDs remain transport identities;
- phone is never inferred from Telegram IDs;
- explicit contact share can become a canonical phone patch;
- typed phone remains supported;
- process restart recovers the same Customer Workflow;
- duplicate update is harmless.

## C4 WhatsApp slice

Build against a provider-independent WhatsApp transport port first:

```text
WhatsAppTransportPort
        ↓
WhatsAppAdapter
        ↓
WhatsAppRenderer
        ↓
ChannelExecutionCore
```

Provider implementation remains undecided during the core build:

```text
Meta Cloud API direct
or
Kapso official transport implementation
```

Initial supported material:

```text
text
interactive reply/button
interactive list reply
```

WhatsApp-specific test points:

- official sender identity is normalized at the transport boundary;
- safe phone prefill occurs only after explicit registration acceptance and canonical validation;
- no duplicate request for a phone already accepted into Workflow state;
- provider process restart recovers the same Customer Workflow;
- duplicate provider delivery is harmless;
- webhook authenticity fails closed before canonical execution.

## Conversation UX target

### WhatsApp

```text
Business/Customer entry
→ "¿Me permites guardar tus datos para registrarte?"
→ [Sí, registrarme]
→ phone prefilled when safe
→ ask name
→ ask email only if canonical policy requires/is intentionally collected
→ explicit finalize
→ "Registro completado ✅"
```

### Telegram

```text
Customer entry
→ "¿Me permites guardar tus datos para registrarte?"
→ [Sí, registrarme]
→ ask name
→ ask email according to canonical policy
→ request/share phone if canonical policy requires phone
→ explicit finalize
→ "Registro completado ✅"
```

The exact order must skip any field already known and must follow Workflow `missingFields` truth.

## Current policy blocker to decide before final manual UX certification

Current policy only requires name + (phone OR email).

The requested target experience expects name + phone + email.

Before claiming that exact minimum, choose one:

```text
A. preserve current policy
   → channels finish once name + one contact method is complete

B. evolve Customer Engine policy
   → add independent phone/email requirements
   → certify domain change separately
   → channels automatically follow new missingFields
```

Architecture recommendation: B if the product truly requires all three fields for every new Customer; otherwise keep it business-configurable rather than universal.

## Manual-test boundary

When each provider adapter is ready, the user should be able to manually prove:

```text
first contact
→ consent
→ same RegisterNewCustomer Workflow visible
→ data gathered through the real messaging client
→ process restart/recovery
→ Customer completion
```

No provider is considered physically certified until that human test is completed.

## Deferred

- Appointment over messaging;
- advisor handoff;
- promotional campaign scheduler;
- recurring monthly marketing sends;
- media ingestion;
- Telegram webhook parity;
- Agent/MCP/LLM routing.
