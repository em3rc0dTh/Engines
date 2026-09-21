# Meta Facebook Comments Page.feed evidence

Date: 2026-09-21

No secret, signature digest, Page identifier, sender identifier or credential is stored here.

## Signed Page.feed dashboard delivery

Observed:

~~~text
POST /webhooks/meta/messenger
META_HMAC_VALID
META_PAYLOAD
FACEBOOK_FEED_EVENT
FACEBOOK_FEED_NON_COMMENT
HTTP 200
~~~

The sample remained item=status / verb=add, so it proves authenticated feed transport only.

## Signed Messenger regression

Observed:

~~~text
META_HMAC_VALID
MESSENGER_EVENT
MESSENGER_MESSAGE
META_SEND_RESULT status=200 ok=true
~~~

## Negative controls

~~~text
unsigned POST       -> HTTP 401 + META_HMAC_MISSING
incorrect signature -> HTTP 403 + META_HMAC_INVALID
~~~

Detailed seal: mk1/Build/evidence/meta-page-hmac-security-seal-2026-09-21.md

## Historical synthetic edge replay

The earlier unsigned comment/add/CITA replay is retained only as pre-HMAC branch-shape provenance. Unsigned arbitrary replays are now intentionally rejected.

## Current repository bridge

Current candidate:

~~~text
Engines HMAC re-verification
  -> FacebookCommentAdapter
  -> CanonicalCTAEvent
  -> CanonicalCTADispatcher
  -> real Temporal workflow start
  -> PostgreSQL CTA ingress + channel binding
  -> exact replay dedupe
~~~

## Truth boundary

~~~text
Page.feed signed dashboard delivery        PASS
shared callback Messenger signed delivery  PASS
deployed missing-signature rejection       PASS
deployed invalid-signature rejection       PASS
deployed HMAC enforcement                  SEALED
real Facebook comment delivery             DEFERRED_META_COMPLIANCE
hosted Worker -> Engines bridge            OPEN
private continuation                       OPEN
public production access                   OPEN
~~~

## Page installation diagnosis after this receipt

The Page-level app installation was later inspected with a Page Access Token. It initially exposed only `messages` and `messaging_postbacks`. `feed` was added with `POST /<page-id>/subscribed_apps?subscribed_fields=feed,messages,messaging_postbacks`, returning `success=true`, and a subsequent GET confirmed all three fields. A fresh real comment still produced no provider POST while the app remained unpublished. See `meta-facebook-comments-provider-gate-deferred-2026-09-21.md` for the full diagnosis and future reproduction sequence.
