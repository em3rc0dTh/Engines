# MK1 — Integration Engine Contract

## Status

**G3-I0 CERTIFIED — G3-I1 NEXT**

Scheduler G2 is terminally closed and merged into the baseline. Integration Engine is a separate authority boundary on `build/g3-integration` / PR #33.

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
I0  canonical command/event contracts + authority boundary        ✅ CERTIFIED
I1  connection/provider registry + secret references              NEXT
I2  durable outbound command + retry/idempotency ledger           OPEN
I3  authenticated inbound webhook + deduplication ledger          OPEN
I4  first real provider adapter                                   OPEN
I5  Temporal composition + failure/recovery certification         OPEN
```

## I0 certified canonical concepts

### IntegrationCommand

A provider-neutral request emitted by an authoritative workflow/domain caller.

Executable canonical fields:

```text
schemaVersion = 1
commandId
operationId
businessSlug
connectionRef
capability
action
exactly one: subjectRef | targetRef
payload
requestedAt
correlation? { correlationId, causationId? }
```

The contract describes *what external effect is requested*. Provider-specific HTTP routes, SDK calls, webhook shapes, access tokens, API keys and retry headers are outside the canonical command.

### IntegrationEvent

A provider-neutral fact accepted from an external system after provider authentication, normalization and replay protection at the Integration boundary.

Executable canonical fields:

```text
schemaVersion = 1
eventId
providerEventIdentity
businessSlug
connectionRef
capability
eventType
payload
occurredAt?
receivedAt
correlation? { correlationId, causationId? }
```

Canonical consumers must not depend on raw provider JSON for ordinary domain behavior. Provider evidence, when introduced later, remains outside the core canonical shape.

### Canonical payload safety

G3-I0 executable validation rejects secret-like material recursively from canonical payloads, including token/API-key/password/secret/authorization/private-key/credential families.

It also rejects provider transport mechanics such as provider endpoints/routes, SDK methods, HTTP methods and HTTP headers from canonical payloads. These belong behind provider adapters in later gates.

### Connection identity

A connection identifies one business-scoped configured relationship to an external provider/system. Connection identity is not the secret itself.

G3-I0 only establishes `connectionRef` as a provider-neutral reference carried by commands/events. G3-I1 will define and persist the registry material such as:

```text
connectionRef
businessSlug
providerKind
externalAccountRef/status metadata
secretRef(s)
capabilities[]
```

No connection registry is claimed by I0.

### Secret references

Secrets are referenced, never embedded into canonical commands/events, durable evidence receipts, logs or provider-neutral contracts.

G3-I0 certifies exclusion of secret material from the canonical payload boundary. Secret-reference registry semantics and storage-provider binding belong to G3-I1.

### Operation identity

Outbound intent exposes stable business-scoped operation identity:

```text
integration-operation:{businessSlug}:{operationId}
```

The G3-I0 proof requires identical business/material identity to reproduce the same canonical identity and a different business to produce a different identity.

I0 does not yet claim successful delivery, provider idempotency, retry persistence or a durable outbound command ledger.

### Provider event identity

Inbound identity is scoped by business + connection + provider event identity:

```text
integration-event:{businessSlug}:{connectionRef}:{providerEventIdentity}
```

The G3-I0 proof requires exact replay to reproduce the same identity while a changed business or connection produces a distinct identity.

I0 does not yet claim webhook authentication, inbound transport or persisted deduplication.

## Error taxonomy baseline

Canonical failures remain provider-neutral enough for Temporal/domain policy:

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

Provider-specific status/error codes may later be preserved as evidence but must map into a canonical category before leaving Integration Engine.

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

## G3-I0 executable certification

Certified implementation:

```text
mk1/runtime/src/contracts/integration-engine/types.ts
mk1/runtime/src/contracts/integration-engine/validation.ts
mk1/runtime/src/contracts/integration-engine/index.ts
mk1/runtime/src/contracts/integration-engine/integration-engine.contract.test.ts
mk1/runtime/scripts/certify-integration-g3-i0.ts
mk1/runtime/scripts/verify-integration-certification-ledger.ts
.github/workflows/mk1-integration-g3-i0.yml
```

The dedicated gate proves:

```text
provider-neutral command/event validation
stable outbound operation and provider-event identities
business and connection scoping
recursive canonical secret exclusion
provider HTTP/SDK mechanics exclusion
static authority/import boundaries
protected Scheduler/Services/Appointment/CTA/channel regressions
machine-ledger sequentiality
```

Terminal marker:

```text
INTEGRATION_G3_I0_CERTIFICATION_PASS
```

Candidate evidence is preserved in `mk1/Build/evidence/integration-g3-i0-certification-2026-09-16.md`. G3-I0 is promoted only under the policy requiring the same dedicated gate to pass again on the documentation-complete exact head.

## Explicit exclusions retained after I0

G3-I0 does **not** certify:

```text
configured external connections
real provider credentials
secret storage or secret-manager implementation
HTTP/webhook server implementation
outbound command persistence/delivery
outbound retry persistence
inbound dedup persistence
provider delivery/acceptance
provider webhook authentication
real provider adapter
Temporal Integration composition
production security/readiness
WhatsApp/Telegram/Facebook/TikTok-specific Integration claims
```

Existing interactive Telegram/WhatsApp channel transports remain CTA/channel evidence and are not silently reclassified as Integration Engine certification.

## Next gate — G3-I1

G3-I1 may now define the business-scoped connection/provider registry and secret-reference boundary. It must not implement outbound delivery/retry, inbound webhook/dedup, or a real provider adapter ahead of their gates.

Until G3-I1 receives its own dedicated executable gate, receipt, evidence, machine-ledger promotion and exact-head reseal, it remains **NEXT, not certified**.
