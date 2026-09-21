# Meta Facebook Comments CTA — reproducible setup

Date: 2026-09-21

## Goal

Prove the provider boundary for a public Facebook Page comment without creating a second business workflow.

~~~text
Facebook Page post
  -> comment "CITA"
  -> Page webhook field feed
  -> FacebookCommentAdapter
  -> canonical register_appointment CTA
  -> private continuation required
~~~

## Prerequisites

- one Meta developer app;
- one Facebook Page connected to that app;
- the Messenger Page webhook already verified, or another permanent HTTPS callback;
- Cloudflare Worker or equivalent always-on HTTPS endpoint;
- `META_WEBHOOK_VERIFY_TOKEN` stored as a secret;
- `META_PAGE_ACCESS_TOKEN` stored as a secret if outbound Page/Messenger operations are tested;
- `META_APP_SECRET` reserved for raw-body HMAC enforcement.

Never commit secret values.

## 1. Add the Pages use case

In Meta for Developers:

~~~text
App
  -> Use cases
  -> Manage Pages / Administrar páginas
~~~

For this PoC, the relevant permissions exposed by Meta include:

~~~text
pages_read_user_content
pages_manage_engagement
pages_manage_metadata
pages_read_engagement
pages_show_list
~~~

Only request permissions actually needed by the final product.

## 2. Configure the correct webhook object

Open:

~~~text
Manage Pages
  -> Webhooks
  -> Product/Object: Page
~~~

Do **not** configure this lane under `User`.

The existing Messenger callback remains the Page callback:

~~~text
https://<worker>.<workers-subdomain>.workers.dev/webhooks/meta/messenger
~~~

The path name is legacy. Payload shape decides the internal route.

## 3. Subscribe Page.feed

Under `Page`:

~~~text
feed -> Subscribe
~~~

Messenger subscriptions remain:

~~~text
messages
messaging_postbacks
~~~

Final Page fields for this CTA proof:

~~~text
messages
messaging_postbacks
feed
~~~

## 4. Dashboard transport test

Open the `feed` row and choose **Test / Probar -> Send to my server**.

Expected callback:

~~~text
POST /webhooks/meta/messenger
HTTP 200
~~~

Expected payload family:

~~~json
{
  "entry": [{
    "changes": [{
      "field": "feed",
      "value": {
        "item": "status",
        "verb": "add"
      }
    }]
  }]
}
~~~

The dashboard sample is a `status` event. It proves `feed` transport, not a real comment.

Expected logs:

~~~text
META_PAYLOAD
FACEBOOK_FEED_EVENT
FACEBOOK_FEED_NON_COMMENT
~~~

## 5. Messenger regression

After modifying the Worker, send a normal Messenger message from an allowed test account.

Expected:

~~~text
MESSENGER_EVENT
MESSENGER_MESSAGE
META_SEND_RESULT status=200
~~~

A Page reply should still be visible.

## 6. Synthetic comment replay (development proof only)

Before deployed HMAC enforcement is enabled, a sanitized replay can verify the edge classification path.

~~~powershell
$body = @{
  object = "page"
  entry = @(
    @{
      id = "TEST_PAGE"
      time = 1790003000
      changes = @(
        @{
          field = "feed"
          value = @{
            item = "comment"
            verb = "add"
            post_id = "TEST_PAGE_TEST_POST"
            comment_id = "TEST_COMMENT_001"
            sender_id = "TEST_USER"
            message = "CITA"
            published = 1
            created_time = 1790003000
          }
        }
      )
    }
  )
} | ConvertTo-Json -Depth 10

Invoke-WebRequest `
  -Uri "https://<worker>.<workers-subdomain>.workers.dev/webhooks/meta/messenger" `
  -Method POST `
  -ContentType "application/json" `
  -Body $body
~~~

Expected:

~~~text
HTTP 200
EVENT_RECEIVED
FACEBOOK_FEED_EVENT
FACEBOOK_COMMENT_EVENT
FACEBOOK_COMMENT_CTA
type=START_APPOINTMENT
publicTriggerOnly=true
privateContinuationRequired=true
~~~

This is synthetic edge proof, not provider-origin physical proof.

Once HMAC enforcement is deployed, unsigned arbitrary internet replays must fail closed.

## 7. Real provider comment gate

A real provider event must satisfy:

~~~text
field=feed
item=comment
verb=add
message=CITA
post_id present
comment_id present
sender/from id present
~~~

While the Meta app is unpublished, the dashboard can limit delivery to test webhooks. Record that limitation rather than claiming a failed real comment is a Worker defect.

## Truth boundary

Closed on 2026-09-21:

~~~text
Page.feed subscribed                         PASS
dashboard feed test -> Worker               PASS
Messenger regression after router change    PASS
synthetic comment/add/CITA replay            PASS
edge START_APPOINTMENT classification        PASS
~~~

Open:

~~~text
deployed X-Hub-Signature-256 enforcement
invalid signature rejection at deployed edge
real Facebook comment provider delivery
real comment -> canonical adapter -> Temporal
persistence + exact replay/idempotency
public production access / applicable review
~~~
