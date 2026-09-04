# C2P Telegram official Bot API — physical human verification

Date: 2026-09-04
Operator: Eduardo
Branch: `build/mk1-c2-telegram-bot-api-official`
Status: **PHYSICALLY VERIFIED / SEALED**

> Privacy note: the operator's phone number and email address are intentionally omitted from this public evidence record. The Telegram bot token is never recorded.

## Real provider observation 1 — successful E2E

The operator opened the real BotFather-created Telegram bot and sent `/start` from a real Telegram account.

Observed conversation:

```text
/start
→ consent prompt
→ Registrarme
→ name
→ valid typed phone
→ email
→ ✅ Registro completado
→ Ya tenemos tus datos registrados.
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

## Telegram Web native-contact observation

The patched renderer sent the official phone prompt with a persistent `ReplyKeyboardMarkup` contract and the user observed the hardened explanatory text in Telegram Web:

```text
Necesito tu teléfono.

Pulsa «Compartir teléfono» en el teclado de Telegram o escribe tu número.
```

However, Telegram Web did not visibly present the `Compartir teléfono` custom reply-keyboard control.

This is recorded as a Telegram-client compatibility observation rather than an Engine/provider failure because:

1. the Bot API contract for `request_contact` is defined only for private-chat reply keyboards, not inline keyboards;
2. the typed-phone path is an explicit supported Customer-registration path;
3. the real provider E2E completed successfully through that fallback;
4. Telegram's own bug tracker records historical/recurrent Web-client issues for `request_contact` reply-keyboard behavior.

Official references:

- https://core.telegram.org/bots/api#keyboardbutton
- https://core.telegram.org/type/KeyboardButton
- https://bugs.telegram.org/c/11527/1

The native contact contract remains implemented and deterministically tested. A Mobile/Desktop physical observation may be added later, but it is not required for the C2P provider seal.

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
invalid phone rejection + recovery          ✅ HUMAN VERIFIED
invalid email rejection + recovery          ✅ HUMAN VERIFIED
real Telegram → Temporal registration E2E  ✅ HUMAN VERIFIED
real Customer registration completion      ✅ HUMAN VERIFIED
C2P provider gate                           ✅ PHYSICALLY VERIFIED / SEALED
```

Client-specific compatibility boundary:

```text
Telegram Web native request_contact visible/used   ⚪ NOT OBSERVED
Telegram typed-phone fallback                      ✅ PHYSICALLY VERIFIED
```

## Final verdict

```text
C2P TELEGRAM OFFICIAL BOT API ✅ PHYSICALLY VERIFIED / SEALED
```

The seal is deliberately bounded to the provider/Engine path and does not imply universal rendering parity across Telegram clients.

## Non-claims

This does not certify Telegram webhook mode, production hosting, campaigns, Appointment, Scheduler runtime, Agent/MCP/LLM routing, WhatsApp physical transport, or universal Telegram client UI parity.
