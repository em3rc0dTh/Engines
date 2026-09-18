# Meta channel M1 physical evidence — 2026-09-18

Status: BIDIRECTIONAL PROVIDER TRANSPORT PASS

## Physical evidence

A real Messenger message reached the permanent edge callback and returned HTTP 200.

Observed provider characteristics:

```text
HTTP method                 POST
callback path               /webhooks/meta/messenger
provider object             page
Page id                     present
sender PSID                 present (redacted from repository evidence)
provider message id         present
message text                TEST-ENGINES-001
provider API version        v26.0
X-Hub-Signature-256         present
Worker outcome              ok
HTTP response               200
```

A second physical message produced a real outbound Page reply:

```text
request: TEST-OUTBOUND-001
reply:   Engines received: "TEST-OUTBOUND-001" ✅
```

Markers:

```text
META_M1_INBOUND_TRANSPORT_PASS
META_M1_OUTBOUND_TRANSPORT_PASS
META_M1_BIDIRECTIONAL_TRANSPORT_PASS
```

## Evidence boundary

The deployed callback observed Meta's signature header, but deployed HMAC enforcement was not physically certified in this session. The repository already has deterministic signature verification at the Meta transport boundary, and M1 adds deterministic signed-message decoding.

The real physical event has not yet been passed through the canonical CTA dispatcher, Temporal `RegisterNewAppointment`, or the operational persistence graph.

Therefore:

```text
provider transport                        PASS
provider bidirectional response           PASS
deterministic canonical CTA normalization PASS
deployed signature rejection              OPEN
real CTA -> Temporal -> persistence        OPEN
exact provider replay/idempotency          OPEN
public App Review                          OPEN
```
