# Integration Registry — WhatsApp / Meta Cloud API

## Identity

```text
Integration       WhatsApp direct through Meta Cloud API
Provider          Meta WhatsApp Cloud API
Repository target Engines-Integration-WhatsApp-Meta
Primary MK        MK1
Status            ✅ BUILT / DETERMINISTIC PASS
Physical status   🧪 DIRECT META PHYSICAL GATE PENDING
```

## Current source lineage

```text
Provider branch  build/mk1-c4p-whatsapp-cloud-api-official
PR               #21 open
```

This provider branch remains separate from the consolidated Kapso path because its real Meta-delivery proof has not been closed.

## Architecture

```text
real WhatsApp user
→ Meta Cloud API
→ public HTTPS webhook
→ GET verification challenge / POST signature verification
→ OfficialMetaCloudApiTransport
→ WhatsAppAdapter
→ ChannelExecutionCore
→ PostgreSQL durable channel ledger
→ Temporal RegisterNewCustomer
→ Customer
→ Meta Graph messages API
```

Meta and Kapso are peer implementations below `WhatsAppTransportPort`.

## Brainstorming

Direct Meta Cloud API is the lowest-provider-layer official path and remains strategically valuable even though Kapso already proved the real WhatsApp integration contract physically. It avoids relying on a BSP abstraction but requires a real Meta app/WABA/token/phone context and public HTTPS webhook delivery.

## Mining Site / Quarries

The deterministic gate covered official-style challenge verification, HMAC signature validation, message/status payload separation, interactive reply normalization and Graph outbound payloads. Physical provider identity/token delivery remains unobserved.

## Architecture decisions

```text
WHATSAPP_APP_SECRET            environment only
WHATSAPP_ACCESS_TOKEN          environment only
WHATSAPP_PHONE_NUMBER_ID       trusted provider configuration
WHATSAPP_WEBHOOK_VERIFY_TOKEN  environment only
WHATSAPP_GRAPH_API_VERSION     explicit provider version
status-only notifications      authenticated then stopped before CTA mutation
verified sender phone          candidate input; not provider business truth
```

## Design

Supported deterministic inbound shapes include text and interactive reply material. Invalid HMAC is rejected before adapter/core. Outbound rendering uses official Graph message shapes for text and consent buttons.

## Plan / gates

```text
Meta transport design                     ✅
GET webhook challenge                     ✅ deterministic
POST HMAC verification                    ✅ deterministic
text normalization                        ✅ deterministic
interactive reply normalization           ✅ deterministic
status-only no-op into CTA                ✅ deterministic
outbound Graph text/buttons               ✅ deterministic
real Meta app/WABA/token context           ⚪ pending
public Meta webhook delivery               ⚪ pending
real WhatsApp conversation                 ⚪ pending
physical certification receipt             ⚪ pending
```

## Build authority

```text
Source SHA  72eb616153a8c4494f240ea825299e18d4aef156
Run         33929572965
Job         101205251200
Artifact    9958063555
SHA-256     1bd75eaa752338cc9859bc0ee83190bf87afa00e994c562510209edf491b3ae2
```

Source-bound proof:

```text
TypeScript                                      ✅
Meta contract tests                             7 / 7 PASS
WhatsApp adapter regression                     7 / 7 PASS
clean PostgreSQL/Mongo/Temporal/Worker           ✅
real-Temporal provider-shaped WhatsApp regression ✅
phonePrefilled                                  true
Customer                                        CREATED
webhook runner health                           ✅
GET verification challenge                      ✅
WHATSAPP_CLOUD_API_READY                        ✅
Agent / MCP                                     false
```

Canonical receipt:

```text
mk1/Build/evidence/c4p-meta-whatsapp-cloud-api-deterministic-2026-09-04.md
```

## Test / Evidence

Current allowed claim:

```text
C4P Meta WhatsApp Cloud API transport ✅ BUILT / DETERMINISTIC PASS
```

Not allowed yet:

```text
C4P META WHATSAPP CLOUD API ✅ PHYSICALLY VERIFIED / SEALED
```

Kapso physical proof does not automatically certify direct Meta transport, even though both feed the same WhatsAppAdapter/Engine path.

## Golden expectations

Deterministic cases cover:

```text
correct verify token → challenge returned
valid HMAC + text → normalized inbound
valid HMAC + interactive reply → reply id preserved
invalid HMAC → rejected before core
status-only event → authenticated, no CTA event
outbound text → Graph messages shape
outbound consent → interactive reply-button shape
```

## Bootstrap

```bash
git fetch origin --prune
git switch build/mk1-c4p-whatsapp-cloud-api-official
git pull
cd mk1/runtime
npm ci
npm run check
```

Required environment:

```text
WHATSAPP_APP_SECRET
WHATSAPP_ACCESS_TOKEN
WHATSAPP_PHONE_NUMBER_ID
WHATSAPP_WEBHOOK_VERIFY_TOKEN
WHATSAPP_GRAPH_API_VERSION
ENGINES_WHATSAPP_BUSINESS_SLUG
```

Start:

```bash
docker compose down -v --remove-orphans
docker compose up --build -d postgres mongo temporal migrate worker
docker compose --profile whatsapp up --build -d whatsapp-cloud-api
curl -fsS http://localhost:8790/health
```

Temporary physical-test exposure:

```bash
cloudflared tunnel --url http://localhost:8790
```

Use the branch physical runbook for the exact callback path and Meta console subscription. Keep all real secrets out of Git and evidence receipts.

## Non-claims

```text
direct Meta physical delivery
production webhook hosting
production token rotation/lifecycle
templates/campaigns as product behavior
Appointment over WhatsApp
Scheduler runtime
Agent / MCP / LLM routing
production readiness
```

## Extraction checklist

Move only Meta-specific verification/transport/client code, provider fixtures, provider CI and physical runbook into `Engines-Integration-WhatsApp-Meta`. Keep `WhatsAppTransportPort`, `WhatsAppAdapter`, ChannelExecutionCore and business rules in Engines. Run the pending physical Meta gate after extraction if packaging changes execution behavior.
