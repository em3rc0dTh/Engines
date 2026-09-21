# Design 10 — C2/C4 official messaging-channel contract

Date: 2026-09-04
Status: DESIGN FROZEN ENOUGH FOR BUILD

## Architecture invariant

**Engines comes first. CTA is independent and replaceable.**

Telegram and WhatsApp are not new Engines and are not new business architectures. They are only additional client transports into the same canonical CTA boundary already exercised through CLI, HTTP/Postman and WebChat.

Normative reference: [`11-engine-first-cta-independence.md`](11-engine-first-cta-independence.md).

```text
CLI ───────────┐
HTTP/API ──────┤
WebChat ───────┤
Telegram ──────┤── CTA adapters ── canonical CTA/channel contract ── ENGINES
WhatsApp ──────┘
```

The transport may change. Engine business behavior must not.

## Scope

This contract defines only provider/transport boundaries for:

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

Telegram and WhatsApp normalize provider material into this contract before Engines business execution.

## Provider architecture

```text
Telegram Bot API
      ↓
TelegramTransport
      ↓
TelegramAdapter
      ↓
CanonicalChannelEnvelope
      │
      │
      ├──────────────────────────────┐
      │                              │
      ▼                              │
ChannelExecutionCore                 │
      ↓                              │
PostgreSQL durable channel ledger    │
      ↓                              │
Temporal                             │
      ↓                              │
Engine Workflow Library              │
                                     │
WhatsApp official provider           │
      ↓                              │
WhatsAppTransportPort                │
      ├── MetaCloudApiTransport      │
      └── KapsoTransport (optional)  │
      ↓                              │
WhatsAppAdapter                      │
      ↓                              │
CanonicalChannelEnvelope ────────────┘
```

Meta direct vs Kapso is a transport/infrastructure decision only. Neither choice is allowed to own Workflow or domain truth.

## Transport-only responsibilities

Telegram/WhatsApp code may own only:

```text
provider connection mechanics
provider authentication / webhook verification
provider event identity
conversation identity
sender identity
provider retry / polling / acknowledgement mechanics
payload normalization
canonical input/action mapping
outbound rendering
```

It may not own Customer, Services, Scheduler, Appointment or Temporal business policy.

## Trusted business scope

`businessSlug` is server/deployment configuration.

Examples:

```text
Telegram bot deployment
→ configured businessSlug

WhatsApp phone_number_id / WABA deployment
→ configured businessSlug
```

Inbound text, callback payloads, button replies or arbitrary provider metadata are not allowed to choose another business scope.

## Telegram normalization

### Conversation identity

```text
externalConversationId = telegram:<chat.id>
```

Thread/topic support may extend this later without changing the Engine.

### Inbound event identity

```text
externalMessageId = telegram:update:<update_id>
```

### Sender identity

```text
externalSenderId = telegram:user:<from.id>
```

### First supported inbound material

```text
message.text
callback_query.data
```

Media is deferred.

### Long-polling state

The Telegram runner advances its acknowledged polling offset only after an update has been safely handed into Engines processing semantics.

A restarted bot may redeliver transport material, but duplicate business effects remain prevented by the durable C1B inbound-event ledger.

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
KapsoTransport          optional official transport implementation
```

`WhatsAppAdapter` must not care which official transport implementation is active.

### Conversation identity

```text
externalConversationId = whatsapp:<business-phone-identity>:<sender-wa-id>
```

### Inbound event identity

```text
externalMessageId = whatsapp:message:<provider-message-id>
```

Delivery/read/status notifications are transport events, not canonical Appointment actions. They must not re-enter the business-action dispatcher.

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

No unverified webhook payload may reach ChannelExecutionCore.

Provider verification material terminates at the transport boundary.

## Outbound rendering boundary

The Engine/Workflow produces provider-independent render intent. The transport renderer converts it to provider controls.

```text
Engine state: SELECT_SERVICE choices

WebChatRenderer   → HTML controls
TelegramRenderer  → inline keyboard
WhatsAppRenderer  → supported interactive reply/list
```

Visible representation may differ, but canonical selected IDs/actions must remain equivalent.

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

Transport text is accepted only where the deterministic current Workflow step expects text material.

## Idempotency invariants

All transports inherit C1B:

```text
same externalMessageId + same normalized material
→ replay recorded result

same externalMessageId + different normalized material
→ CHANNEL_EVENT_IDENTITY_CONFLICT

transport process restart
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

Build fixtures use deterministic synthetic requests. Real transport proof uses environment variables or repository/environment secrets.

## Provider policy boundary

WhatsApp transport restrictions such as template eligibility, provider messaging restrictions and onboarding state belong to the transport/integration edge.

They do not change Customer, Services, Scheduler, Appointment or Temporal truth.

## Explicitly forbidden

- WhatsApp Web automation;
- unofficial WhatsApp protocol clients;
- business writes from Telegram/WhatsApp adapters;
- direct Customer/Services/Scheduler/Appointment repository access from provider code;
- provider-specific Temporal Appointment Workflows;
- Kapso Workflows/Agents/MCP as canonical orchestration;
- Telegram-specific business phases;
- WhatsApp-specific business phases;
- provider SDK types leaking into domain contracts;
- rebuilding Engine logic inside a channel branch.

## Certification boundary

### C2 Telegram automated gate may certify

- Telegram fixture normalization;
- long-poll identity/offset semantics;
- exact duplicate replay;
- identity conflict rejection;
- bot-process restart recovery against durable channel binding;
- complete Appointment through the existing Engine using a deterministic Bot API harness;
- WebChat regression remains green.

It does **not** certify a real Telegram bot until a real bot token/account is tested.

### C4 WhatsApp automated gate may certify

- official provider-format webhook verification/normalization fixtures;
- message/button/list reply mapping;
- exact duplicate replay;
- identity conflict rejection;
- transport-process restart recovery;
- complete Appointment through the existing Engine using a deterministic WhatsApp harness;
- WebChat/Telegram regressions remain green where applicable.

It does **not** certify a real WhatsApp number or production Meta/Kapso account until physically tested.
