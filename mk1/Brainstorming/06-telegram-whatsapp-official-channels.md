# Brainstorming 06 — Telegram + WhatsApp official channels

Date: 2026-09-04

## Problem

WebChat already proved the durable channel architecture. We now need two real messaging transports without letting provider details leak into business logic:

1. Telegram;
2. WhatsApp.

The goal is **not** to invent two new business systems. The goal is to prove that the same durable ChannelExecutionCore and Temporal Workflow Library can be reached through official provider transports.

## Product position

```text
WebChat      = first controlled browser transport
Telegram     = first external messaging transport
WhatsApp     = primary commercial messaging transport candidate
```

Telegram is useful because the official Bot API is straightforward and supports both long polling and webhooks.

WhatsApp matters commercially, but the transport must be official to reduce number/account enforcement risk and to preserve a supportable production path.

## WhatsApp provider decision candidates

### Option A — Direct Meta WhatsApp Cloud API

Preferred architectural default.

Why:

- official WhatsApp Business Platform API;
- hosted by Meta;
- removes an extra transport vendor from the critical path;
- keeps our own Channel Core as the system architecture rather than outsourcing orchestration;
- easiest path for proving that Engines owns the canonical conversation/workflow semantics.

Trade-offs:

- Meta Business / WABA / number onboarding belongs to us;
- webhook setup, token lifecycle, templates/policy handling and operational diagnostics belong to us;
- multi-customer embedded onboarding requires more product work later.

### Option B — Kapso over the official WhatsApp API

Kapso may be useful as an operational/onboarding layer. Its public material states that it exposes the official WhatsApp API, offers webhook/log/inbox tooling, customer onboarding and its own proxy/client surface.

Potential value:

- faster number/customer onboarding;
- operational logs and inbox;
- embedded signup support;
- possibility to keep a WhatsApp Business App setup while adding API access, subject to the provider/account capabilities actually verified during onboarding.

Architectural caution:

Kapso must remain a transport/provider implementation, not the owner of Engines business state.

```text
BAD
Temporal → Kapso Workflow → business truth

GOOD
Kapso/Meta transport
      ↓
WhatsAppAdapter
      ↓
CanonicalChannelEnvelope
      ↓
Engines ChannelExecutionCore
      ↓
Temporal
```

We should not build around Kapso-specific Workflows, MCP or Agents in this phase.

## Recommendation

Freeze the architecture around **Direct Meta Cloud API semantics**, while designing a provider seam that permits Kapso later without changing ChannelExecutionCore.

That means:

```text
WhatsAppTransportPort
  ├── MetaCloudApiTransport      ← default target
  └── KapsoTransport             ← optional alternate provider

                 ↓
          WhatsAppAdapter
                 ↓
      CanonicalChannelEnvelope
```

This gives us the safest dependency direction:

- Engines owns business semantics;
- Engines owns durable channel identity;
- the provider only transports messages/events;
- changing Meta-direct ↔ Kapso does not change Appointment/Customer/Services/Scheduler logic.

## Telegram strategy

Initial Telegram implementation should use the official Bot API with long polling.

Why long polling first:

- no public HTTPS endpoint required;
- good for local/integration development;
- the official API provides `update_id` specifically useful for replay/order recovery;
- later webhook parity can be added without changing canonical business handling.

Later:

```text
C2 Telegram long polling
C3 Telegram webhook parity (optional)
```

## WhatsApp initial transport strategy

WhatsApp is webhook-first for inbound production messaging.

The adapter must normalize provider payloads into the same canonical event model used by WebChat and Telegram.

Trusted deployment configuration maps a bot/phone-number/provider identity to `businessSlug`. A user message must never be able to choose or overwrite business scope.

## Provider-specific data that must stop at adapter boundary

Telegram examples:

```text
update_id
chat.id
message.message_id
callback_query.id
from.id
```

WhatsApp examples:

```text
WABA / phone-number identity
provider webhook envelope
WhatsApp message id
sender wa_id / phone identity
message type
button/list reply ids
delivery/read status events
```

These can be persisted as transport metadata/evidence, but business engines should see canonical identities and canonical actions.

## Explicit exclusions

Do not use:

- unofficial WhatsApp Web automation;
- Puppeteer/browser session bots;
- reverse-engineered WhatsApp clients;
- QR-session persistence as API architecture;
- Telegram user-account automation when a Bot API is sufficient;
- provider workflow builders as business authority;
- Agent/MCP/LLM intent routing in this gate.

## Target architecture

```text
Telegram Bot API                     WhatsApp Business Platform
      │                                       │
      ▼                                       ▼
TelegramTransport                 WhatsAppTransportPort
      │                             ├─ Meta Cloud API
      │                             └─ Kapso optional
      ▼                                       ▼
TelegramAdapter                         WhatsAppAdapter
      └─────────────────┬─────────────────────┘
                        ▼
             CanonicalChannelEnvelope
                        ▼
              ChannelExecutionCore
                        ▼
        PostgreSQL channel durability
                        ▼
                     Temporal
                        ▼
              same Workflow Library
```

## Proof philosophy

We can build and certify adapter/core semantics without immediately connecting real phone numbers/tokens.

Physical transport proof is a separate layer:

```text
contract tests
→ fixture transport tests
→ durable integration tests
→ provider sandbox/account test
→ user manual test
```

No provider is considered physically certified until an actual account/token/number path has been exercised.
