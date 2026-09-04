# Plan 10 — C2P Telegram official Bot API physical proof

Date: 2026-09-04
Status: **REAL PROVIDER E2E PASS — FINAL HARDENING OBSERVATION PENDING**
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
C2P-4 BotFather physical connection       ✅ HUMAN VERIFIED
C2P-5 real Telegram registration E2E      ✅ HUMAN VERIFIED
C2P-5H invalid-input/contact hardening    🧪 ONE FRESH RUN PENDING
C2P-6 physical evidence + seal            ⏳ AFTER C2P-5H
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

## C2P-4 / BotFather physical connection ✅

Eduardo created a real bot with BotFather, started the local C2P runner with a token supplied only through the local environment, opened the real private Telegram chat and received the Engines registration consent prompt.

This proves:

```text
real Telegram account
  ↔ Telegram Bot API official
  ↔ Engines long-poll runner
```

No `api_id`, `api_hash`, public URL, webhook, reverse proxy or paid hosting was required.

## C2P-5 / real provider E2E ✅

Human-observed physical sequence:

```text
/start
  → consent prompt
  → Registrarme
  → name
  → valid typed phone
  → email
  → ✅ Registro completado
```

Therefore the real provider path reached the same Engine behavior:

```text
Telegram Bot API
  → getUpdates
  → TelegramAdapter
  → CanonicalChannelEnvelope
  → CustomerRegistrationChannelExecutionCore
  → PostgreSQL channel ledger
  → Temporal RegisterNewCustomer
  → Customer completion
  → Telegram sendMessage
```

Physical evidence: `mk1/Test/c2p-telegram-official-physical-human-verification-2026-09-04.md`.

## C2P-5H / hardening observation

The first successful physical run used a valid typed phone immediately. It therefore did not separately observe the two hardening behaviors intentionally included in the original plan:

```text
invalid real-provider phone/email
  → rejected
  → same Temporal Workflow remains active

native Compartir teléfono
  → request_contact
  → Telegram contact payload
  → canonical Customer phone patch
```

These are already proven deterministically and in the local human harness, but the final physical seal waits for one fresh real-provider observation.

Because the current conversation binding is terminal, the easiest fresh physical hardening run is:

```text
stop telegram-bot
reset local Docker volumes
restart postgres/mongo/temporal/migrate/worker
restart telegram-bot with the same local token
/start in the same Telegram private chat
```

A second Telegram account/private chat is also valid.

## Certification marker

Allowed now:

```text
C2P TELEGRAM OFFICIAL BOT API — REAL PROVIDER E2E ✅ HUMAN VERIFIED
```

Final marker remains reserved until C2P-5H:

```text
C2P TELEGRAM OFFICIAL BOT API ✅ PHYSICALLY VERIFIED / SEALED
```

## Non-claims

No webhook parity, production hosting, campaigns, Appointment, Scheduler, Agent/MCP, Telegram Business mode, paid broadcast capacity or production readiness is part of C2P.
