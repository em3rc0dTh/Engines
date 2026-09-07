# Quarry 05 — Kapso official WhatsApp transport

Date: 2026-09-07

## Sources reviewed

- https://docs.kapso.ai/docs/introduction
- https://docs.kapso.ai/docs/how-to/whatsapp/use-sandbox-for-testing
- https://docs.kapso.ai/docs/platform/webhooks/overview
- https://docs.kapso.ai/docs/platform/webhooks/security
- https://docs.kapso.ai/docs/platform/webhooks/advanced
- https://docs.kapso.ai/docs/whatsapp/business-scoped-user-ids
- https://docs.kapso.ai/docs/whatsapp/send-messages/text
- https://docs.kapso.ai/api/introduction

## Extracted provider facts

Kapso phone-number webhooks use HTTPS. Default Kapso webhooks can subscribe to `whatsapp.message.received`, carry `X-Webhook-Event`, `X-Webhook-Signature`, `X-Idempotency-Key`, and payload-version headers, and are signed with HMAC SHA-256 over the raw body. New integrations should use v2 payloads.

The Kapso WhatsApp API mirrors Meta Cloud API message shapes and authenticates with a project API key in `X-API-Key`. Text and interactive messages are supported in sandbox.

Sandbox sessions require registering the tester phone number and activating it with a short code sent from that same WhatsApp account. Sandbox supports webhooks but not templates/multiple recipients.

Kapso documents BSUID rollout: phone identity may be absent. Inbound integrations must accept BSUID-only identity and use `recipient` for outbound messages when no phone is available.

## Architecture conclusion

Kapso is acceptable only as a transport implementation below `WhatsAppTransportPort`. Customer/Temporal truth remains inside Engines. Provider event identity and HMAC authenticity are transport concerns; durable business idempotency remains the shared channel ledger concern.
