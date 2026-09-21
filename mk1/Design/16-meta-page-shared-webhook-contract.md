# Meta Page shared webhook contract

Date: 2026-09-21

## Decision

Messenger and Facebook Comments remain separate provider adapters but share the single Meta Graph API `Page` webhook callback configured for the app.

~~~text
Meta Page callback
  -> entry[].messaging[]                 -> Messenger adapter
  -> entry[].changes[field="feed"]       -> Facebook Comment adapter
~~~

The callback path remains `/webhooks/meta/messenger` because that URL is already physically proven. Renaming it would require provider re-verification without changing the contract.

## Object boundary

Use:

~~~text
Page
~~~

Do not use:

~~~text
User
~~~

for the Messenger/Facebook Comments CTA route.

## Facebook Comment acceptance rule

Only normalize a comment when all are true:

~~~text
change.field == "feed"
value.item   == "comment"
value.verb   == "add"
page id      present
post id      present
comment id   present
sender id    present
message      present
~~~

Explicit appointment triggers:

~~~text
cita
appointment
agendar
agendar cita
~~~

Unrelated comments are ignored.

## Privacy boundary

A public comment is only a public trigger.

~~~text
publicTriggerOnly=true
privateContinuationRequired=true
~~~

Do not request personal appointment information in the public comment thread.

## Security boundary

Repository decoders verify `X-Hub-Signature-256` against `META_APP_SECRET` before canonicalization. The deployed Cloudflare edge still requires a separate physical invalid-signature rejection proof.

## Non-claims

Dashboard `feed` test evidence and unsigned synthetic replay do not equal real provider comment delivery.
