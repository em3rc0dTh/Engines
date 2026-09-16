# MK1 — Integration Engine Contract

## Status

**G3-I0 — DESIGN BASELINE / NEXT CERTIFICATION GATE**

Scheduler G2 is terminally closed. Integration Engine starts from the post-merge Scheduler baseline and is a separate authority boundary.

## Purpose

Integration Engine owns mechanics required to communicate with external systems without leaking provider-specific semantics into Services, Scheduler, Temporal domain logic, or CTA/channel ingress.

Canonical boundary:

```text
Temporal/domain
  → IntegrationCommand
  → Integration Engine
  → provider adapter
  → external system

external system
  → authenticated provider ingress
  → Integration Engine
  → canonical IntegrationEvent
  → Temporal/domain
```

## Authority boundaries

```text
Services     = commercial/catalog + abstract scheduling semantics
Scheduler    = concrete time/resource allocation
Temporal     = durable orchestration authority
Integration  = external-system connection, delivery, retry and provider-adapter mechanics
CTA/Channel  = interactive conversation ingress/egress
PostgreSQL   = transactional operational truth
MongoDB      = operational document/audit/semantic evidence
Object Store = attachment bytes/content integrity
```

Integration MUST NOT become a second Scheduler, Services catalog, CTA router, customer identity authority, or Temporal replacement.

## G3 roadmap

```text
I0  canonical command/event contracts + authority boundary
I1  connection/provider registry + secret references
I2  durable outbound command + retry/idempotency ledger
I3  authenticated inbound webhook + deduplication ledger
I4  first real provider adapter
I5  Temporal composition + failure/recovery certification
```

## I0 canonical concepts

### IntegrationCommand

A provider-neutral request emitted by an authoritative workflow/domain caller.

Required semantic fields:

```text
commandId / operationId
businessSlug
connectionRef
capability
action
subjectRef or targetRef
payload
requestedAt
correlation / causation identity
```

The contract describes *what external effect is requested*. Provider-specific HTTP routes, SDK calls, webhook shapes, access tokens, API keys and retry headers are outside the canonical command.

### IntegrationEvent

A provider-neutral fact accepted from an external system after provider authentication, normalization and replay protection.

Required semantic fields:

```text
eventId
providerEventIdentity
businessSlug
connectionRef
capability
eventType
payload
occurredAt / receivedAt
correlation / causation identity when available
```

Provider payload may be preserved as bounded evidence, but canonical consumers must not depend on raw provider JSON for ordinary domain behavior.

### Connection identity

A connection identifies one business-scoped configured relationship to an external provider/system. Connection identity is not the secret itself.

```text
connectionRef
businessSlug
providerKind
externalAccountRef/status metadata
secretRef(s)
capabilities[]
```

### Secret references

Secrets are referenced, never embedded into canonical commands/events, durable evidence receipts, logs or provider-neutral contracts.

I0 defines only the reference boundary. Secret storage/provider implementation belongs to later work.

### Operation identity

Outbound delivery must have a stable business-scoped operation identity so later I2 can make retries/re-entry durable and idempotent.

I0 does not yet claim successful delivery, provider idempotency, or retry persistence.

### Provider event identity

Inbound events must expose a stable provider event identity when the provider supplies one, so later I3 can deduplicate replay/redelivery before producing repeated canonical effects.

I0 does not yet claim webhook authentication or persistence.

## Error taxonomy baseline

Canonical failures must remain provider-neutral enough for Temporal/domain policy:

```text
INVALID_COMMAND
CONNECTION_NOT_FOUND
CONNECTION_DISABLED
CAPABILITY_NOT_SUPPORTED
AUTHENTICATION_FAILED
RATE_LIMITED
TRANSIENT_PROVIDER_FAILURE
PERMANENT_PROVIDER_FAILURE
PROVIDER_REJECTED
TIMEOUT
IDEMPOTENCY_CONFLICT
INVALID_PROVIDER_EVENT
DUPLICATE_PROVIDER_EVENT
```

Provider-specific status/error codes may be preserved as evidence but must map into a canonical category before leaving Integration Engine.

## Directionality and ownership

### Outbound

```text
Temporal/domain owns intent and orchestration
Integration owns provider delivery mechanics
Provider owns external acceptance semantics
```

### Inbound

```text
Provider adapter owns raw authentication/verification + normalization
Integration owns replay/dedup boundary and canonical event emission
Temporal/domain owns resulting business workflow decisions
```

## Explicit exclusions at I0

I0 does **not** certify:

```text
real provider credentials
secret storage
HTTP/webhook server implementation
outbound retry persistence
inbound dedup persistence
provider delivery
provider webhook authentication
Temporal composition
production security/readiness
WhatsApp/Telegram/Facebook/TikTok-specific integration claims
```

Existing interactive Telegram/WhatsApp channel transports remain CTA/channel evidence and are not silently reclassified as Integration Engine certification.

## I0 certification intent

I0 should only be promoted after executable contract tests prove:

```text
provider-neutral command/event validation
stable operation/provider-event identities
business scoping
secret material cannot enter canonical durable payloads
provider-specific fields do not leak into core contracts
authority/static import boundary guards
explicit I1 next-state ledger transition
```

Until that gate exists and passes, Integration Engine is **NOT CERTIFIED**.
