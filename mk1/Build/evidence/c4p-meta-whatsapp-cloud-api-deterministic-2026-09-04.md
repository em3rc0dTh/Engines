# C4P Meta WhatsApp Cloud API — deterministic evidence receipt

Date: 2026-09-04
Branch: `build/mk1-c4p-whatsapp-cloud-api-official`
Status: **DETERMINISTIC PASS — PHYSICAL META TEST PENDING**

## Runtime authority

```text
Source SHA   72eb616153a8c4494f240ea825299e18d4aef156
Run          33929572965
Job          101205251200
Result       SUCCESS
Artifact     9958063555
SHA256       1bd75eaa752338cc9859bc0ee83190bf87afa00e994c562510209edf491b3ae2
```

Documentation commits after this source do not replace the executed runtime authority.

## Source-bound deterministic proof

The successful run proved:

```text
TypeScript                                              ✅ PASS
Meta Cloud API deterministic contract tests            ✅ 7 / 7 PASS
WhatsApp adapter regression                             ✅ 7 / 7 PASS
clean PostgreSQL/Mongo/Temporal/Worker startup          ✅ PASS
existing real-Temporal WhatsApp registration regression ✅ PASS
verified sender phone prefilled                         ✅ true
Customer outcome                                        ✅ CREATED
Agent                                                   ✅ false
MCP                                                     ✅ false
webhook runner health                                   ✅ PASS
GET webhook verification challenge                      ✅ PASS
WHATSAPP_CLOUD_API_READY                                ✅ emitted
```

## Contract cases proven

```text
webhook challenge + correct verify token    → challenge returned
valid HMAC + text message                   → verified normalized inbound
valid HMAC + interactive reply              → canonical reply id preserved
invalid HMAC                                → rejected before adapter/core
status-only notification                    → authenticated then no CTA event
outbound text                               → official Graph messages shape
outbound consent buttons                    → official interactive reply-button shape
```

## Real-Temporal regression

The same source-bound run started clean Engines infrastructure and exercised the inherited WhatsApp Customer registration path:

```text
verified provider-shaped sender phone
→ START_CUSTOMER_REGISTRATION
→ Temporal knownFields includes customer.contact.phone
→ name
→ email
→ COMPLETED / CREATED
→ MESSAGING_LOCAL_E2E_PASS
```

The output explicitly recorded:

```text
channel         WHATSAPP
phonePrefilled  true
scripted        true
agent           false
mcp             false
```

## Webhook runner deterministic boot

The physical runner booted using non-secret CI fixture values and exposed:

```text
GET /health
GET /webhooks/whatsapp
POST /webhooks/whatsapp
```

Startup marker:

```text
WHATSAPP_CLOUD_API_READY
```

This proves local runner composition only. It does not prove a Meta-issued token, WABA, real business/test phone, public HTTPS webhook delivery, or real WhatsApp conversation.

## Current allowed claim

```text
C4P Meta WhatsApp Cloud API transport ✅ BUILT / DETERMINISTIC PASS
```

Not yet allowed:

```text
C4P META WHATSAPP CLOUD API ✅ PHYSICALLY VERIFIED / SEALED
```

## Physical prerequisites still required

- real Meta app / WhatsApp Business Account context;
- Meta-issued access token;
- real Meta phone-number ID;
- Meta app secret;
- public HTTPS callback endpoint;
- webhook subscription/verification;
- real WhatsApp user conversation.

Secrets must remain outside Git, public logs and evidence receipts.

## Non-claims

No production webhook hosting, production token lifecycle, campaigns/templates as product behavior, Appointment over WhatsApp, Scheduler runtime, Kapso physical proof, Agent/MCP/LLM routing or production readiness is certified here.
