# CTA / Channel Index

This is the canonical entry point for reproducing and reviewing Engines CTA/channel work.

## Architecture invariant

~~~text
provider / UI
  -> provider adapter
  -> CanonicalChannelEnvelope / Canonical CTA event
  -> CTA dispatcher
  -> Temporal
  -> domain workflow
  -> persistence authorities
~~~

Channels may own transport parsing, authentication, provider identity and rendering. They may not own Customer, Appointment, Services or Scheduler business rules.

## Current channel truth

| Channel | Current evidence | Canonical status |
|---|---|---|
| CLI | executable canonical CTA reference | certified foundation |
| WebChat | visible Workflow flow + durable restart/correlation proof | certified within PoC boundary |
| Telegram | official Bot API physical transport + canonical channel path | physically verified |
| WhatsApp / Kapso | official provider path + real sandbox journey | physically verified |
| Messenger | real inbound + real outbound Page transport; deterministic CTA adapter | transport physically verified; full real CTA -> Temporal -> persistence still open |
| Facebook Comments | Page `feed` panel transport verified; synthetic `comment/add/CITA` replay classified into `START_APPOINTMENT` | edge/router verified; real provider comment and full CTA path still open |
| TikTok | deterministic adapter contract only | provider physical proof open |
| API | deterministic canonical adapter | deterministic only |

Never upgrade deterministic/synthetic evidence to physical provider evidence without a separate receipt.

## Meta Page topology

The Meta app uses the Graph API `Page` object. One Page callback is retained because Messenger was already physically proven:

~~~text
/webhooks/meta/messenger
        |
        +-- entry[].messaging[]                 -> Messenger
        |
        +-- entry[].changes[field="feed"]       -> Facebook Comments
~~~

`User` is not part of the Messenger/Facebook Comments CTA path.

## Reproduction order

1. Read the channel-specific runbook.
2. Create provider credentials/secrets outside Git.
3. Run deterministic tests.
4. Run provider/dashboard transport proof.
5. Run the sanitized replay fixture when applicable.
6. Run canonical CTA/Temporal persistence certification.
7. Record physical evidence separately from deterministic evidence.

Useful commands:

~~~bash
cd mk1/runtime
npm ci
npm run check
npm run test:cta:poc
npm run test:channel:c1b
npm run test:telegram:bot-api
npm run test:whatsapp:kapso
~~~

## Runbooks and evidence

- Messenger: `mk1/Test/meta-channel-m1-setup-2026-09-18.md`
- Facebook Comments: `mk1/Test/meta-facebook-comments-setup-2026-09-21.md`
- Facebook Comments evidence: `mk1/Build/evidence/meta-facebook-comments-feed-evidence-2026-09-21.md`
- Meta Page contract: `mk1/Design/16-meta-page-shared-webhook-contract.md`
- Facebook Comments gate plan: `mk1/Plan/15-meta-facebook-comments-physical-gate.md`
- Sanitized replay: `mk1/golden-dataset/meta-facebook-comment-replay-v1.json`
- Cloudflare Worker reference: `mk1/runtime/examples/meta-page-webhook-worker.js`

## Secrets

The repository records only secret names, never values.

~~~text
META_WEBHOOK_VERIFY_TOKEN
META_PAGE_ACCESS_TOKEN
META_APP_SECRET
TELEGRAM_BOT_TOKEN
KAPSO_API_KEY / provider-specific secret references
~~~

Use the deployment platform secret store.

## Branch policy

~~~text
main
  canonical integrated recognition point

developer
  integration/staging line

feature/cta-orchestration-register-appointment-poc
  canonical Register Appointment CTA feature line

stage-20260918
  historical Messenger M1 source branch; merged into the canonical CTA line

feature/cta-meta-facebook-comments-poc
  Facebook Comments Page.feed lane; merge into canonical CTA line after CI
~~~

Provider-specific branches are evidence-producing lanes, not alternate business architectures.
