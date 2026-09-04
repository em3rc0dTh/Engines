# C2P Telegram official Bot API — physical seal receipt

Date: 2026-09-04
Branch: `build/mk1-c2-telegram-bot-api-official`
Status: **PHYSICALLY VERIFIED / SEALED**

## Physically observed runtime authority

```text
Source SHA   28dd5c9f2dd2352d3e11b83cc6602cea1b568760
Run          33927626629
Job          101199465863
Result       SUCCESS
Artifact     9957384230
SHA256       46bbd55f0b2c061ec9b7e61d55323dca0f5488d410120a3ac5b4510b90bdd79c
```

The source-bound run passed TypeScript, Telegram Bot API deterministic tests, Telegram adapter/render regression, clean Engines infrastructure startup and the real-Temporal Telegram local regression to Customer `CREATED`.

This is the runtime lineage physically observed by Eduardo in Telegram Web after contact-keyboard hardening.

## Post-seal client-aware copy hardening

After Telegram Web again failed to visibly surface the native `Compartir teléfono` reply keyboard, the phone prompt was changed so it no longer promises that every Telegram client will render the button:

```text
Necesito tu teléfono.

Si tu app muestra «Compartir teléfono», puedes usarlo. Si no, escribe tu número.
```

That wording-only runtime change is independently deterministic-CI clean:

```text
Source SHA   12cdd31f90261fc1b89d02c7569b02c60e10a499
Run          33928701201
Job          101202679780
Result       SUCCESS
Artifact     9957765591
SHA256       e21c19fd6fa9bf31eaea0dae7885e8a3dc1432462d747ec29a05729b1234d35a
```

No Engine, Temporal, Customer, persistence, adapter or Bot API routing semantics changed in this post-seal UX copy hardening.

## Physical human evidence

Eduardo used a real BotFather-created bot from a real Telegram account against the local Engines runner using official `getUpdates` long polling.

Physically observed provider path:

```text
real Telegram account
→ official Telegram Bot API
→ getUpdates
→ TelegramAdapter
→ CanonicalChannelEnvelope
→ CustomerRegistrationChannelExecutionCore
→ PostgreSQL durable channel ledger
→ real Temporal RegisterNewCustomer
→ Customer completion
→ Telegram sendMessage
```

Observed behavior across physical runs:

```text
/start → consent → Registrarme → name → typed phone → email → ✅ Registro completado
invalid phone → rejected → same field requested again → recovery
invalid phone again → rejected → recovery
valid phone → next field
invalid email → rejected → same field requested again → recovery
valid email → Customer CREATED → ✅ Registro completado
```

The operator's private phone/email values and the bot token are intentionally excluded from repository evidence.

## Telegram Web client observation

Telegram Web displayed the hardened phone prompt but did not visibly render the native `Compartir teléfono` reply-keyboard control.

This does not invalidate the provider seal because typed phone is an explicit supported Customer-registration input path and the real provider/Engine E2E completed physically. Telegram's official API exposes `request_contact` only through private-chat reply keyboards, and Telegram's own bug tracker records Web-client regressions around this capability.

References:

- https://core.telegram.org/bots/api#keyboardbutton
- https://core.telegram.org/type/KeyboardButton
- https://bugs.telegram.org/c/11527/1

Native `request_contact` rendering remains a client-specific compatibility observation that may be tested later on Telegram Mobile/Desktop.

## Sealed claim

```text
C2P TELEGRAM OFFICIAL BOT API ✅ PHYSICALLY VERIFIED / SEALED
```

Bounded meaning:

- real BotFather bot identity;
- official Bot API inbound `getUpdates`;
- official Bot API outbound `sendMessage`;
- real private Telegram conversation;
- explicit Customer registration consent;
- real Temporal `RegisterNewCustomer`;
- real Customer completion;
- real invalid-input rejection and recovery;
- no Agent/MCP/LLM routing.

## Non-claims

This receipt does not certify Telegram webhook mode, production hosting, campaigns, Appointment over Telegram, Scheduler runtime, Agent/MCP, paid broadcasts, universal client rendering parity, or production readiness.
