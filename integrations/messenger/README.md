# Integration Registry — Messenger

## Status

```text
real inbound Page message        PASS
real outbound Page reply         PASS
permanent HTTPS callback         PASS
messages subscription            PASS
messaging_postbacks subscription PASS
real CTA -> Temporal             OPEN
deployed invalid-HMAC rejection  OPEN
public production access         OPEN
```

## Meta setup

Use the Meta app's Graph API `Page` object. The verified callback is:

```text
https://<worker>.<workers-subdomain>.workers.dev/webhooks/meta/messenger
```

Required runtime secret names:

```text
META_WEBHOOK_VERIFY_TOKEN
META_PAGE_ACCESS_TOKEN
META_APP_SECRET
```

Never commit values.

## Page subscriptions

```text
messages
messaging_postbacks
feed
```

The `feed` subscription is shared with Facebook Comments.

## Reproduce

Follow:

```text
mk1/Test/meta-channel-m1-setup-2026-09-18.md
```

Regression expectation after any Meta router change:

1. open Worker real-time logs;
2. send a role-bound Messenger test message to the connected Page;
3. observe `MESSENGER_EVENT` and `MESSENGER_MESSAGE`;
4. observe `META_SEND_RESULT` with HTTP 200;
5. confirm the Page reply is visible in Messenger.

## Historical source

```text
stage-20260918
PR #35
```

New work starts from `developer`.
