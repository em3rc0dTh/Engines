# Plan 10 — C2P Telegram official Bot API physical proof

Date: 2026-09-04
Status: **DETERMINISTIC PASS — PHYSICAL TEST NOW**
Branch: `build/mk1-c2-telegram-bot-api-official`
Base: `build/mk1-b2-customer-soft-duplicate-resolution`

## Objective

Certify the first **real external messaging provider** against Engines using Telegram's official Bot API and a local `getUpdates` runner.

## Gate sequence

```text
C2P-0 official-source review              ✅
C2P-1 Bot API HTTP client                 ✅ BUILT
C2P-2 long-poll runner                    ✅ BUILT
C2P-3 deterministic CI                    ✅ PASS
C2P-4 BotFather physical connection       🧪 NOW — EDUARDO
C2P-5 real Telegram registration E2E      🧪 NOW — EDUARDO
C2P-6 physical evidence + seal            ⏳ AFTER HUMAN PROOF
```

## Deterministic authority

```text
Source SHA   a0a9b241aab5ffb4fc029179052cd4a80d764620
Run          33906116526
Job          101131331563
Result       SUCCESS
Artifact     9949550064
SHA256       6e8606c4ab6082691e8f5699b2d98635d2ad6b94f6dfddf52ba09158a1a1c9f2
```

The successful run proved TypeScript, six mocked official Bot API client cases, seven Telegram adapter/render cases, clean infrastructure startup and the inherited real-Temporal Telegram Customer registration path to `CREATED`.

This is **not** external-provider certification.

## C2P-1 / client

Implemented official methods:

```text
getMe
getWebhookInfo
getUpdates
sendMessage
answerCallbackQuery
```

No third-party Telegram SDK is required; the runtime uses Node fetch against `api.telegram.org`.

## C2P-2 / runner

The runner:

- requires `TELEGRAM_BOT_TOKEN` from environment;
- verifies bot identity with `getMe`;
- fails closed if a webhook is active;
- receives only message/callback updates via long polling;
- keeps `businessSlug` in trusted deployment config;
- presents consent before Workflow start;
- passes provider material through `TelegramAdapter`;
- routes canonical events through the existing Customer channel core;
- queries real Temporal state for next render intent;
- supports Telegram native shared-contact phone input;
- preserves B2 duplicate-resolution callbacks;
- rejects a shared contact whose Telegram `user_id` conflicts with the actual sender;
- never logs the token.

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

No `api_id`, `api_hash`, public URL, webhook, reverse proxy or paid hosting is needed for this gate.

## C2P-5 / physical E2E

Required human observation:

```text
real Telegram account
  → real bot private chat
  → /start
  → consent prompt
  → Registrarme
  → name
  → one invalid phone/text attempt
  → same Workflow remains active
  → native Compartir teléfono
  → email
  → real Temporal RegisterNewCustomer
  → Customer CREATED
  → Telegram completion message
```

## Certification marker

Only after physical evidence may the repository say:

```text
C2P TELEGRAM OFFICIAL BOT API ✅ PHYSICALLY VERIFIED
```

Current allowed language:

```text
C2P Telegram official runner ✅ BUILT / DETERMINISTIC PASS
real Telegram provider       🧪 READY FOR PHYSICAL TEST
```

## Non-claims

No webhook parity, production hosting, campaigns, Appointment, Scheduler, Agent/MCP, Telegram Business mode, paid broadcast capacity or production readiness is part of C2P.
