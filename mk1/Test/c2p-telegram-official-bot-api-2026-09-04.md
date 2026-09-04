# C2P Telegram official Bot API — verification

Date: 2026-09-04
Branch: `build/mk1-c2-telegram-bot-api-official`
Status: **DETERMINISTIC TRANSPORT PASS — PHYSICAL TELEGRAM TEST READY**

## Deterministic authority

```text
Source SHA   a0a9b241aab5ffb4fc029179052cd4a80d764620
Run          33906116526
Job          101131331563
Result       SUCCESS
Artifact     9949550064
SHA256       6e8606c4ab6082691e8f5699b2d98635d2ad6b94f6dfddf52ba09158a1a1c9f2
```

## Deterministic checks — PASS

The successful source-bound run proved without using a real Telegram credential:

```text
TypeScript                                      PASS
TelegramBotApiClient contract tests             6 / 6 PASS
Telegram adapter/render regression              7 / 7 PASS
clean PostgreSQL + Temporal infrastructure       PASS
existing real-Temporal Telegram registration     PASS → Customer CREATED
Agent                                             false
MCP                                               false
```

Bot API client coverage includes `getMe`, `getUpdates` offset/long polling, `sendMessage` reply markup, `answerCallbackQuery`, webhook-state observation and token-safe error handling.

The adapter regression also proves a Telegram shared contact that carries a different `contact.user_id` from the actual sender is rejected instead of being accepted as the sender's phone.

This is deterministic transport evidence, **not** external-provider certification.

## Physical check — READY

The physical test now requires a BotFather-created bot token supplied locally through:

```text
TELEGRAM_BOT_TOKEN
```

The token must never be copied into repository files, issues, PRs, screenshots or this evidence file.

Expected real-provider runner marker:

```text
TELEGRAM_BOT_API_READY
```

Expected conversation:

```text
real Telegram private chat
→ /start or first message
→ explicit registration consent
→ real Telegram callback
→ real Temporal RegisterNewCustomer
→ name
→ native Telegram Compartir teléfono
→ email
→ Customer CREATED
→ completion message delivered through Telegram Bot API
```

At least one invalid value should be rejected while the same Workflow remains active before the correct value is supplied.

## Current claim boundary

Allowed now:

```text
C2P Telegram official Bot API runner ✅ BUILT / DETERMINISTIC PASS
C2/C4 local interactive E2E          ✅ HUMAN VERIFIED
```

Not allowed until Eduardo completes the real Telegram conversation:

```text
C2P TELEGRAM OFFICIAL BOT API ✅ PHYSICALLY VERIFIED
```

No current C2P evidence certifies webhook mode, paid broadcasts, production hosting, campaigns, Appointment, Scheduler runtime, Agent/MCP or production readiness.
