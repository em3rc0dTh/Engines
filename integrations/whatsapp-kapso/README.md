# Integration Registry — WhatsApp / Kapso

## Identity

```text
Integration       WhatsApp through Kapso
Provider          Kapso WhatsApp API / Kapso event webhooks
Repository target Engines-Integration-WhatsApp-Kapso
Primary MK        MK1
Status            ✅ KAPSO SANDBOX PHYSICALLY VERIFIED
```

## Current source lineage

```text
Historical provider branch      build/mk1-c4p-kapso-official
Consolidated current anchor      build/mk1-customer-channels-integrated
Provider PR                      #22 merged 2026-09-07
Merge commit into anchor         b4378d90216829549f739415ffff45aa41bef068
```

## Architecture

```text
real WhatsApp user
→ Kapso Sandbox
→ signed Kapso v2 webhook
→ Engines Kapso runner
→ OfficialKapsoTransport
→ WhatsAppAdapter
→ ChannelExecutionCore
→ PostgreSQL durable channel ledger
→ Temporal RegisterNewCustomer
→ Customer
→ Kapso outbound API
→ real WhatsApp user
```

Kapso is transport infrastructure only. Kapso Workflows/Agent/Functions are not business authority for this integration gate.

## Brainstorming

Kapso Sandbox was selected as the first practical physical WhatsApp provider path because it allowed real WhatsApp inbound/outbound and signed webhook delivery while keeping the Engine local. The dedicated temporary/provider number path was intentionally not required to prove the transport contract.

## Mining Site / Quarries

Research/validation covered:

```text
Kapso Sandbox session activation
Kapso event webhooks
v2 payloads
X-Webhook-Signature HMAC verification
single and buffered webhook payloads
BSUID sender identity
phone-number-ID scoping
outbound phone `to` versus BSUID `recipient`
```

## Architecture decisions

```text
KAPSO_API_KEY           environment only
KAPSO_WEBHOOK_SECRET    environment only / shared signing secret
KAPSO_PHONE_NUMBER_ID   trusted configuration scope
senderPhone             optional at provider-neutral WhatsApp boundary
BSUID-only sender       valid; never invent phone data
Kapso provider logic    cannot own Customer/Temporal policy
```

## Design

Inbound `whatsapp.message.received` is authenticated over the raw request body, normalized into the shared WhatsApp transport shape and projected through the existing `WhatsAppAdapter`/ChannelExecutionCore.

A verified sender phone may prefill Customer phone at Workflow start. If Temporal accepts it, the conversation must not ask for phone again.

## Plan / gates

```text
Kapso source/protocol review              ✅
HMAC webhook verification                 ✅
v2 normalization                          ✅
BSUID/phone identity handling             ✅
outbound API transport                     ✅
deterministic CI                          ✅
Sandbox session activation                ✅ human confirmed
local runner health                       ✅ human confirmed
real signed webhook inbound               ✅
interactive consent                       ✅
Customer registration E2E                 ✅
outbound completion to real WhatsApp      ✅
physical receipt                          ✅
production/dedicated number               ⚪ not certified
```

## Deterministic build authority

Canonical deterministic receipt:

```text
Source SHA  8662a06c5787add829df36bea7e3f8ec5f1ecdf4
Run         34141751510
Job         101805053784
Artifact    10026183649
SHA-256     d27d49d6e78a02b911992ffea35ab9551f8a04be95b8ef006ccf35a74e5a4c1f
```

The later documentation head `de4b4fc537354e914ed03da1f1680300ce95048e` also re-ran the full C4P workflow successfully:

```text
Run         34146590157
Job         101819852759
Artifact    10027891870
SHA-256     01135b5a4b4d3ecefdd357b4acfa26f3dca8f3f53f002eea750375eb0ba03a77
```

The first block remains the runtime authority identified by the physical receipt; later documentation CI does not rewrite that source claim.

## Test / physical evidence

The operator physically observed:

```text
real WhatsApp inbound
→ consent prompt with interactive buttons
→ Sí, registrarme
→ Customer name
→ Customer email
→ no redundant phone question
→ ✅ Registro completado
```

This proves sender-phone prefill/no-reprompt on the real provider path and successful completion through the shared Engine/Temporal flow.

Receipts in the consolidated anchor:

```text
mk1/Build/evidence/c4p-kapso-official-deterministic-2026-09-07.md
mk1/Build/evidence/c4p-kapso-sandbox-physical-certification-2026-09-07.md
mk1/Test/c4p-kapso-sandbox-human-verification-2026-09-07.md
```

Personal phone/email values and screenshots are intentionally not committed as public evidence.

## Golden expectations

Provider-specific contracts cover HMAC verification, v2 parsing, scoping and outbound addressing. Shared Customer validation/duplicate/Workflow behavior stays in Engines Golden expectations.

## Bootstrap

```bash
git fetch origin --prune
git switch build/mk1-customer-channels-integrated
cd mk1/runtime
npm ci
npm run check

read -s -p "Kapso API key: " KAPSO_API_KEY; echo
export KAPSO_API_KEY
read -s -p "Kapso webhook signing secret: " KAPSO_WEBHOOK_SECRET; echo
export KAPSO_WEBHOOK_SECRET
read -p "Kapso Phone Number ID: " KAPSO_PHONE_NUMBER_ID
export KAPSO_PHONE_NUMBER_ID
export KAPSO_GRAPH_API_VERSION=v24.0

docker compose down -v --remove-orphans
docker compose up --build -d postgres mongo temporal migrate worker
docker compose --profile kapso up --build -d whatsapp-kapso
curl -fsS http://localhost:8791/health
```

Physical webhook exposure for test only:

```bash
cloudflared tunnel --url http://localhost:8791
```

Kapso webhook configuration:

```text
Webhook type    Kapso (events)
Endpoint        https://<quick-tunnel>.trycloudflare.com/webhooks/kapso
Payload         v2
Signing secret  same KAPSO_WEBHOOK_SECRET
Event           Message received
```

## Non-claims

```text
Kapso dedicated production number
production webhook hosting
production API-key/secret lifecycle
WhatsApp templates/campaigns
Appointment over WhatsApp
Scheduler runtime
Agent / MCP / LLM routing
production readiness
```

## Extraction checklist

Move only Kapso transport/client/webhook code, fixtures, provider CI and runbooks into `Engines-Integration-WhatsApp-Kapso`. Keep `WhatsAppTransportPort`, `WhatsAppAdapter`, ChannelExecutionCore and domain rules owned/versioned by Engines. Re-run deterministic and physical Sandbox proof after extraction packaging changes.
