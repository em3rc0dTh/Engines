# C2P Telegram official Bot API — physical human verification

Date: 2026-09-04
Operator: Eduardo
Branch: `build/mk1-c2-telegram-bot-api-official`
Status: **REAL PROVIDER E2E PASS / HARDENING OBSERVATION PENDING**

> Privacy note: the operator's phone number and email address are intentionally omitted from this public evidence record. The Telegram bot token is never recorded.

## Real provider observation

The operator opened the real BotFather-created Telegram bot and sent `/start` from a real Telegram account.

Observed conversation:

```text
/start

Bienvenido.
¿Deseas registrarte para utilizar nuestros servicios?

[Registrarme]

¿Cuál es tu nombre?
→ human supplied name

Necesito tu teléfono.
→ human supplied valid phone text

¿Cuál es tu correo?
→ human supplied valid email

✅ Registro completado.
Ya tenemos tus datos registrados.
```

This conversation was produced through the C2P physical runner using Telegram's official Bot API `getUpdates` long polling path.

## Proven physical chain

```text
real Telegram account
  → Telegram Bot API official
  → getUpdates long polling
  → TelegramAdapter
  → CanonicalChannelEnvelope
  → CustomerRegistrationChannelExecutionCore
  → PostgreSQL durable channel ledger
  → real Temporal RegisterNewCustomer
  → Customer completion
  → Telegram sendMessage completion response
```

The final Telegram completion message proves the real provider path reached the same registration Engine behavior already certified deterministically on source `a0a9b241aab5ffb4fc029179052cd4a80d764620`.

## Physical claims now allowed

```text
Telegram BotFather bot identity            ✅ REAL
Telegram Bot API inbound getUpdates        ✅ REAL
Telegram Bot API outbound sendMessage      ✅ REAL
private-chat registration consent          ✅ REAL
real Telegram → Temporal registration E2E  ✅ HUMAN VERIFIED
real Customer registration completion      ✅ HUMAN VERIFIED
```

## Hardening observation still pending

The operator's successful physical run used a valid typed phone value immediately. Therefore this run did **not** separately observe:

```text
invalid physical phone/email
  → rejection
  → same Temporal Workflow remains active

native Telegram request_contact
  → Telegram contact payload
  → canonical Customer phone patch
```

Both behaviors are already covered by deterministic tests/local human proof, but Plan 10 intentionally requires at least one real-provider hardening observation before the final C2P seal.

Because the conversation binding is now terminal, `/start` on the same persisted environment only re-renders the terminal state. A fresh physical hardening run requires either a clean local data reset or a different Telegram private chat/account.

## Current precise verdict

Allowed:

```text
C2P TELEGRAM OFFICIAL BOT API — REAL PROVIDER E2E ✅ HUMAN VERIFIED
```

Not yet allowed:

```text
C2P TELEGRAM OFFICIAL BOT API ✅ PHYSICALLY VERIFIED / SEALED
```

The remaining requirement is one fresh real-provider run that observes invalid-input recovery and preferably the native `Compartir teléfono` path.

## Non-claims

This does not certify Telegram webhook mode, production hosting, campaigns, Appointment, Scheduler runtime, Agent/MCP/LLM routing, or WhatsApp physical transport.
