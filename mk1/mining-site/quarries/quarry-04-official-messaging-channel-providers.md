# Quarry 04 — Official messaging-channel provider evidence

Date: 2026-09-04
Scope: Telegram + WhatsApp transport selection

## Research question

Which provider paths let Engines add Telegram and WhatsApp while keeping the channel implementation official, replaceable and subordinate to the existing durable ChannelExecutionCore?

## Telegram evidence

Official Telegram documentation exposes the Bot API and two mutually exclusive inbound update mechanisms:

- `getUpdates` long polling;
- webhook delivery.

The official Bot API documents `update_id` as the update identifier and describes it as useful for ignoring repeated updates / restoring update sequence.

Observed sources:

- Telegram Bot API: `https://core.telegram.org/bots/api`
- Telegram Bots FAQ: `https://core.telegram.org/bots/faq`

### Engineering consequence

C2 starts with long polling because it can be developed without a public HTTPS webhook endpoint.

Canonical identity proposal:

```text
externalConversationId = telegram:<chat.id>
externalMessageId      = telegram:update:<update_id>
externalSenderId       = telegram:user:<from.id>
```

The raw message/callback identifiers remain transport metadata. `update_id` is the durable ingress-event identity for the first implementation.

## WhatsApp official API evidence

Meta's official Postman collection describes WhatsApp Cloud API as hosted by Meta and as the official WhatsApp Business Platform API for business messaging.

It also states that getting started requires Meta business assets including a business portfolio, WhatsApp Business Account and business phone number.

Observed source:

- Meta WhatsApp Business Platform Postman collection: `https://www.postman.com/meta/whatsapp-business-platform/documentation/wlk6lh4/whatsapp-cloud-api`
- linked Meta documentation: `https://developers.facebook.com/docs/whatsapp/cloud-api/overview`

### Engineering consequence

Direct Meta Cloud API is the baseline provider contract for C4 WhatsApp.

It satisfies the project requirement that we do not depend on an unofficial WhatsApp Web automation path.

## Kapso evidence

Kapso's current public product material states that it provides WhatsApp through the official API and presents itself as an "Official Meta Business Partner". It advertises:

- Kapso-provided number;
- use of an existing SIM/number;
- a WhatsApp Business App connection path;
- webhooks;
- API logs/message tracking;
- customer embedded signup/onboarding;
- an API proxy/client layer around WhatsApp Cloud API.

Observed sources:

- `https://kapso.ai/`
- `https://kapso.com/whatsapp-api-for-developers`
- npm client `@kapso/whatsapp-cloud-api`

Important evidence discipline:

The "Official Meta Business Partner" wording above is a Kapso public claim observed on Kapso's site. We have not yet independently certified an Engines Kapso account, Meta embedded-signup flow, phone-number eligibility or production messaging status.

### Engineering consequence

Kapso is viable as an **optional provider/operations layer**, but should not become the canonical Engines business-orchestration layer.

## Rejected paths

The architecture rejects any path whose core mechanism is:

```text
WhatsApp Web browser automation
QR-session scraping
reverse-engineered private protocol
unofficial client emulation
provider-owned business workflow truth
```

Reason: these paths violate the stated requirement for an official supportable number/account route and couple business correctness to a transport implementation.

## Provider seam conclusion

```text
TelegramTransportPort
  └── TelegramBotApiTransport

WhatsAppTransportPort
  ├── MetaCloudApiTransport        DEFAULT
  └── KapsoTransport               OPTIONAL
```

Both terminate at provider adapters and feed the already-certified canonical channel boundary.

## Open questions for physical onboarding

These remain intentionally unresolved until we actually connect accounts:

- which WhatsApp Business number will be used for proof;
- whether that number must coexist with a WhatsApp Business App installation;
- whether direct Meta onboarding or Kapso embedded signup is operationally easier for the chosen number/business;
- Meta business verification/account readiness;
- template/policy approval needed for any outbound test outside the applicable customer conversation conditions;
- production webhook hosting domain/certificate;
- final secrets management location.

None of those questions block provider-independent adapter design.
