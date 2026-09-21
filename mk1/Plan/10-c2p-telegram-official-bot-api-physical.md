# Plan 10 — C2P Telegram official Bot API physical proof

Date: 2026-09-04
Status: **PHYSICALLY VERIFIED / SEALED — NATIVE CONTACT CLIENT-COMPATIBILITY OBSERVATION OPEN**
Branch: `build/mk1-c2-telegram-bot-api-official`
Base: `build/mk1-b2-customer-soft-duplicate-resolution`

## Objective

Certify the first real external messaging provider against Engines using Telegram's official Bot API and a local `getUpdates` runner.

## Gate sequence

```text
C2P-0 official-source review              ✅
C2P-1 Bot API HTTP client                 ✅ BUILT
C2P-2 long-poll runner                    ✅ BUILT
C2P-3 deterministic CI                    ✅ PASS
C2P-4 BotFather physical connection       ✅ HUMAN VERIFIED
C2P-5 real Telegram registration E2E      ✅ HUMAN VERIFIED
C2P-5H invalid-input recovery             ✅ HUMAN VERIFIED
C2P-6 physical evidence + seal            ✅ SEALED

Optional compatibility observation
C2P-5C native request_contact on clients  ⚪ NOT REQUIRED FOR C2P SEAL
```

## Why native contact is not a seal blocker

The Customer registration contract accepts phone material by either:

```text
Telegram native shared contact
OR
manually typed phone
```

The real Telegram Web run proved the typed path physically, including invalid-phone and invalid-email recovery, while the exact same real provider conversation completed Customer registration through Temporal.

Telegram's official Bot API defines `request_contact` as a `KeyboardButton` capability available only in private-chat reply keyboards; it is not an inline-keyboard capability. Telegram's own bug tracker also records historical/recurrent Telegram Web issues around `request_contact` reply-keyboard behavior. Therefore absence of the native button in Telegram Web is treated as a client-compatibility observation, not an Engine/provider failure.

Official references:

- https://core.telegram.org/bots/api#keyboardbutton
- https://core.telegram.org/type/KeyboardButton
- https://bugs.telegram.org/c/11527/1

The renderer still emits the official native-contact contract and keeps a deterministic typed-phone fallback.

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

## Physical evidence

Human-observed real-provider path:

```text
real Telegram account
  → official Telegram Bot API
  → getUpdates long polling
  → TelegramAdapter
  → CanonicalChannelEnvelope
  → CustomerRegistrationChannelExecutionCore
  → PostgreSQL channel ledger
  → Temporal RegisterNewCustomer
  → Customer completion
  → Telegram sendMessage
```

Observed in two real Telegram Web runs:

```text
/start
→ consent
→ Registrarme
→ name
→ typed phone
→ email
→ ✅ Registro completado
```

Hardening run additionally proved:

```text
invalid phone
→ rejected
→ same field requested again
→ registration remains recoverable

invalid email
→ rejected
→ same field requested again
→ registration remains recoverable

later valid values
→ Customer CREATED
→ ✅ Registro completado
```

Physical evidence: `mk1/Test/c2p-telegram-official-physical-human-verification-2026-09-04.md`.

## Sealed claim

```text
C2P TELEGRAM OFFICIAL BOT API ✅ PHYSICALLY VERIFIED / SEALED
```

This seal covers the real BotFather bot, official Bot API inbound/outbound transport, real Telegram account, real Temporal `RegisterNewCustomer`, Customer completion and physical validation recovery.

It does **not** claim that every Telegram client renders `request_contact` identically. Native contact sharing remains a client-compatibility feature to observe on Telegram Mobile/Desktop when useful.

## Non-claims

No webhook parity, production hosting, campaigns, Appointment, Scheduler, Agent/MCP, Telegram Business mode, paid broadcast capacity or production readiness is part of C2P.
