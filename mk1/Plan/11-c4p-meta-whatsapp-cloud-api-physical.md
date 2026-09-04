# Plan 11 — C4P Meta WhatsApp Cloud API physical proof

Date: 2026-09-04
Branch: `build/mk1-c4p-whatsapp-cloud-api-official`
Base: `build/mk1-customer-channels-integrated`
Status: BUILD + DETERMINISTIC PROOF IN PROGRESS

## Objective

Certify a real WhatsApp account/user path against the existing Customer registration Engine through Meta's official WhatsApp Cloud API.

## Gates

```text
C4P-0 repository consolidation                 ✅
C4P-1 official-source/provider review          ✅
C4P-2 Meta webhook + Graph API transport       ✅ BUILT
C4P-3 deterministic CI                         🧪 RUNNING
C4P-4 public HTTPS webhook setup               ⏳ EDUARDO
C4P-5 Meta app/WABA/test-number connection     ⏳ EDUARDO
C4P-6 real WhatsApp registration E2E           ⏳ EDUARDO
C4P-7 physical evidence + seal                 ⏳
```

## C4P-2 implementation

Runtime now contains:

```text
whatsapp.cloud-api.ts
whatsapp.cloud-api-transport.ts
whatsapp.cloud-api-runner.ts
```

It supports official webhook verification, raw-body HMAC validation, Meta message normalization, Graph API outbound text/buttons and a local HTTP runner.

## Required local environment for physical proof

```text
WHATSAPP_APP_SECRET
WHATSAPP_ACCESS_TOKEN
WHATSAPP_PHONE_NUMBER_ID
WHATSAPP_WEBHOOK_VERIFY_TOKEN
WHATSAPP_GRAPH_API_VERSION
```

Secrets must be supplied only in the local environment. Do not commit them, paste them into public evidence or echo them into terminal transcripts.

## Local runtime

```text
postgres + mongo + temporal + migrate + worker
                     ↓
             whatsapp-cloud-api
                     ↓
             localhost:8790
```

Physical callback path:

```text
/webhooks/whatsapp
```

## Public HTTPS development route

Meta webhook delivery requires a public HTTPS callback. For this bounded physical test a temporary Cloudflare Quick Tunnel can expose `http://localhost:8790` through an ephemeral `https://*.trycloudflare.com` URL.

Callback configured in Meta:

```text
https://<temporary-host>/webhooks/whatsapp
```

This is testing infrastructure only. Production hosting remains a later gate.

## Human physical sequence

Target real observation:

```text
real WhatsApp user
→ sends initial message to Meta test/business number
→ Engines sends consent buttons
→ Sí, registrarme
→ verified sender phone is already known
→ ask name
→ ask email
→ intentionally send one invalid email
→ same Workflow remains active
→ valid email
→ Customer CREATED
→ ✅ Registro completado in WhatsApp
```

Also verify `Ahora no` in a fresh conversation/context causes no Workflow/Customer creation if practical.

## Deterministic proof requirements

CI must prove without any Meta credential:

```text
TypeScript PASS
webhook challenge contract PASS
valid HMAC + text normalization PASS
valid HMAC + interactive normalization PASS
invalid HMAC rejected PASS
status-only event ignored at CTA boundary PASS
Graph API outbound text shape PASS
Graph API outbound interactive shape PASS
WhatsApp adapter regression PASS
existing real-Temporal WhatsApp local E2E PASS
phonePrefilled=true
webhook runner boots with deterministic dummy config
Agent=false / MCP=false
```

## Seal language

Before physical test:

```text
C4P Meta WhatsApp Cloud API runner ✅ BUILT / DETERMINISTIC ONLY
real WhatsApp provider             ⚪ NOT CERTIFIED
```

After successful physical proof only:

```text
C4P META WHATSAPP CLOUD API ✅ PHYSICALLY VERIFIED / SEALED
```

## Non-claims

No production webhook queue, production deployment, campaigns, template governance, Appointment over WhatsApp, Scheduler runtime, Kapso physical proof, Agent/MCP or production readiness.
