# Integration Registry — Facebook Comments

## Status

~~~text
Page.feed subscribed                         PASS
Meta dashboard feed -> Worker                PASS
real Messenger HMAC regression               PASS
Page.feed valid HMAC                         PASS
missing signature rejection                  PASS
invalid signature rejection                  PASS
deployed X-Hub-Signature-256 enforcement     SEALED
repository signed canonical bridge           CERTIFIED
real provider comment delivery               DEFERRED_META_COMPLIANCE
hosted Worker -> Engines bridge              OPEN
private continuation                         OPEN
~~~

## Architecture

~~~text
Meta Page webhook
  -> edge raw-body HMAC
  -> exact signed body
  -> Engines /meta/page/events
  -> HMAC re-verification
  -> FacebookCommentAdapter
  -> Canonical CTA
  -> Temporal
  -> persistence
~~~

The edge must not own the appointment keyword list.

Trusted Page routing uses ENGINES_META_PAGE_ROUTES_JSON.

## Reproduce

See mk1/Test/meta-facebook-comments-setup-2026-09-21.md.

Expected runtime marker: META_FACEBOOK_COMMENT_CANONICAL_BRIDGE_PASS.

Evidence:
- mk1/Build/evidence/meta-page-hmac-security-seal-2026-09-21.md
- mk1/Build/evidence/meta-facebook-comments-feed-evidence-2026-09-21.md
- mk1/Build/evidence/meta-facebook-comments-provider-gate-deferred-2026-09-21.md

Dashboard item=status proves authenticated feed transport only. A signed synthetic runtime probe is not a real provider comment.

## Provider-real deferral

The Page installation was inspected with a Page Access Token. `subscribed_apps` initially contained only `messages` and `messaging_postbacks`; `feed` was then added explicitly and verified. A fresh real comment created after that change still produced no provider webhook while the Meta app remained unpublished. The remaining gate is therefore deferred to the future Business Verification / Access Verification / Live publication campaign, not treated as an Engines code defect.
