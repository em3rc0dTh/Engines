# C4P Kapso Official WhatsApp Transport — deterministic evidence receipt

Date: 2026-09-07
Branch: `build/mk1-c4p-kapso-official`

## Verdict

**✅ DETERMINISTIC PASS — PHYSICAL KAPSO SANDBOX TEST READY**

This receipt certifies the bounded Kapso transport/runtime contract against deterministic provider-shaped payloads plus the existing real PostgreSQL + Temporal `RegisterNewCustomer` laboratory. It does **not** certify a live Kapso/WhatsApp account yet.

## Executed authority

```text
Source SHA    8662a06c5787add829df36bea7e3f8ec5f1ecdf4
Run           34141751510
Job           101805053784
Result        SUCCESS
Artifact      10026183649
Artifact SHA  d27d49d6e78a02b911992ffea35ab9551f8a04be95b8ef006ccf35a74e5a4c1f
```

## Same-source proof

```text
TypeScript                                      PASS
Kapso v2 provider contract tests                7 / 7 PASS
WhatsApp adapter regression                     7 / 7 PASS
clean PostgreSQL/Mongo/Temporal/Worker startup  PASS
existing real-Temporal WhatsApp E2E             Customer CREATED
verified sender phone prefill                   true
Kapso runner boot/health                        PASS
WHATSAPP_KAPSO_READY                            PASS
Agent                                           false
MCP                                             false
```

## Kapso contract cases proved

```text
invalid HMAC rejected before normalization
v2 phone inbound normalized
BSUID-only inbound accepted without invented phone
buffered v2 messages normalized independently
wrong phone-number scope rejected
phone outbound uses Kapso proxy + X-API-Key + Meta shape
BSUID outbound interactive uses `recipient`
```

## Engine boundary preserved

```text
Kapso webhook/API
→ OfficialKapsoTransport
→ WhatsAppAdapter
→ CanonicalChannelEnvelope
→ CustomerRegistrationChannelExecutionCore
→ PostgreSQL durable channel ledger
→ Temporal RegisterNewCustomer
→ Customer persistence
```

Kapso Workflows, Agents, Functions and MCP are not part of the architecture.

## Physical gate

The next gate is a human-operated Kapso Sandbox session with a real WhatsApp account and a public HTTPS callback.

Runbook:
`mk1/Test/c4p-kapso-sandbox-physical-runbook-2026-09-07.md`

Allowed current claim:

```text
C4P KAPSO TRANSPORT ✅ BUILT / DETERMINISTIC PASS
```

Not yet allowed:

```text
C4P KAPSO SANDBOX ✅ PHYSICALLY VERIFIED
C4P KAPSO PRODUCTION NUMBER ✅ SEALED
```

## Non-claims

No production-number certification, production webhook hosting, templates/campaigns, Appointment over WhatsApp, Scheduler runtime, Agent/MCP/LLM routing or production readiness.
