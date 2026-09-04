# C2P Telegram official Bot API — physical human verification

Date: 2026-09-04
Operator: Eduardo
Branch: `build/mk1-c2-telegram-bot-api-official`
Status: **REAL PROVIDER E2E PASS / INVALID-INPUT RECOVERY HUMAN VERIFIED / NATIVE CONTACT RETEST PENDING**

> Privacy note: the operator's phone number and email address are intentionally omitted from this public evidence record. The Telegram bot token is never recorded.

## Real provider observation 1 — successful E2E

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

## Real provider observation 2 — validation recovery

A fresh physical run intentionally supplied invalid material before completing registration.

Observed behavior:

```text
/start
→ Registrarme
→ name

Necesito tu teléfono.
→ invalid alphabetic phone
Ese dato no es válido. Inténtalo nuevamente.
Necesito tu teléfono.

→ invalid alphabetic phone again
Ese dato no es válido. Inténtalo nuevamente.
Necesito tu teléfono.

→ valid typed phone
¿Cuál es tu correo?

→ invalid email
Ese dato no es válido. Inténtalo nuevamente.
¿Cuál es tu correo?

→ valid email
✅ Registro completado.
Ya tenemos tus datos registrados.
```

This physically proves that invalid provider input is rejected while the same registration conversation remains recoverable through the Engine until `CREATED`.

## Native-contact UI observation

The second physical run also exposed a real client-facing gap: the expected native `Compartir teléfono` reply-keyboard button was not visibly presented in the operator's Telegram client, even though the renderer already emitted a `request_contact` keyboard contract.

The user therefore completed the phone step using the supported typed-phone fallback. This does **not** invalidate the real-provider registration E2E or validation-recovery proof, but it blocks the native-contact physical seal.

A hardening patch was added on the same C2P branch:

```text
ASK_CUSTOMER_PHONE
→ ReplyKeyboardMarkup
→ request_contact = true
→ is_persistent = true
→ resize_keyboard = true
→ input_field_placeholder present
→ explicit text fallback: share contact or type phone
```

The final native-contact claim remains pending until the patched source is manually observed in Telegram.

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

## Physical claims now allowed

```text
Telegram BotFather bot identity             ✅ REAL
Telegram Bot API inbound getUpdates         ✅ REAL
Telegram Bot API outbound sendMessage       ✅ REAL
private-chat registration consent           ✅ REAL
invalid phone rejection + recovery           ✅ HUMAN VERIFIED
invalid email rejection + recovery           ✅ HUMAN VERIFIED
real Telegram → Temporal registration E2E   ✅ HUMAN VERIFIED
real Customer registration completion       ✅ HUMAN VERIFIED
native request_contact visible/used          ⏳ RETEST AFTER UI HARDENING
```

## Current precise verdict

Allowed:

```text
C2P TELEGRAM OFFICIAL BOT API — REAL PROVIDER E2E ✅ HUMAN VERIFIED
C2P PHYSICAL INVALID-INPUT RECOVERY                     ✅ HUMAN VERIFIED
```

Not yet allowed:

```text
C2P TELEGRAM OFFICIAL BOT API ✅ PHYSICALLY VERIFIED / SEALED
```

The only remaining physical observation for the C2P seal is the hardened native `Compartir teléfono` / `request_contact` path on the patched renderer source.

## Non-claims

This does not certify Telegram webhook mode, production hosting, campaigns, Appointment, Scheduler runtime, Agent/MCP/LLM routing, or WhatsApp physical transport.
