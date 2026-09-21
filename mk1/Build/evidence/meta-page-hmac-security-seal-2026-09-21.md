# Meta Page webhook deployed HMAC security seal

Date: 2026-09-21

Scope: the permanent Cloudflare Page webhook edge shared by Messenger and Facebook Page `feed`.

No App Secret, Page access token, verification token, signature digest, personal account identifier, Page identifier, sender identifier, or other production credential is stored in this receipt.

## Deployed configuration

The Worker now:

~~~text
reads the exact raw request body
  -> requires X-Hub-Signature-256
  -> computes HMAC-SHA256 using META_APP_SECRET
  -> rejects missing/invalid signatures
  -> parses JSON only after successful verification
~~~

The GET `hub.challenge` verification path remains separate from POST HMAC authentication.

## P1 — real Messenger signed delivery

A real role-bound Messenger message was sent through the connected Page.

Observed at the deployed Worker:

~~~text
META_HMAC_VALID
META_PAYLOAD
MESSENGER_EVENT
MESSENGER_MESSAGE
META_SEND_RESULT status=200 ok=true
~~~

The Page reply was visible in Messenger.

Marker:

~~~text
META_PAGE_HMAC_MESSENGER_REAL_PASS
~~~

## P2 — missing signature negative control

An arbitrary POST was sent to the permanent callback without `X-Hub-Signature-256`.

Observed:

~~~text
HTTP 401 Unauthorized
META_HMAC_MISSING
~~~

Marker:

~~~text
META_PAGE_HMAC_MISSING_REJECTED
~~~

## P3 — invalid signature negative control

An arbitrary POST was sent with a syntactically valid but incorrect SHA-256 signature.

Observed:

~~~text
HTTP 403 Forbidden
META_HMAC_INVALID
~~~

Marker:

~~~text
META_PAGE_HMAC_INVALID_REJECTED
~~~

## P4 — Meta Page.feed signed dashboard delivery

Meta Developers `Page -> feed -> Test` delivered the dashboard sample to the same permanent callback.

Observed:

~~~text
META_HMAC_VALID
META_PAYLOAD
FACEBOOK_FEED_EVENT
FACEBOOK_FEED_NON_COMMENT
HTTP 200
~~~

The sample remained `item=status / verb=add`, so this proves authenticated Page.feed delivery, not a real Facebook comment.

Marker:

~~~text
META_PAGE_HMAC_FEED_DASHBOARD_PASS
~~~

## Seal

~~~text
real Meta Messenger signed delivery       PASS
Meta Page.feed signed dashboard delivery  PASS
missing signature rejection               PASS
invalid signature rejection               PASS
deployed X-Hub-Signature-256 enforcement  SEALED
~~~

## Truth boundary

Still open after this security seal:

~~~text
real Facebook comment provider delivery
deployed Worker -> hosted Engines canonical bridge
real comment -> FacebookCommentAdapter -> Temporal
public private-continuation handoff
applicable public production access/review
production readiness
~~~

The repository deterministic bridge may certify signed synthetic comment -> canonical CTA -> real Temporal start -> CTA/channel persistence and exact replay idempotency independently. That is not equivalent to real provider comment delivery.
