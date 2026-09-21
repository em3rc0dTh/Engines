# Integration Registry — Messenger

## Status

~~~text
real inbound Page message        PASS
real outbound Page reply         PASS
permanent HTTPS callback         PASS
messages subscription            PASS
messaging_postbacks subscription PASS
valid deployed HMAC              PASS
missing signature rejection      PASS
invalid signature rejection      PASS
real CTA -> Temporal             OPEN
public production access         OPEN
~~~

The HMAC seal is shared with Page.feed because both use the same Meta Page callback.

Required secret names:

~~~text
META_WEBHOOK_VERIFY_TOKEN
META_PAGE_ACCESS_TOKEN
META_APP_SECRET
~~~

Never commit values.

Evidence: mk1/Build/evidence/meta-page-hmac-security-seal-2026-09-21.md.

Messenger regression must show META_HMAC_VALID, MESSENGER_EVENT, MESSENGER_MESSAGE and META_SEND_RESULT status=200.
