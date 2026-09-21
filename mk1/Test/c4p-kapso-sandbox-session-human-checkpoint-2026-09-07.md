# C4P Kapso Sandbox — Human Session Checkpoint

Date: 2026-09-07
Branch: `build/mk1-c4p-kapso-official`

## Human observation

The operator confirmed that the Kapso WhatsApp Sandbox now has **one active test session** and the sandbox business account reports an approved/active state.

No phone number, account identifier, API key, webhook secret, activation code, or other account-specific credential is recorded in this public repository receipt.

## What this proves

This checkpoint proves only that the external Kapso Sandbox test surface is active and available for the physical C4P exercise.

It does **not** yet prove:

```text
Kapso webhook delivery to Engines
Kapso webhook HMAC acceptance by Engines
real inbound normalization
real outbound reply through Kapso
Temporal workflow creation from real WhatsApp traffic
Customer persistence from real WhatsApp traffic
C4P physical provider seal
```

## Next human gate

```text
active Kapso Sandbox session
→ configure project API key locally
→ expose Engines webhook endpoint over HTTPS
→ configure Kapso whatsapp.message.received v2 webhook
→ send real WhatsApp message
→ prove signed inbound → Engines → Temporal → Customer → Kapso outbound
```

Current status:

```text
KAPSO SANDBOX SESSION ACTIVE                ✅ HUMAN CONFIRMED
C4P KAPSO TRANSPORT                         ✅ DETERMINISTIC PASS
C4P KAPSO REAL WEBHOOK / CONVERSATION       🧪 NEXT
C4P KAPSO PHYSICAL SEAL                     ❌ NOT YET
```
