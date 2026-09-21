# CTA Reproduction Guide

This guide is the shortest reproducible path for every CTA/channel currently represented in Engines.

## 0. Repository contract

```text
provider / UI
  -> provider adapter
  -> CanonicalChannelEnvelope / Canonical CTA event
  -> CTA dispatcher
  -> Temporal
  -> domain workflow
  -> persistence authorities
```

Provider code may own authentication, transport parsing, provider identity, rendering and acknowledgement/retry mechanics. It must not own Customer, Appointment, Services, Scheduler or persistence policy.

## 1. Clone the canonical integrated line

After the 2026-09-21 CTA promotion, `main` is the canonical recognition point.

```bash
git clone https://github.com/em3rc0dTh/Engines.git
cd Engines
git switch main
cd mk1/runtime
npm ci
npm run check
```

For active development use `developer`; do not start new CTA work from historical provider branches.

## 2. Deterministic baseline

Run the shared CTA regression first:

```bash
npm run test:cta:poc
npm run test:channel:c1b
npx tsx --test src/cta/telegram/telegram.adapter.test.ts src/cta/whatsapp/whatsapp.adapter.test.ts src/cta/webchat/webchat.adapter.test.ts
```

Provider-specific deterministic commands:

```bash
npm run test:telegram:bot-api
npm run test:whatsapp:kapso
npm run test:whatsapp:cloud-api
```

## 3. Canonical CTA -> Temporal -> persistence proof

```bash
docker compose down -v --remove-orphans || true
docker compose up --build -d postgres mongo temporal migrate worker cta channel-core
docker compose ps
curl -fsS http://127.0.0.1:8788/health
docker compose run --rm --no-deps -T \
  -e ENGINES_CHANNEL_URL=http://channel-core:8788 \
  -e POSTGRES_URL=postgresql://engines:engines@postgres:5432/engines_mk0 \
  cta npm run probe:cta:poc
```

Expected terminal marker:

```text
CTA_ORCHESTRATION_POC_PASS
```

## 4. Channel matrix

| CTA / channel | Reproduction entry point | Evidence class |
|---|---|---|
| CLI | `integrations/cli/README.md` | deterministic / local |
| HTTP / Postman | `integrations/http-api/README.md` | deterministic / local |
| WebChat | `integrations/webchat/README.md` | browser physical within PoC boundary |
| Telegram | `integrations/telegram/README.md` | real official Bot API physical |
| WhatsApp / Kapso | `integrations/whatsapp-kapso/README.md` | real provider physical |
| WhatsApp / Meta Cloud API | `integrations/whatsapp-meta-cloud-api/README.md` | deterministic; real direct-Meta physical open |
| Messenger | `integrations/messenger/README.md` | real Page inbound/outbound transport |
| Facebook Comments | `integrations/facebook-comments/README.md` | Page.feed dashboard + synthetic comment replay |
| TikTok | `integrations/tiktok/README.md` | deterministic adapter only |

## 5. Meta Page callback topology

Messenger and Facebook Comments share the Meta Graph API `Page` object callback:

```text
/webhooks/meta/messenger
        |
        +-- entry[].messaging[]                  -> Messenger
        |
        +-- entry[].changes[field="feed"]        -> Facebook Comments
```

The Graph API `User` object is not part of this CTA path.

Current Page subscriptions for the PoC:

```text
messages
messaging_postbacks
feed
```

## 6. Secrets

Never commit values. Store only these names in documentation:

```text
META_WEBHOOK_VERIFY_TOKEN
META_PAGE_ACCESS_TOKEN
META_APP_SECRET

TELEGRAM_BOT_TOKEN

KAPSO_API_KEY
KAPSO_WEBHOOK_SECRET
KAPSO_PHONE_NUMBER_ID

WHATSAPP_APP_SECRET
WHATSAPP_ACCESS_TOKEN
WHATSAPP_PHONE_NUMBER_ID
WHATSAPP_WEBHOOK_VERIFY_TOKEN
WHATSAPP_GRAPH_API_VERSION
```

## 7. Evidence classes

Do not collapse these into one claim:

```text
deterministic unit/integration test
!= synthetic replay
!= provider dashboard test
!= real provider delivery
!= full CTA -> Temporal -> persistence physical proof
!= production readiness
```

Every receipt must state which class it proves.

## 8. Historical branch rule

Historical provider branches are evidence refs, not current development bases.

```text
feature/cta-orchestration-register-appointment-poc   historical canonical CTA source
stage-20260918                                      historical Messenger source
feature/cta-meta-facebook-comments-poc              historical Facebook Comments source
feature/cta-whatsapp-meta-cloud-api                 historical/direct Meta WhatsApp source
```

New CTA work starts from `developer`. Stable recognition is `main`.

## 9. Exact runbooks

- Messenger: `mk1/Test/meta-channel-m1-setup-2026-09-18.md`
- Facebook Comments: `mk1/Test/meta-facebook-comments-setup-2026-09-21.md`
- Meta WhatsApp: `mk1/Test/c4p-meta-whatsapp-cloud-api-physical-runbook-2026-09-04.md`
- Telegram: `integrations/telegram/README.md`
- Kapso: `integrations/whatsapp-kapso/README.md`
- WebChat: `integrations/webchat/README.md`

## 10. Truth boundary

As of this consolidation:

```text
Register Appointment canonical CTA             certified PoC
WebChat                                         physically verified within PoC
Telegram official Bot API                      physically verified
WhatsApp / Kapso                               physically verified
Messenger Page transport                       real inbound + outbound verified
Facebook Page.feed                             dashboard transport verified
Facebook comment CTA                           synthetic edge replay verified
WhatsApp direct Meta Cloud API                 deterministic, physical open
TikTok                                          deterministic only
Meta deployed invalid-signature rejection      open
Messenger real CTA -> Temporal -> persistence  open
Facebook real comment -> Temporal              open
production readiness                           not claimed
```
