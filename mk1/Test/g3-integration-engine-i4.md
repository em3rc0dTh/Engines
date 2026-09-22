# G3-I4 — Kapso WhatsApp Real-Provider Certification Receipt

## Verdict

**✅ CERTIFIED**

Terminal marker:

```text
INTEGRATION_G3_I4_CERTIFICATION_PASS
```

## Certification basis

G3-I4 was physically exercised against the current G3 Integration implementation on source head:

```text
25ec2f0dd53c3eb2e56f6230d1d0402e8e3a0c22
```

The bounded session executed the complete provider round trip:

```text
IntegrationCommand
→ I1 business-scoped connection registry
→ I2 durable outbound ledger
→ Kapso WhatsApp Integration adapter
→ real Kapso API
→ real WhatsApp delivery
→ human nonce-bound reply
→ real signed Kapso webhook
→ Kapso webhook verifier
→ I3 inbound deduplication ledger
→ canonical IntegrationEvent
```

Observed physical markers:

```text
INTEGRATION_G3_I4_REAL_OUTBOUND_ACCEPTED
INTEGRATION_G3_I4_REAL_WEBHOOK_ACCEPTED
INTEGRATION_G3_I4_REAL_PROVIDER_PASS
```

## Reviewed human receipt

The owner-produced sanitized receipt reported:

```text
schemaVersion   1
gate            G3-I4
result          PASS
providerKind    kapso-whatsapp
businessSlug    i4-kapso-live
connectionRef   kapso-live-1789663088
operationId     i4-kapso-live:63bb0ef2-1d92-4273-88b2-00bb32fa09a7
eventId         integration-event:aaadb0488a736704a5b242250e9897484dbdabce1b78e473d647e1903c6a2eb7
eventType       message.received
replayed        false
startedAt       2026-09-17T16:38:15.656Z
outboundAt      2026-09-17T16:38:23.333Z
inboundAt       2026-09-17T16:39:16.971Z
completedAt     2026-09-17T16:39:17.015Z
```

Provider identifiers are retained only as repository-safe SHA-256 fingerprints:

```text
outboundProviderReceiptSha256  800cac8aa78272bb24c02203b7143e87f7ddad5d5f541f0a2703e60f8b7d2302
inboundProviderIdentitySha256   3c99a12c16f82c68aa050dcc6a0fefd66d1ca1e93028b1d0e089fbdfd355e858
```

The exact provider identifiers remain in the owner's local sanitized receipt and terminal capture. They are not required to be public repository data.

## Truth boundary

The committed certification material intentionally contains no:

```text
Kapso API key
Kapso webhook secret
recipient phone number
provider phone-number identifier
raw webhook body
provider request/response headers
message content
nonce reply content
```

The reviewed local receipt explicitly recorded all of the corresponding truth-boundary flags as `false`.

## What is certified

G3-I4 certifies that the current Integration Engine can:

1. resolve runtime-only provider credentials through durable secret references without persisting raw secret material;
2. map a canonical `messaging.send / send_text` command to the real Kapso WhatsApp API;
3. persist outbound operation state and capture a real provider receipt through I2;
4. receive a real human WhatsApp reply through the configured Kapso webhook;
5. verify the signed raw webhook before durable acceptance;
6. normalize the provider payload to canonical `IntegrationEvent`;
7. persist/deduplicate the event through I3 with `replayed=false` for the first acceptance;
8. preserve the no-secret/no-raw-transport durability boundary.

## Important limits

This receipt does **not** claim:

```text
production rollout readiness
all WhatsApp message types
all provider failure modes
multi-provider certification
Temporal composition/recovery certification
G3-I5 completion
PR #33 merge authorization
```

During physical preparation, a closed WhatsApp 24-hour customer-service window was observed as a real provider rejection. After the tester opened the service window from the authorized recipient, the same Integration path completed the physical round trip successfully. This is operational evidence, not a claim that I4 owns WhatsApp conversation-policy orchestration.

## Sequential promotion

The G3 sequential-hard-gate policy is now advanced to:

```text
G3-I4  CERTIFIED
G3-I5  NEXT
```

G3-I5 may begin only after the documentation-complete G3-I4 workflow seals this promotion on the exact branch head.
