# Design 10 — C2/C4 official messaging-channel contract

Date: 2026-09-04
Status: DESIGN FROZEN ENOUGH FOR BUILD

## Scope

This contract defines the provider boundaries for:

- C2 Telegram;
- C4 WhatsApp.

C3 remains available for optional Telegram webhook parity after C2 long-polling proof.

No Agent/MCP/LLM routing is introduced.

## Existing canonical boundary

The C1B contract remains authoritative:

```ts
CanonicalChannelEnvelope {
  version: 'v1'
  channel: 'WEBCHAT' | 'TELEGRAM' | 'WHATSAPP'
  businessSlug: string
  externalConversationId: string
  externalMessageId: string
  externalSenderId: string
  action: CanonicalChannelAction
  payload: object
}
```

Telegram and WhatsApp must normalize into this contract before business execution.

## Provider architecture

```text
                         ┌──────────────────────┐
Telegram Bot API ───────▶│ TelegramTransport    │
                         └──────────┬───────────┘
                                    ▼
                             TelegramAdapter
                                    │
                                    │
                                    ▼
                           CanonicalChannelEnvelope
                                    ▲
                                    │
                              WhatsAppAdapter
                                    ▲
                                    │
                         ┌──────────┴───────────┐
                         │ WhatsAppTransportPort │
                         └───────┬────────┬─────┘
                                 │        │
                                 ▼        ▼
                          Meta Cloud    Kapso
                          API default   optional

                                    ↓
                         ChannelExecutionCore
                                    ↓
                    PostgreSQL durable channel ledger
                                    ↓
                                 Temporal
                                    ↓
                         same Workflow Library
```

## Trusted business scope

`businessSlug` is server/deployment configuration.

Examples:

```text
Telegram bot token / deployment
→ configured businessSlug

WhatsApp phone_number_id / WABA deployment
→ configured businessSlug
```

Inbound text, callback payloads, button replies or arbitrary provider metadata are not allowed to choose a different business scope.

## Telegram normalization

### Conversation identity

Initial C2 private-chat identity:

```text
externalConversationId = telegram:<chat.id>
```

Thread/topic support may extend the identity later without changing business logic.

### Inbound event identity

```text
externalMessageId = telegram:update:<update_id>
```

This makes the Telegram transport replay boundary align with the durable C1B event ledger.

### Sender identity

```text
externalSenderId = telegram:user:<from.id>
```

### Supported inbound material for first build

```text
message.text
callback_query.data
```

Media is deferred.

### Long-polling state

The Telegram runner must only advance its acknowledged polling offset after the update has been safely handed into Engines processing semantics.

A restarted bot must be able to resume without producing duplicate business effects. Duplicate delivery remains harmless because the durable inbound-event ledger is authoritative.

## WhatsApp normalization

### Transport provider seam

```ts
interface WhatsAppTransportPort {
  verifyInbound(...): Promise<VerifiedWhatsAppEvent>
  sendMessage(...): Promise<WhatsAppSendResult>
}
```

Candidate implementations:

```text
MetaCloudApiTransport   preferred/default
KapsoTransport          optional
```

The adapter above this port must not care which official transport implementation is active.

### Conversation identity

Initial one-to-one business conversation identity:

```text
externalConversationId = whatsapp:<business-phone-identity>:<sender-wa-id>
```

The concrete identity encoding may use normalized provider IDs, but must remain deterministic and business-scoped.

### Inbound event identity

For inbound user messages:

```text
externalMessageId = whatsapp:message:<provider-message-id>
```

Delivery/read/status notifications are transport events, not canonical Appointment actions. They belong to a separate status/evidence handling path and must not accidentally re-enter the business-action dispatcher.

### Sender identity

```text
externalSenderId = whatsapp:user:<sender-wa-id>
```

### First supported inbound material

```text
text messages
interactive button replies
interactive list replies
```

Media remains later.

## Webhook verification

WhatsApp inbound webhook handling must fail closed before canonical execution if authenticity/verification requirements are not satisfied.

No unverified webhook payload is allowed to reach ChannelExecutionCore.

Provider-specific verification material must not leak into business logic.

## Outbound rendering boundary

Business/workflow state produces provider-independent render intent.

Adapters render it into provider capabilities.

Example:

```text
Workflow wants:
SELECT_SERVICE choices

TelegramRenderer
→ inline keyboard buttons

WhatsAppRenderer
→ supported interactive reply/list representation

WebChatRenderer
→ HTML controls
```

The visible labels may differ by provider constraints, but selected canonical IDs/actions must be equivalent.

## Canonical operation mapping

Initial Appointment operation vocabulary remains explicit:

```text
START_APPOINTMENT
PROVIDE_CUSTOMER
RESOLVE_CUSTOMER
SELECT_SERVICE
SELECT_OFFERING
SET_DATE
SELECT_SLOT
FINALIZE_APPOINTMENT
```

No free-text semantic classifier is added.

Transport text may only be accepted where the current deterministic Workflow step explicitly expects text material.

## Idempotency invariants

All transports inherit C1B:

```text
same externalMessageId + same normalized material
→ replay recorded result

same externalMessageId + different normalized material
→ CHANNEL_EVENT_IDENTITY_CONFLICT

process restart
→ recover conversation binding
→ same Temporal Workflow
```

Provider retry behavior is never trusted as the sole duplicate defense.

## Secrets

Never commit:

```text
TELEGRAM_BOT_TOKEN
Meta access tokens
WhatsApp app secret
webhook verify token
Kapso API key
```

Build fixtures use deterministic synthetic secrets/requests. Real transport proof uses environment variables or repository/environment secrets.

## Provider policy boundary

WhatsApp transport policy constraints such as template eligibility, provider messaging restrictions and onboarding state belong to the WhatsApp transport/integration layer.

They do not change Services, Scheduler or Appointment domain truth.

## Explicitly forbidden

- WhatsApp Web automation;
- unofficial WhatsApp protocol clients;
- business writes from Telegram/WhatsApp adapters;
- direct Customer/Services/Scheduler/Appointment repository access from provider code;
- provider-specific Temporal Appointment Workflows;
- Kapso Workflows/Agents/MCP as canonical orchestration in this phase;
- Telegram-specific business phases;
- WhatsApp-specific business phases.

## Certification boundary

### C2 Telegram automated gate may certify

- Telegram fixture normalization;
- long-poll update identity/offset semantics;
- exact duplicate replay;
- identity conflict rejection;
- bot-process restart recovery against durable channel binding;
- complete Appointment through ChannelExecutionCore using a deterministic Bot API harness;
- WebChat regression remains green.

It does **not** certify a real Telegram bot until a real bot token/account is tested.

### C4 WhatsApp automated gate may certify

- Meta-format webhook verification/normalization fixtures;
- message/button/list reply mapping;
- exact duplicate replay;
- identity conflict rejection;
- provider process restart recovery;
- complete Appointment through ChannelExecutionCore using a deterministic WhatsApp transport harness;
- WebChat/Telegram regressions remain green where applicable.

It does **not** certify a real WhatsApp number or production Meta/Kapso account until physically tested.
