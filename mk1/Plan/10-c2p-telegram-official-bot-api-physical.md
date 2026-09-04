# Plan 10 — C2P Telegram official Bot API physical proof

Date: 2026-09-04
Status: **REAL PROVIDER E2E + INVALID-INPUT RECOVERY PASS — NATIVE CONTACT RETEST PENDING**
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
C2P-5H invalid-input recovery             ✅ HUMAN VERIFIED
C2P-5C native request_contact visibility  🧪 RETEST PATCHED SOURCE
C2P-6 physical evidence + seal            ⏳ AFTER C2P-5C
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

## C2P-5H / invalid-input recovery ✅

A fresh real-provider run intentionally supplied invalid phone material twice and an invalid email once.

Observed each time:

```text
invalid value
→ Ese dato no es válido. Inténtalo nuevamente.
→ same field requested again
→ same registration conversation remains recoverable
```

After later valid phone/email values, the Workflow completed and Telegram rendered `✅ Registro completado`.

This closes the physical invalid-input recovery requirement.

## C2P-5C / native contact UI retest

The same hardening run exposed a client-facing gap: the expected native `Compartir teléfono` reply-keyboard button was not visibly presented to the operator, even though the renderer emitted a `request_contact` keyboard.

This does not invalidate C2P-4/C2P-5/C2P-5H. Typed-phone input is a supported canonical path and the registration completed successfully.

The C2P renderer was hardened to request a persistent official ReplyKeyboardMarkup:

```text
ASK_CUSTOMER_PHONE
→ keyboard button: Compartir teléfono
→ request_contact = true
→ is_persistent = true
→ resize_keyboard = true
→ input_field_placeholder set
→ text explicitly keeps typed-phone fallback available
```

C2P-5C requires one fresh run on that patched source where the operator confirms that the native button is visible and uses it successfully.

## Certification marker

Allowed now:

```text
C2P TELEGRAM OFFICIAL BOT API — REAL PROVIDER E2E ✅ HUMAN VERIFIED
C2P PHYSICAL INVALID-INPUT RECOVERY                     ✅ HUMAN VERIFIED
```

Final marker remains reserved until C2P-5C:

```text
C2P TELEGRAM OFFICIAL BOT API ✅ PHYSICALLY VERIFIED / SEALED
```

## Non-claims

No webhook parity, production hosting, campaigns, Appointment, Scheduler, Agent/MCP, Telegram Business mode, paid broadcast capacity or production readiness is part of C2P.
