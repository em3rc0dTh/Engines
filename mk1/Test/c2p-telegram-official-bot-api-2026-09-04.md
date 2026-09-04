# C2P Telegram official Bot API — verification

Date: 2026-09-04
Branch: `build/mk1-c2-telegram-bot-api-official`
Status: **BUILD CREATED — DETERMINISTIC CI + PHYSICAL TEST PENDING**

## Deterministic checks

The branch must pass without a real Telegram credential:

```text
TypeScript
TelegramBotApiClient mocked contract tests
Telegram adapter regression
existing real-Temporal Telegram local E2E regression
```

This proves the new official transport runner composes with the already-certified/human-verified Engine path without requiring a secret in GitHub Actions.

## Physical check

The physical test requires a BotFather-created bot token supplied locally through:

```text
TELEGRAM_BOT_TOKEN
```

The token must never be copied into this evidence file.

Expected physical marker at runner startup:

```text
TELEGRAM_BOT_API_READY
```

Expected conversation result:

```text
real Telegram private chat
→ explicit registration consent
→ real Temporal RegisterNewCustomer
→ native Telegram contact share
→ Customer CREATED
→ completion message in Telegram
```

At least one invalid phone/email input should be rejected while the same Workflow remains active.

## Current non-claim

Until the human physical run is captured, do not claim:

```text
C2P TELEGRAM OFFICIAL BOT API ✅ PHYSICALLY VERIFIED
```
