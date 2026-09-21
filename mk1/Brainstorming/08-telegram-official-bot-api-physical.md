# Brainstorming 08 — Telegram official Bot API physical channel

Date: 2026-09-04
Status: BUILD ACTIVE
Target branch: `build/mk1-c2-telegram-bot-api-official`

## Goal

Move the already human-verified Telegram-shaped local CTA path onto the **official Telegram Bot API** without changing Engines business authority.

```text
Telegram user
  ↓
Telegram Bot API (official)
  ↓
getUpdates long polling
  ↓
TelegramAdapter
  ↓
CanonicalChannelEnvelope
  ↓
CustomerRegistrationChannelExecutionCore
  ↓
PostgreSQL channel ledger
  ↓
Temporal RegisterNewCustomer
  ↓
Customer persistence
```

## Why long polling first

The first physical proof should require only a BotFather token and outbound HTTPS access. No public domain, reverse proxy or webhook endpoint is required. Telegram documents `getUpdates` and webhooks as mutually exclusive update-delivery mechanisms; long polling therefore minimizes infrastructure while preserving the official API boundary.

## Free-path decision

Telegram's Bot Platform is free for users and developers. The current physical proof uses normal one-to-one Bot API traffic and does not enable paid broadcast capacity. Running the process on the developer machine avoids paid hosting for this gate.

## Provider responsibilities only

Telegram owns transport facts:

- `update_id`;
- `chat.id`;
- `from.id`;
- text messages;
- callback queries;
- shared contacts;
- Bot API delivery and rendering.

Telegram does **not** own:

- Customer completeness;
- duplicate truth;
- consent policy semantics beyond carrying the explicit user response;
- Workflow phase;
- Customer persistence.

## First physical conversation

```text
user sends /start or first private message
  → consent prompt
  → Registrarme
  → Temporal starts RegisterNewCustomer
  → Engine asks name
  → Engine asks phone
  → Telegram request_contact button
  → Engine asks email
  → CREATED
```

The exact next question remains driven by live Temporal `missingFields` / render intent.

## Explicit exclusions

- Telegram webhook mode;
- group-chat Customer registration;
- outbound campaigns;
- Appointment;
- Advisor handoff;
- Agent/MCP/LLM routing;
- production hosting.
