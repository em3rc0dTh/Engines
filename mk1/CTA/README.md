# CTA / Channel Index

Canonical architecture:

~~~text
provider / UI
  -> authenticated provider transport
  -> provider adapter
  -> CanonicalChannelEnvelope / Canonical CTA event
  -> CTA dispatcher
  -> Temporal
  -> domain workflow
  -> persistence authorities
~~~

Provider edges own transport/authentication, not business intent.

## Current CTA truth

| Channel | Current evidence | Status |
|---|---|---|
| WebChat | physical workflow path | verified within PoC |
| Telegram | official Bot API | physically verified |
| WhatsApp / Kapso | provider sandbox | physically verified |
| WhatsApp / Meta Cloud API | direct implementation + HMAC contract | deterministic; physical open |
| Messenger | real Page transport + deployed HMAC | transport verified; full CTA open |
| Facebook Comments | signed Page.feed + deployed HMAC + certified canonical bridge | real provider delivery deferred by Meta compliance |
| TikTok | deterministic adapter | physical open |

## Meta Page topology

~~~text
/webhooks/meta/messenger
  -> entry[].messaging[]             -> Messenger
  -> entry[].changes[field=feed]     -> Facebook Page feed
                                        -> Engines signed ingress
                                        -> FacebookCommentAdapter
~~~

Evidence discipline: deterministic != signed synthetic != dashboard != real provider != completed physical journey != production.
