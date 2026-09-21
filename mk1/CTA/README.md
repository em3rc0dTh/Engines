# CTA / Channel Index

This directory is the canonical entry point for Engines CTA/channel work.

Start here:

1. [REPRODUCE.md](REPRODUCE.md) — clean-clone reproduction for every CTA.
2. [../../BRANCHES.md](../../BRANCHES.md) — active vs historical branch map.
3. [../../integrations/README.md](../../integrations/README.md) — provider registry and status.

## Architecture invariant

```text
provider / UI
  -> provider adapter
  -> CanonicalChannelEnvelope / Canonical CTA event
  -> CTA dispatcher
  -> Temporal
  -> domain workflow
  -> persistence authorities
```

Channels own transport concerns only. Business authority remains provider-neutral.

## Current CTA truth

| Channel | Current evidence | Canonical status |
|---|---|---|
| CLI | executable canonical CTA reference | certified foundation |
| HTTP / Postman | canonical transport laboratory | certified foundation |
| WebChat | visible Workflow flow + durable restart/correlation proof | physically verified within PoC |
| Telegram | official Bot API transport + canonical channel path | physically verified |
| WhatsApp / Kapso | real provider sandbox journey | physically verified |
| WhatsApp / Meta Cloud API | official direct Meta implementation + HMAC contract | deterministic certified; physical open |
| Messenger | real inbound + real outbound Page transport | transport physically verified; full CTA path open |
| Facebook Comments | Page.feed dashboard + synthetic comment/add/CITA replay | edge/router verified; real provider comment open |
| TikTok | deterministic adapter contract | provider physical proof open |

## Canonical Meta Page topology

```text
Page callback
  /webhooks/meta/messenger
        ├── entry[].messaging[]            -> Messenger
        └── entry[].changes[field=feed]    -> Facebook Comments
```

`User` is not part of this CTA path.

## Branch rule

```text
main       stable integrated recognition point
developer  active integration / new CTA starting point
```

Provider feature branches are bounded evidence-producing lanes. Once merged, they become historical refs and receive no new work.

## Evidence discipline

```text
deterministic != synthetic != dashboard != real provider != full physical E2E != production
```

Never upgrade one evidence class into another.
