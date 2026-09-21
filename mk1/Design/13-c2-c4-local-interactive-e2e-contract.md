# Design 13 — C2/C4 local interactive E2E contract

Date: 2026-09-04
Status: DESIGN FROZEN FOR BUILD

## Runtime composition

```text
Human terminal
   ↓
provider-shaped local fixture
   ↓
TelegramAdapter
      OR
MetaCloudApiTransport fixture → WhatsAppAdapter
   ↓
CanonicalChannelEnvelope
   ↓
CustomerRegistrationChannelExecutionCore
   ↓
PostgresChannelRepository
   ↓
TemporalRegisterNewCustomerPort
   ↓
registerNewCustomerWorkflow
   ↓
PostgreSQL Customer authority + Mongo audit
```

The terminal simulator is a laboratory CTA surface. It is not a new Engine and it owns no registration policy.

## State authority

After every accepted event, the simulator queries `GetRegistrationState` from the bound Temporal Workflow and passes that state through `projectCustomerRegistration`.

Only the resulting provider-independent `renderIntent` chooses the next visible prompt.

Allowed intents in this slice:

```text
ASK_CUSTOMER_NAME
ASK_CUSTOMER_PHONE
ASK_CUSTOMER_EMAIL
FINALIZE_REGISTRATION
REGISTRATION_COMPLETE
REGISTRATION_FAILED
WAIT
```

## WhatsApp fixture contract

The local WhatsApp path deliberately exercises the existing HMAC transport seam before the adapter:

```text
synthetic provider payload
→ local HMAC signature
→ MetaCloudApiTransport.verifyAndNormalize
→ VerifiedWhatsAppInbound
→ WhatsAppAdapter
```

The synthetic sender phone is unique per run and is included in the consent-start draft exactly as a verified provider transport would provide it.

No Meta credentials are used.

## Telegram fixture contract

Telegram updates are provider-shaped objects containing synthetic `update_id`, `chat.id`, `from.id`, callback/text/contact material.

The adapter produces the same canonical envelope it would produce for Bot API updates.

No Bot API token is used.

## Event identity

A monotonically increasing synthetic provider event sequence is used inside one lab conversation.

Every retry after invalid input receives a new provider event ID. This preserves the C1B rule that an event identity is immutable material.

## Query timing

Temporal updates and Workflow main-thread progression are asynchronous. The simulator may retry state queries for a bounded period and may briefly display `WAIT` while durable progress continues.

It must never fabricate a later state.

## Completion

A passing human run ends only when live Workflow state reports completion/creation and contains a Customer result. The simulator prints:

```text
channel
externalConversationId
workflowId
runId when available
customerId
knownFields
missingFields
```

and a machine-searchable marker:

```text
MESSAGING_LOCAL_E2E_PASS
```

## Failure boundary

Validation errors are shown as transport/core errors and the same Workflow remains active. Workflow failure is terminal and produces `MESSAGING_LOCAL_E2E_FAIL`.

## Forbidden shortcuts

- hard-coded name→phone→email state machine in the simulator;
- direct Customer repository writes;
- direct invocation of registration persistence activities;
- bypassing the Telegram/WhatsApp adapters;
- pretending synthetic identities are real provider events;
- requiring host PostgreSQL port exposure;
- adding Agent/MCP/LLM routing.
