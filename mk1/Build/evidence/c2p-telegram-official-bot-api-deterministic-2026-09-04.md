# C2P Telegram official Bot API — deterministic certification receipt

Date: 2026-09-04
Status: **DETERMINISTIC TRANSPORT CERTIFIED — PHYSICAL PROVIDER PENDING**

## Authority

```text
Branch       build/mk1-c2-telegram-bot-api-official
Source SHA   a0a9b241aab5ffb4fc029179052cd4a80d764620
Run          33906116526
Job          101131331563
Result       SUCCESS
Artifact     9949550064
SHA256       6e8606c4ab6082691e8f5699b2d98635d2ad6b94f6dfddf52ba09158a1a1c9f2
```

Later documentation commits do not replace the executed source SHA above.

## What was executed

The source-bound GitHub Actions run executed:

```text
npm ci
npm run check
npm run test:telegram:bot-api
npx tsx --test src/cta/telegram/telegram.adapter.test.ts
clean Docker PostgreSQL + Mongo + Temporal + migrations + Worker
scripted Telegram-shaped real-Temporal Customer registration E2E
```

Results:

```text
TypeScript                                  PASS
Telegram Bot API client                     6 / 6 PASS
Telegram adapter/render                     7 / 7 PASS
real-Temporal Telegram local regression     PASS
terminal Customer outcome                   CREATED
Agent                                       false
MCP                                         false
```

## Bot API client contract proven

The deterministic client tests prove request/response handling for the official Bot API methods used by the physical runner:

```text
getMe
getWebhookInfo
getUpdates
sendMessage
answerCallbackQuery
```

They also prove:

- long-poll offset and allowed update classes are sent deterministically;
- renderer reply markup is forwarded to `sendMessage`;
- active webhook state is observable so the runner can fail closed;
- Bot API errors do not include the configured bot token in the thrown error.

## Telegram adapter hardening

The same run proves:

- affirmative consent maps to the canonical start operation;
- negative consent maps to no Workflow operation;
- text requires Engine-provided render context;
- native shared-contact data maps to a Customer phone patch without owning completeness;
- if Telegram supplies `contact.user_id`, it must equal the actual `from.id` or the event is rejected;
- B2 duplicate-decision callbacks remain canonical;
- email/completion rendering removes the one-time phone keyboard.

## Engine regression

A clean Compose run drove the existing Telegram-shaped path through:

```text
TelegramAdapter
→ CanonicalChannelEnvelope
→ CustomerRegistrationChannelExecutionCore
→ PostgreSQL durable channel ledger
→ real Temporal RegisterNewCustomer
→ Customer CREATED
```

The marker was:

```text
MESSAGING_LOCAL_E2E_PASS
```

with `channel=TELEGRAM`, `agent=false`, `mcp=false`.

## Bounded claim

Allowed:

> **C2P Telegram official Bot API transport is built and deterministically certified against the official HTTP contract shape plus the existing real-Temporal Engine path.**

Not yet allowed:

> **C2P Telegram official Bot API physically verified.**

The latter requires a real BotFather token, real Telegram account, real `api.telegram.org` delivery and the full human registration conversation.

## Non-claims

This receipt does not certify Telegram webhook mode, public hosting, paid broadcasts, Telegram Business mode, outbound campaigns, Appointment, Scheduler runtime, Agent/MCP/LLM routing or production readiness.
