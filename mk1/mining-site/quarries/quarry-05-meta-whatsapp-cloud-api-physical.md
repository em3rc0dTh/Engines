# Quarry 05 — Meta WhatsApp Cloud API physical-provider requirements

Date: 2026-09-04
Status: SOURCE REVIEW COMPLETE / BUILD ACTIVE

## Official source observations

Meta's official WhatsApp Business Platform material identifies WhatsApp Cloud API as the official hosted API and requires a Meta business portfolio, WhatsApp Business Account and business phone number context. The official getting-started surface exposes access-token, WABA and phone-number identifiers.

Inbound notifications are delivered as HTTPS webhooks. The Webhooks server must be publicly reachable over HTTPS with a valid certificate and the application must subscribe to the relevant WABA/message notifications.

Outbound messages use the Graph API endpoint:

```text
POST /<GRAPH_VERSION>/<PHONE_NUMBER_ID>/messages
Authorization: Bearer <ACCESS_TOKEN>
```

Interactive reply buttons and text messages are valid outbound shapes for the registration slice.

## Engines requirements derived from provider behavior

```text
GET webhook verification
POST raw-body HMAC verification (`X-Hub-Signature-256`)
phone_number_id scope validation
wamid message identity preservation
sender WhatsApp identity normalization
text payload normalization
interactive button-reply normalization
status-only notification acknowledgement without Customer mutation
Graph API outbound renderer
```

## Development public endpoint

Cloudflare documents Quick Tunnels for local development: they expose localhost through a temporary `trycloudflare.com` HTTPS URL without requiring a Cloudflare account. Quick Tunnels are explicitly development/testing infrastructure, not production hosting.

This is suitable for the C4P physical proof because Meta requires a public HTTPS callback while Engines remains local.

## Security implications

- webhook verification token is a setup secret but is not the HMAC key;
- POST authenticity is checked with the Meta app secret against the raw body;
- access token is only used for Graph API calls;
- no provider secret belongs in Git, logs or evidence receipts;
- Meta provider identifiers never become Customer-domain authority.

## References

- Meta official WhatsApp Business Platform / Cloud API Postman workspace
- Meta official Cloud API Get Started collection
- Meta official Webhooks collection and webhook payload reference
- Cloudflare official Quick Tunnels documentation

See runtime/design docs for the bounded implementation contract; this quarry records provider facts, not certification claims.
