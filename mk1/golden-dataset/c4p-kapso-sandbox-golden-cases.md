# Golden Dataset — C4P Kapso sandbox

Date: 2026-09-07

```text
C4KS-001 valid v2 signed text webhook
  EXPECT verified KAPSO inbound + stable message/conversation identity

C4KS-002 invalid HMAC
  EXPECT reject before CTA normalization

C4KS-003 verified phone identity
  EXPECT phone candidate preserved for post-consent Customer prefill

C4KS-004 BSUID-only identity
  EXPECT accepted; no invented phone; Customer policy may request phone

C4KS-005 interactive consent YES
  EXPECT START_CUSTOMER_REGISTRATION

C4KS-006 consent NO
  EXPECT no Workflow / no Customer

C4KS-007 wrong phone_number_id
  EXPECT fail closed

C4KS-008 buffered delivery
  EXPECT each message normalized independently with stable message IDs

C4KS-009 outbound text to phone
  EXPECT Kapso proxy + X-API-Key + Meta-compatible `to`

C4KS-010 outbound interactive to BSUID
  EXPECT Meta-compatible `recipient`, not `to`

C4KS-011 existing local real-Temporal WhatsApp regression
  EXPECT Customer CREATED + phonePrefilled=true

C4KS-012 physical sandbox invalid input recovery
  EXPECT same Temporal Workflow remains usable then completes

C4KS-013 duplicate provider delivery
  EXPECT shared durable channel replay; no duplicate Customer effect
```

No golden case may claim production WhatsApp certification from a sandbox run.
