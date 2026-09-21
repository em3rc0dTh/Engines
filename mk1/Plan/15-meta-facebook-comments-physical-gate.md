# Meta Facebook Comments — physical gate plan

Date: 2026-09-21

## Closed

- Page webhook object configured;
- feed subscribed;
- Messenger/feed shared callback proven;
- deployed raw-body X-Hub-Signature-256 verification enabled;
- real Messenger request accepted after valid HMAC;
- Meta Page.feed dashboard request accepted after valid HMAC;
- unsigned POST rejected with HTTP 401;
- invalid-signature POST rejected with HTTP 403;
- deployed HMAC enforcement physically sealed;
- repository Worker reference no longer owns CTA trigger classification;
- Engines signed Page ingress implemented;
- explicit Page-to-business trusted routing implemented;
- FacebookCommentAdapter remains trigger authority;
- deterministic runtime probe added for signed comment -> canonical CTA -> Temporal start -> persistence -> replay dedupe.

## Repository gate — CERTIFIED

Exact-head CI PASS on source 4da5e6e379f2d4b9022f1abaebfc40575caefe23, run 35628769099, successful rerun job 106430339207. Required:

~~~text
TypeScript PASS
Meta adapter/unit regressions PASS
META_FACEBOOK_COMMENT_CANONICAL_BRIDGE_PASS
same comment_id -> same workflow
duplicate_count=1
one CTA ingress record
one active FACEBOOK_COMMENT binding
~~~

## Provider-real — DEFERRED_META_COMPLIANCE

The Page `subscribed_apps` installation was corrected and verified to include `feed`, `messages`, and `messaging_postbacks`. A brand-new real Page comment created afterward still produced no webhook POST while the app remained unpublished. The remaining provider-real gate is intentionally deferred until Meta Business Verification / Access Verification / applicable review / Live publication is completed.

When resumed:

1. Complete the Meta compliance/publication requirements.
2. Create a new real Facebook provider comment event.
3. Require a real signed webhook at the Worker.
4. Host Engines `/meta/page/events` and configure `ENGINES_META_PAGE_INGRESS_URL`.
5. Observe the real comment cross FacebookCommentAdapter.
6. Provide private continuation.

## Gate separation

~~~text
dashboard feed sample          != real comment
signed synthetic runtime       != provider physical comment
Temporal workflow start        != completed Appointment
deployed edge HMAC             != hosted Engine bridge
~~~
