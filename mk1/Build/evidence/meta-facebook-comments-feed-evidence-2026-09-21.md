# Meta Facebook Comments Page.feed evidence

Date: 2026-09-21

No access token, app secret, verification token, personal account identifier, real sender identifier, or raw production credential is stored here.

## Provider dashboard feed transport

Meta Developers `Page -> feed -> Test` sent a webhook to the already-proven Page callback.

Observed:

~~~text
POST /webhooks/meta/messenger
HTTP 200
META_PAYLOAD
FACEBOOK_FEED_EVENT
FACEBOOK_FEED_NON_COMMENT
~~~

The sanitized sample shape was:

~~~text
field=feed
item=status
verb=add
published=1
post_id present
message="Example post content."
~~~

Marker:

~~~text
META_PAGE_FEED_DASHBOARD_TRANSPORT_PASS
~~~

## Messenger regression

After the Worker learned to distinguish `entry[].messaging[]` from `entry[].changes[]`, a physical Messenger message still produced the expected Page reply.

Marker:

~~~text
META_SHARED_PAGE_CALLBACK_MESSENGER_REGRESSION_PASS
~~~

## Synthetic Facebook comment edge replay

A sanitized POST was replayed against the deployed Worker:

~~~text
object=page
field=feed
item=comment
verb=add
post_id=TEST_PAGE_TEST_POST
comment_id=TEST_COMMENT_001
sender_id=TEST_USER
message=CITA
~~~

Observed:

~~~text
HTTP 200
EVENT_RECEIVED
FACEBOOK_FEED_EVENT
FACEBOOK_COMMENT_EVENT
FACEBOOK_COMMENT_CTA
type=START_APPOINTMENT
~~~

Markers:

~~~text
META_FACEBOOK_COMMENT_SYNTHETIC_REPLAY_PASS
META_FACEBOOK_COMMENT_EDGE_CTA_CLASSIFICATION_PASS
~~~

## Truth boundary

~~~text
Page.feed dashboard delivery          PASS
shared callback Messenger regression  PASS
synthetic comment classification      PASS
real Facebook comment delivery        OPEN
deployed HMAC rejection               OPEN
real CTA -> Temporal -> persistence   OPEN
exact provider replay/idempotency     OPEN
public production access              OPEN
~~~
