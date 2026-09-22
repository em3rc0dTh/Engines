# MK1 Integration Engine — G3-I3 Certification Receipt

## Gate

**G3-I3 — Authenticated Inbound Webhook + Durable Provider-Event Deduplication**

## Status

**✅ CERTIFIED — authenticated/verified inbound acceptance, business-scoped connection resolution, durable provider-event identity, replay protection and canonical `IntegrationEvent` normalization established. G3-I4 is NEXT.**

This receipt is authoritative only when the documentation-complete exact branch head passes the dedicated G3-I3 workflow. Any later branch mutation invalidates that exact-head seal until G3-I3 is rerun.

Predecessors: `G3-I0`, `G3-I1`, `G3-I2` CERTIFIED.

## Certified intent

G3-I3 establishes the inbound half of the provider-neutral Integration Engine boundary:

```text
external webhook
  ↓
authentication / verification
  ↓
business-scoped connection resolution
  ↓
canonical provider-event material
  ↓
durable dedup / replay protection
  ↓
IntegrationEvent
```

The webhook transport envelope is transient. Headers, signatures and raw request bodies are available to the verifier but are not canonical Integration data and are not stored in the inbound ledger.

## Authentication-before-durability invariant

The engine does not create an accepted durable inbound event before provider authentication/verification succeeds.

The certification probe presents an invalid proof signature and verifies:

```text
AUTHENTICATION_FAILED
accepted durable event count = 0
```

The deterministic HMAC verifier used by the certification probe is a proof fixture for the I3 engine mechanics. It is **not** evidence of a real provider integration or real provider authentication; those claims belong to G3-I4.

## Connection authority

After authentication succeeds, I3 resolves the I1 business-scoped connection and required capability before durable event acceptance.

Therefore:

```text
unknown connection   → reject
DISABLED connection  → reject
missing capability   → reject
```

I3 does not create a second provider/connection registry.

## Durable identity

PostgreSQL is the transactional authority for accepted inbound events:

```text
integration_inbound_events
```

Provider-event identity is scoped by:

```text
(businessSlug, connectionRef, providerEventIdentity)
```

The same provider event identity may therefore exist independently in another business or connection.

## Replay and conflict semantics

For one business-scoped provider-event identity:

```text
same canonical material       → replay existing durable IntegrationEvent
changed canonical material    → IDEMPOTENCY_CONFLICT
concurrent identical delivery → exactly one new durable row; loser resolves as replay
```

`receivedAt` belongs to the first accepted durable event. A later replay does not mutate the historical first-acceptance timestamp.

## Canonicalization boundary

The proof provider payload intentionally contains transport/provider mechanics outside its canonical `data` payload. The verifier normalizes only the provider-neutral material required to construct `IntegrationEvent`.

Durable canonical state retains:

```text
schemaVersion
eventId
providerEventIdentity
businessSlug
connectionRef
capability
eventType
payload
occurredAt when supplied
receivedAt
correlation when supplied
```

Provider route details, delivery-attempt transport metadata, webhook headers and verification signatures do not cross the Integration boundary.

## Secret boundary

The I3 persistence schema intentionally has no columns for:

```text
raw_body
headers
signature
token
access_token
api_key
password
secret_value
webhook_secret
credential
authorization
raw_response
```

The certification probe also inspects persisted `event_json` and verifies that proof secret material, signature/header names and provider-route material are absent.

## Executable proof markers

```text
INTEGRATION_G3_I3_INVALID_AUTH_ZERO_DURABLE_PASS
INTEGRATION_G3_I3_CONNECTION_RESOLUTION_PASS
INTEGRATION_G3_I3_REPLAY_DEDUP_PASS
INTEGRATION_G3_I3_ATOMIC_DEDUP_PASS
INTEGRATION_G3_I3_MATERIAL_CONFLICT_PASS
INTEGRATION_G3_I3_BUSINESS_ISOLATION_PASS
INTEGRATION_G3_I3_CANONICAL_EVENT_PASS
INTEGRATION_G3_I3_SECRET_BOUNDARY_PASS
INTEGRATION_G3_I3_DURABLE_INBOUND_PASS
INTEGRATION_G3_I3_PREDECESSOR_REGRESSION_PASS
INTEGRATION_G3_I3_CERTIFICATION_PASS
```

## Candidate implementation evidence

The implementation candidate on head:

```text
609a205727519aab15c648215a3243afc41a6b2c
```

passed dedicated run:

```text
35155056830  SUCCESS
```

with all four jobs green:

```text
g3-i3-inbound-contracts                 PASS
g3-i3-postgres-inbound                  PASS
g3-i3-protected-predecessor-regressions PASS
integration-g3-i3-seal                  PASS
```

Candidate artifacts:

```text
integration-g3-i3-contracts-35155056830
id      10470921908
sha256  646b930451dd7cafeb7af652892e704d9723048f4f9777978aaa63c0f21d1112

integration-g3-i3-postgres-35155056830
id      10470324223
sha256  43811d1c5a196ebecfba208c50cc57aba1d343c0fb06d289b7a2bc996c80a8cb

integration-g3-i3-seal-35155056830
id      10470428868
sha256  065d68c0ffd98dd150ce2d83fc3e394232b93aeab956ef6545bae688a6c36f72
```

That run is supporting implementation evidence. The terminal seal is the later documentation-complete exact head that reruns this same gate.

## Explicit non-claims

G3-I3 does **not** certify:

```text
real provider HTTP/SDK delivery
real provider webhook authentication
actual secret-manager retrieval or rotation
provider-specific signing/key-rotation policy
real provider request/response acceptance
real provider idempotency contract
provider sandbox/production evidence
Temporal Integration composition
Agent behavior
MCP behavior
production security/readiness
```

Existing Telegram/WhatsApp/Kapso channel transports remain their existing CTA/channel evidence unless a later gate explicitly certifies one as the real I4 provider adapter.

## Gate transition

On successful documentation-complete exact-head recertification:

```text
G3-I3 CERTIFIED
G3-I4 NEXT
```

G3-I4 is the first gate that must use a selected real external provider and real provider evidence. No merge authorization is implied. PR #33 remains draft/open/unmerged until explicitly authorized by the owner.
