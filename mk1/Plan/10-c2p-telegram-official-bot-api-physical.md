# Plan 10 — C2P Telegram official Bot API physical proof

Date: 2026-09-04
Status: BUILD IN PROGRESS
Branch: `build/mk1-c2-telegram-bot-api-official`
Base: `build/mk1-b2-customer-soft-duplicate-resolution`

## Objective

Certify the first **real external messaging provider** against Engines using Telegram's official Bot API and a local `getUpdates` runner.

## Gate sequence

```text
C2P-0 official-source review              ✅
C2P-1 Bot API HTTP client                 🔧
C2P-2 long-poll runner                    🔧
C2P-3 deterministic CI                    ⏳
C2P-4 BotFather physical connection       ⏳ EDUARDO
C2P-5 real Telegram registration E2E      ⏳ EDUARDO
C2P-6 physical evidence + seal            ⏳
```

## C2P-1 / client

Required official methods:

```text
getMe
getWebhookInfo
getUpdates
sendMessage
answerCallbackQuery
```

No third-party Telegram SDK is required; the runtime uses Node's HTTP/fetch surface against `api.telegram.org`.

## C2P-2 / runner

The runner must:

- require `TELEGRAM_BOT_TOKEN` from environment;
- verify bot identity with `getMe`;
- fail closed if a webhook is active;
- receive only message/callback updates via long polling;
- keep `businessSlug` in trusted deployment config;
- present consent before Workflow start;
- pass provider material through `TelegramAdapter`;
- route canonical events through the existing Customer channel core;
- query real Temporal state for next render intent;
- support Telegram native shared-contact phone input;
- preserve B2 duplicate-resolution callbacks;
- never log the token.

## C2P-3 / deterministic CI

Without any Telegram credential, CI must prove:

- TypeScript passes;
- mocked official Bot API request/response contract passes;
- adapter regressions pass;
- local real-Temporal Telegram registration still reaches Customer `CREATED`;
- Agent/MCP remain absent.

This is **not** external-provider certification.

## C2P-4 / BotFather setup

Human steps:

```text
Telegram → @BotFather
/newbot
choose display name
choose username ending in bot
receive token
```

The token is stored only in the local shell environment.

No `api_id`, `api_hash`, public URL or webhook is needed for this gate.

## C2P-5 / physical E2E

Required human observation:

```text
real Telegram account
  → real bot private chat
  → /start
  → consent prompt
  → Registrarme
  → name
  → native Compartir teléfono
  → email
  → real Temporal RegisterNewCustomer
  → Customer CREATED
  → Telegram completion message
```

Also test one invalid value and confirm the same Workflow remains active.

## Certification marker

Only after physical evidence may the repository say:

```text
C2P TELEGRAM OFFICIAL BOT API ✅ PHYSICALLY VERIFIED
```

Until then:

```text
C2P Telegram official runner ✅ BUILT / deterministic proof only
real Telegram provider       ⚪ NOT YET CERTIFIED
```

## Non-claims

No webhook parity, production hosting, campaigns, Appointment, Scheduler, Agent/MCP, Telegram Business mode, or paid broadcast capacity is part of C2P.
