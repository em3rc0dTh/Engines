# Meta channel M1 — Messenger CTA contract

Date: 2026-09-18

## Decision

The existing Meta provider boundary is extended with an explicit M1 adapter for two Messenger CTA shapes:

- postback payload `register_appointment`;
- explicit text triggers such as `cita`, `appointment`, or `agendar`.

Unrelated free text is not silently promoted to a business CTA.

The provider payload is authenticated and decoded before canonicalization. The canonical event remains provider-neutral and routes to `RegisterNewAppointment`.

## Stable callback URL

The webhook callback must be a permanent HTTPS endpoint, not a laptop-dependent quick tunnel.

Reusable shape:

```text
https://<worker>.<workers-subdomain>.workers.dev/webhooks/meta/messenger
```

The exact deployed host is runtime configuration and should not be hard-coded into source. If the Worker is renamed, deleted, moved to another workers.dev subdomain, or replaced by a custom domain, Meta must be updated and the callback re-verified.

## Secrets

Keep these in the runtime secret store:

```text
META_WEBHOOK_VERIFY_TOKEN
META_PAGE_ACCESS_TOKEN
META_APP_SECRET
```

Never commit token values.

## Minimum Page subscriptions

```text
messages
messaging_postbacks
```

## Truth boundary

Physical provider transport was proven on 2026-09-18. The exact real provider event has not yet been physically driven through Engines CTA -> Temporal -> persistence. That remains the next gate.
