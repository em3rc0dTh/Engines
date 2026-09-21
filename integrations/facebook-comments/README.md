# Integration Registry — Facebook Comments

## Status

```text
Page.feed subscribed                     PASS
Meta dashboard feed -> Worker            PASS
status event classified non-comment      PASS
synthetic comment/add/CITA replay        PASS
START_APPOINTMENT edge classification    PASS
real provider comment delivery           OPEN
deployed invalid-HMAC rejection          OPEN
comment -> canonical CTA -> Temporal      OPEN
```

## Correct Meta object

Use:

```text
Manage Pages / Administrar páginas
  -> Webhooks
  -> Page
```

Do not configure this CTA under Graph API `User`.

The Page callback remains:

```text
https://<worker>.<workers-subdomain>.workers.dev/webhooks/meta/messenger
```

Payload routing:

```text
entry[].changes[].field = "feed"
item = "comment"
verb = "add"
```

## Reproduce

Follow:

```text
mk1/Test/meta-facebook-comments-setup-2026-09-21.md
```

The Meta dashboard `feed` sample commonly sends `item=status`; that proves transport only.

Use the sanitized synthetic replay only as edge-classification proof. It must never be labeled real provider delivery.

## Historical source

```text
feature/cta-meta-facebook-comments-poc
PR #36
```

New work starts from `developer`.
