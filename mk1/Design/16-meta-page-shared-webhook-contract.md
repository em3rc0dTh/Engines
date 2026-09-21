# Meta Page shared webhook contract

Date: 2026-09-21

## Decision

Messenger and Facebook Comments share the Meta Graph API Page callback but remain separate provider adapters.

~~~text
Page callback
  -> entry[].messaging[]            -> Messenger transport
  -> entry[].changes[field=feed]    -> Facebook Page feed
~~~

## Security boundary

The permanent edge now verifies X-Hub-Signature-256 over the exact raw body before parsing. Physical tests proved valid Messenger delivery, valid Page.feed delivery, missing-signature rejection and invalid-signature rejection.

Engines re-verifies the original raw body and original signature at /meta/page/events.

## Authority boundary

Cloudflare owns HTTPS availability, Meta GET challenge, raw-body HMAC, transport-family observability and optional exact-body forwarding.

Cloudflare does not own CITA -> START_APPOINTMENT, business routing, Temporal workflow selection or persistence policy.

FacebookCommentAdapter owns trigger semantics.

## Acceptance rule

Only feed/comment/add events with page, post, comment, sender and message fields are eligible after HMAC verification.

Page ID must resolve through an explicit trusted Page-to-business map.

## Adapter trigger rule

~~~text
cita
appointment
agendar
agendar cita
~~~

## Privacy boundary

~~~text
publicTriggerOnly=true
privateContinuationRequired=true
~~~

## Idempotency

providerEventId is anchored to facebook:comment:<commentId>. Exact redelivery must start at most one workflow.

## Non-claims

Dashboard feed delivery is not real Facebook comment delivery. Signed synthetic runtime proof is not provider-origin physical proof. Temporal start is not completed private appointment journey.
