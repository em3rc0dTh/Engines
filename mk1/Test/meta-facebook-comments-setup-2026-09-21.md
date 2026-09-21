# Meta Facebook Comments CTA — reproducible setup

Date: 2026-09-21

## Goal

~~~text
Facebook Page comment
  -> Meta Page webhook
  -> Cloudflare raw-body HMAC verification
  -> exact signed raw-body forward
  -> Engines HMAC re-verification
  -> FacebookCommentAdapter
  -> canonical register_appointment CTA
  -> CTA dispatcher
  -> Temporal RegisterNewAppointment
  -> CTA/channel persistence
  -> private continuation required
~~~

The public comment is a trigger only. Do not request personal appointment data in the public thread.

## Meta setup

Use Graph API object Page, not User. Keep the proven callback:

~~~text
https://<worker>.<workers-subdomain>.workers.dev/webhooks/meta/messenger
~~~

Subscribe: messages, messaging_postbacks, feed.

## Deployed HMAC contract

~~~text
read exact raw body
  -> require X-Hub-Signature-256
  -> HMAC-SHA256(raw body, META_APP_SECRET)
  -> reject missing/invalid signatures
  -> JSON.parse only after successful verification
~~~

Expected deployed markers:

~~~text
valid Meta request -> META_HMAC_VALID
missing signature  -> META_HMAC_MISSING + HTTP 401
invalid signature  -> META_HMAC_INVALID + HTTP 403
~~~

Physical evidence: mk1/Build/evidence/meta-page-hmac-security-seal-2026-09-21.md

## Edge authority boundary

The Worker owns authentication, transport observability and optional exact-body forwarding. It must not own the appointment keyword list or convert CITA into START_APPOINTMENT.

Business trigger authority remains in FacebookCommentAdapter.

When Engines is hosted, configure:

~~~text
ENGINES_META_PAGE_INGRESS_URL=https://<engines-host>/meta/page/events
~~~

## Trusted Page routing

Engines requires ENGINES_META_PAGE_ROUTES_JSON. Deterministic example:

~~~json
{"TEST_PAGE":"golden-business"}
~~~

An unmapped Page is rejected with META_PAGE_ROUTE_NOT_CONFIGURED.

## Local canonical bridge reproduction

From mk1/runtime:

~~~bash
docker compose down -v --remove-orphans || true

META_APP_SECRET=meta-local-test-secret \
ENGINES_META_PAGE_ROUTES_JSON='{"TEST_PAGE":"golden-business"}' \
docker compose up --build -d postgres mongo temporal migrate worker cta channel-core

docker compose run --rm --no-deps -T \
  -e ENGINES_CHANNEL_URL=http://channel-core:8788 \
  -e POSTGRES_URL=postgresql://engines:engines@postgres:5432/engines_mk0 \
  -e META_APP_SECRET=meta-local-test-secret \
  cta npm run probe:meta:facebook-comment
~~~

Expected marker:

~~~text
META_FACEBOOK_COMMENT_CANONICAL_BRIDGE_PASS
~~~

This proves signed synthetic comment -> HMAC -> adapter -> canonical CTA -> real Temporal start -> CTA/channel persistence -> exact replay dedupe.

It does not prove real provider comment delivery or a completed Appointment. Private continuation is still required.

## Current truth boundary

Closed: Page.feed subscription, Messenger signed delivery, Page.feed signed dashboard delivery, missing-signature rejection, invalid-signature rejection, deployed X-Hub-Signature-256 enforcement.

Repository gate certified on exact source SHA 4da5e6e379f2d4b9022f1abaebfc40575caefe23: signed canonical bridge + real Temporal start + persistence + exact replay dedupe PASS.

Provider-real status: `DEFERRED_META_COMPLIANCE`. The Page-level `subscribed_apps` installation was verified with a Page Access Token and explicitly updated to include `feed,messages,messaging_postbacks`. A brand-new real comment created after that update still produced no provider POST while the app remained unpublished. Resume only after Meta Business Verification / Access Verification / applicable review / Live publication. Hosted Worker -> Engines bridge and private continuation also remain open.

## Page-level subscribed_apps check

Do not confuse app-level webhook field configuration with Page installation. Use a Page Access Token (not a User Access Token):

~~~text
GET /<page-id>/subscribed_apps
~~~

Require:

~~~text
feed
messages
messaging_postbacks
~~~

If `feed` is missing:

~~~text
POST /<page-id>/subscribed_apps?subscribed_fields=feed,messages,messaging_postbacks
~~~

Then verify with GET again. If `GET /me/accounts` is empty, `business_management` may be used diagnostically with `GET /<business-id>/owned_pages?fields=id,name,access_token` to obtain the Page Access Token. Never store or paste the token into documentation.

Full provider diagnosis and future reproduction: `mk1/Build/evidence/meta-facebook-comments-provider-gate-deferred-2026-09-21.md`.
