# C4P Kapso Sandbox — Physical Certification Receipt

Date: 2026-09-07
Branch: `build/mk1-c4p-kapso-official`

## Verdict

**✅ C4P KAPSO SANDBOX PHYSICALLY VERIFIED**

This bounded certification combines source-bound deterministic evidence with a real human WhatsApp conversation through Kapso Sandbox.

## Deterministic runtime authority

```text
Source SHA    8662a06c5787add829df36bea7e3f8ec5f1ecdf4
Run           34141751510
Job           101805053784
Result        SUCCESS
Artifact      10026183649
Artifact SHA  d27d49d6e78a02b911992ffea35ab9551f8a04be95b8ef006ccf35a74e5a4c1f
```

The same source passed TypeScript, 7/7 Kapso v2 contract tests, 7/7 WhatsApp adapter regressions, clean PostgreSQL/Mongo/Temporal/Worker startup, inherited real-Temporal WhatsApp registration to Customer `CREATED`, phone prefill, and Kapso runner health/ready checks.

## Human physical observation

The operator activated one real Kapso Sandbox session, started the local Engines Kapso runtime, confirmed:

```json
{"ok":true,"provider":"KAPSO","agent":false,"mcp":false}
```

A real WhatsApp message was then sent from the activated tester account to the Kapso Sandbox number. The observed conversation was:

```text
real WhatsApp message
→ Engines consent prompt with interactive buttons
→ operator selected registration consent
→ Engines asked Customer name
→ operator supplied name
→ Engines asked Customer email
→ operator supplied email
→ Engines returned registration completion
```

The phone field was **not requested again** after consent, consistent with the verified WhatsApp sender-phone prefill contract already certified deterministically.

The observed copy and interaction sequence matched the provider runner and shared `WhatsAppAdapter` / `CustomerRegistrationChannelExecutionCore` path. No Kapso Workflow, Kapso Agent, MCP or LLM orchestration was used.

## Physical path proved

```text
real WhatsApp user
→ Kapso Sandbox
→ Kapso event webhook
→ Engines Kapso runner
→ WhatsAppAdapter
→ CustomerRegistrationChannelExecutionCore
→ PostgreSQL durable channel ledger
→ Temporal RegisterNewCustomer
→ Customer completion
→ Kapso outbound API
→ real WhatsApp user
```

## Privacy boundary

The human screenshot contained personal contact material. The screenshot itself and all personal phone/email values are intentionally **not committed** to the public repository. This receipt records only the behavioral evidence necessary to certify the gate.

## Claim boundary

Allowed:

```text
C4P KAPSO TRANSPORT ✅ BUILT / DETERMINISTIC PASS
C4P KAPSO SANDBOX   ✅ PHYSICALLY VERIFIED
```

Not certified by this receipt:

```text
Kapso dedicated production number
Meta direct Cloud API physical path
production webhook hosting
production token/secret lifecycle
WhatsApp templates/campaigns
Appointment over WhatsApp
Scheduler runtime
Agent / MCP / LLM routing
production readiness
```

## Input-validation note

This physical sandbox run completed the normal registration path. It did not separately re-observe invalid-input recovery on Kapso. Invalid Customer input rejection/recovery remains covered by the shared Customer/WhatsApp deterministic and earlier channel evidence; no new physical Kapso claim is made for that specific behavior here.
