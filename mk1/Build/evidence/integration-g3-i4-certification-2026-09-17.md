# Integration G3-I4 Physical Certification Evidence — 2026-09-17

## Result

**PASS — real-provider round trip completed.**

Physical source head:

```text
25ec2f0dd53c3eb2e56f6230d1d0402e8e3a0c22
```

Observed terminal markers:

```text
INTEGRATION_G3_I4_REAL_OUTBOUND_ACCEPTED
INTEGRATION_G3_I4_REAL_WEBHOOK_ACCEPTED
INTEGRATION_G3_I4_REAL_PROVIDER_PASS
```

## Boundaries exercised

```text
IntegrationCommand
→ I1 registry
→ I2 outbound ledger
→ Kapso WhatsApp adapter
→ real Kapso API
→ real WhatsApp message
→ human nonce-bound reply
→ real signed Kapso webhook
→ I3 inbound ledger
→ canonical IntegrationEvent
```

## Repository-safe evidence projection

```text
businessSlug     i4-kapso-live
connectionRef    kapso-live-1789663088
operationId      i4-kapso-live:63bb0ef2-1d92-4273-88b2-00bb32fa09a7
eventId          integration-event:aaadb0488a736704a5b242250e9897484dbdabce1b78e473d647e1903c6a2eb7
eventType        message.received
replayed         false
outboundAt       2026-09-17T16:38:23.333Z
inboundAt        2026-09-17T16:39:16.971Z
completedAt      2026-09-17T16:39:17.015Z
```

Provider-identifier fingerprints:

```text
outboundProviderReceiptSha256  800cac8aa78272bb24c02203b7143e87f7ddad5d5f541f0a2703e60f8b7d2302
inboundProviderIdentitySha256   3c99a12c16f82c68aa050dcc6a0fefd66d1ca1e93028b1d0e089fbdfd355e858
```

## Truth boundary

No credential value, recipient number, provider phone-number identifier, raw webhook body, provider header set, or message content is committed here.

The owner-side sanitized receipt explicitly carried:

```text
containsSecrets          false
containsRawWebhookBody   false
containsProviderHeaders  false
containsRecipientPhone   false
containsMessageContent   false
```

## Operational observation

A direct provider preflight initially returned HTTP 422 because the WhatsApp customer-service window was closed. After an inbound message from the authorized recipient reopened the 24-hour window, the current G3 Integration implementation completed the outbound and signed inbound round trip successfully.

This observation is evidence about the physical provider boundary. It does not expand I4 authority into WhatsApp conversation-policy or Temporal orchestration.
