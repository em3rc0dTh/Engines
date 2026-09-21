# Meta Facebook Comments — provider-real gate deferred

Date: 2026-09-21

## Decision

The provider-real Facebook Comment delivery gate is intentionally deferred. The repository/runtime path is certified; the remaining blocker is Meta app publication/compliance, not Engines code.

~~~text
Facebook comment provider-real
  -> DEFERRED
  -> blocked at Meta Business Verification / Access Verification / Live publication
~~~

This decision prevents a Meta compliance workflow from blocking the next internal Engines milestones.

## What is already certified

~~~text
Page webhook callback                    PASS
Page.feed dashboard delivery             PASS
real Messenger signed delivery           PASS
X-Hub-Signature-256 valid request        PASS
missing signature -> 401                 PASS
invalid signature -> 403                 PASS
FacebookCommentAdapter                   PASS
Canonical CTA                            PASS
Temporal workflow start                  PASS
CTA ingress persistence                  PASS
FACEBOOK_COMMENT binding persistence     PASS
same comment_id replay idempotency       PASS
~~~

Canonical runtime receipt:

~~~text
mk1/Build/evidence/meta-facebook-comment-canonical-bridge-certification-2026-09-21.md
~~~

Deployed HMAC receipt:

~~~text
mk1/Build/evidence/meta-page-hmac-security-seal-2026-09-21.md
~~~

## Provider diagnosis performed

### 1. Real comment did not reach the Worker

A real public Page comment containing the CTA text was created while Cloudflare live observability was open.

Result:

~~~text
Facebook comment visible on Page   PASS
new Worker POST                    NOT OBSERVED
~~~

This was not treated as an Engines failure because the request never reached the deployed edge.

### 2. App webhook fields vs Page subscription were separated

Meta has two distinct configuration layers:

~~~text
App webhook object/field configuration
AND
Page -> subscribed_apps installation
~~~

The dashboard Page -> feed -> Test action proves the first layer only.

### 3. User token permissions were verified

Graph API Explorer:

~~~text
GET /me/permissions
~~~

Required Page permissions used during diagnosis were granted, including:

~~~text
pages_show_list
pages_messaging
pages_read_engagement
pages_manage_metadata
pages_read_user_content
~~~

business_management was additionally used only to inspect Business Portfolio ownership.

### 4. Page ownership was verified through the Business Portfolio

When GET /me/accounts returned an empty list, ownership was checked through the Business Portfolio:

~~~text
GET /<business-id>/owned_pages?fields=id,name,access_token
~~~

This confirmed the target Page belonged to the expected portfolio and yielded a Page Access Token.

Do not copy Page access tokens into documentation, chat logs or commits.

### 5. Page Access Token was required for subscribed_apps

Using the User Access Token against:

~~~text
GET /<page-id>/subscribed_apps
~~~

returned an OAuth error indicating that the new Pages experience required a Page Access Token.

After switching to the Page Access Token, the call succeeded.

### 6. Missing feed subscription was found

Initial result:

~~~text
subscribed_fields:
  messages
  messaging_postbacks
~~~

So Messenger delivery worked while real feed/comment delivery could not.

The Page was updated with:

~~~text
POST /<page-id>/subscribed_apps
     ?subscribed_fields=feed,messages,messaging_postbacks
~~~

Expected response:

~~~json
{"success":true}
~~~

Verification:

~~~text
GET /<page-id>/subscribed_apps

subscribed_fields:
  feed
  messages
  messaging_postbacks
~~~

This is now the reproducible Page subscription baseline.

### 7. A fresh real comment still did not reach the Worker

A new comment was created only after the Page subscription included feed.

Result:

~~~text
fresh Page comment                    PASS
Page feed subscription                PASS
Cloudflare live logs                  OPEN
provider webhook POST                 NOT OBSERVED
~~~

At that point the remaining gate moved to Meta app publication/compliance.

### 8. Meta publication gate

The app remained unpublished. Meta's publication UI required Business Verification before Access Verification could proceed.

Observed dependency:

~~~text
Business Verification
  -> Access Verification
  -> applicable App Review / access
  -> Live publication
  -> provider-real comment retest
~~~

The provider-real gate was therefore deferred rather than mislabeling dashboard/synthetic evidence as real comment delivery.

## Reproduction checklist for a future engineer

1. Configure the Meta app webhook object Page.
2. Subscribe app-level fields: messages, messaging_postbacks, feed.
3. Verify the callback with GET hub.challenge.
4. Store META_APP_SECRET, META_WEBHOOK_VERIFY_TOKEN, and Page token as secrets.
5. Prove HMAC positive and negative controls.
6. Generate a User Access Token with required Page permissions.
7. If Page discovery is unclear, use Business Portfolio owned_pages with business_management.
8. Obtain/use a Page Access Token.
9. Run GET /<page-id>/subscribed_apps.
10. If feed is absent, POST /<page-id>/subscribed_apps?subscribed_fields=feed,messages,messaging_postbacks.
11. Re-run GET /<page-id>/subscribed_apps and require all three fields.
12. Create a brand-new real Page comment; old comments are not replayed retroactively.
13. If no POST reaches the edge and the app is unpublished, finish Meta Business Verification / Access Verification / applicable review and publish Live.
14. Re-run the real comment gate.
15. Only after a real provider event is observed may real provider comment delivery be marked PASS.

## Public legal URLs for a PoC

For a temporary proof-of-concept, the same HTTPS Worker may expose unauthenticated legal pages such as:

~~~text
/privacy
/terms
/data-deletion
~~~

Those routes must be public, return HTTP 200, and must not interfere with webhook authentication/routing.

For production, move legal pages to an owned production domain.

## Truth boundary after deferral

~~~text
repository canonical bridge              CERTIFIED
deployed HMAC                             SEALED
Page subscribed_apps includes feed       VERIFIED
real provider comment delivery           DEFERRED_META_COMPLIANCE
hosted Worker -> Engines bridge          OPEN
private continuation                     OPEN
production readiness                     NOT CLAIMED
~~~
