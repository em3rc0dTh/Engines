# MK1 — Integration Engine Contract

## Status

**G3-I0 CERTIFIED · G3-I1 CERTIFIED · G3-I2 CERTIFIED · G3-I3 CERTIFIED · G3-I4 NEXT**

Scheduler G2 is terminally closed and merged into the baseline. Integration Engine remains a separate authority boundary on `build/g3-integration` / PR #33. Certification status is valid only on an exact head that passes the corresponding dedicated gate.

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

Integration MUST NOT become a second Scheduler, Services catalog, CTA router, customer identity authority, Temporal replacement, Agent runtime, or MCP registry.

## G3 roadmap

```text
I0  canonical command/event contracts + authority boundary        ✅ CERTIFIED
I1  connection/provider registry + secret references              ✅ CERTIFIED
I2  durable outbound command + retry/idempotency ledger           ✅ CERTIFIED
I3  authenticated inbound webhook + deduplication ledger          ✅ CERTIFIED
I4  first real provider adapter                                   NEXT
I5  Temporal composition + failure/recovery certification         OPEN
```

## G3-I0 canonical contracts

### IntegrationCommand

Provider-neutral outbound intent:

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

The command states *what external effect is requested*. Provider-specific HTTP routes, SDK calls, webhook shapes, tokens, API keys and retry headers are outside the canonical command.

### IntegrationEvent

Provider-neutral inbound fact:

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

Canonical consumers must not depend on raw provider JSON for ordinary domain behavior.

### Canonical payload safety

Executable I0 validation rejects secret-like material recursively and rejects provider transport mechanics such as provider endpoints/routes, SDK methods, HTTP methods and HTTP headers from canonical payloads.

Outbound operation identity remains business scoped:

```text
integration-operation:{businessSlug}:{operationId}
```

Inbound provider-event identity remains business + connection scoped:

```text
integration-event:{businessSlug}:{connectionRef}:{providerEventIdentity}
```

## G3-I1 registry model

I1 materializes the provider-neutral connection boundary established by I0.

### Provider registry

```text
providerKind
displayName
status = ENABLED | DISABLED
capabilities[]
revision
```

A provider definition describes capabilities available behind an adapter. I1 does not execute provider HTTP/SDK mechanics.

### Business-scoped connection registry

```text
connectionRef
businessSlug
providerKind
externalAccountRef?
status = ENABLED | DISABLED
capabilities[]
secretRefs[]
revision
createdAt
updatedAt
```

Durable identity is:

```text
(businessSlug, connectionRef)
```

The same `connectionRef` may therefore exist for different businesses without sharing state. Connection capabilities MUST be a subset of the referenced provider's capabilities.

### Secret references

Secrets are referenced, never embedded in canonical commands/events or persisted as registry values.

I1 reference shape:

```text
secretRef
purpose
bindingKind = ENV | EXTERNAL_SECRET_STORE
bindingRef
```

`bindingRef` is a locator/name. It is not a token, API key, password, Authorization header or credential value.

PostgreSQL tables intentionally separate registry metadata:

```text
integration_providers
integration_connections
integration_secret_references
```

`integration_secret_references` MUST NOT acquire secret-value fields. Resolution of actual credential material belongs behind the provider-adapter/secret-resolution boundary and is not an I1 claim.

### Registry lifecycle semantics

I1 requires:

```text
provider must exist and be ENABLED before a connection is created
connection capabilities ⊆ provider capabilities
identical provider/connection material may replay idempotently
changed material under the same durable identity conflicts
disabled connections fail closed at resolve time
status mutation requires expected revision
stale revision update fails without changing durable state
business scopes remain isolated
```

Canonical registry errors include:

```text
PROVIDER_NOT_FOUND
PROVIDER_DISABLED
PROVIDER_CONFLICT
CONNECTION_NOT_FOUND
CONNECTION_DISABLED
CONNECTION_CONFLICT
CONNECTION_REVISION_CONFLICT
CAPABILITY_NOT_SUPPORTED
```

## G3-I2 durable outbound model

I2 materializes provider-neutral outbound execution state behind the canonical `IntegrationCommand` and I1 connection boundary.

### Durable identity

```text
businessSlug + operationId
```

The same operation identifier may be used by different businesses without sharing state. Inside one business, replay of the same canonical material resolves to the existing durable operation; changed material under the same operation identity is rejected as `IDEMPOTENCY_CONFLICT`.

### Outbound command state

PostgreSQL owns durable state for:

```text
integration_outbound_commands
integration_outbound_attempts
```

The ledger records provider-neutral execution state and attempt history. It does not persist credential material or raw provider response bodies.

### Claim and retry semantics

I2 establishes:

```text
READY → IN_FLIGHT → SUCCEEDED
READY → IN_FLIGHT → RETRY_WAIT → IN_FLIGHT
READY → IN_FLIGHT → FAILED_PERMANENT
```

Required mechanics:

```text
atomic claim with one delivery winner
lease on an in-flight claim
expired lease becomes recoverable
abandoned attempt records LEASE_EXPIRED
retry is unavailable before nextAttemptAt
retry count is bounded by maxAttempts
terminal replay returns the terminal record without a new attempt
```

These mechanics make provider delivery safe to compose later; they do not claim provider acceptance before I4.

### I2 secret boundary

The outbound schema intentionally excludes credential-bearing or provider-transport fields such as:

```text
token
access_token
api_key
password
secret_value
credential
authorization
raw_response
```

Actual secret material remains behind the adapter/secret-resolution boundary. Provider-neutral receipt references may be persisted without storing secret material or raw provider payloads.

## G3-I3 durable inbound model

I3 materializes the provider-neutral inbound acceptance path behind the I0 `IntegrationEvent` contract and I1 connection registry.

Canonical ordering is security-relevant:

```text
external webhook
  ↓
authentication / verification
  ↓
business-scoped connection + capability resolution
  ↓
canonical IntegrationEvent validation
  ↓
durable provider-event acceptance / replay protection
```

### Transient transport envelope

Webhook request transport material is intentionally transient:

```text
headers
rawBody
receivedAt
```

Only the provider verifier receives headers/raw body. The durable Integration ledger does not persist raw bodies, signatures, headers or credential material.

A concrete real-provider verifier and actual secret resolution remain I4 responsibilities. I3 uses a deterministic proof verifier only to certify engine ordering and persistence behavior.

### Durable provider-event identity

PostgreSQL owns accepted inbound canonical events in:

```text
integration_inbound_events
```

Durable identity is:

```text
(businessSlug, connectionRef, providerEventIdentity)
```

The same provider event identity may therefore exist in a different business or connection without sharing state.

### Replay / dedup semantics

For one durable provider-event identity:

```text
same canonical material       → replay existing durable event
changed canonical material    → IDEMPOTENCY_CONFLICT
concurrent identical delivery → exactly one insertion; other acceptor resolves as replay
```

The first accepted `receivedAt` remains historical truth and is not replaced by a later replay arrival time.

### Authentication-before-durability invariant

Invalid authentication/verification must produce:

```text
AUTHENTICATION_FAILED
zero accepted durable event
```

Successful verification followed by missing/disabled/incompatible connection resolution must also fail before the inbound ledger accepts an event.

### Canonicalization and secret boundary

A provider verifier may inspect provider-specific transport fields, but only provider-neutral normalized data may become `IntegrationEvent` material. I0 payload validation remains authoritative after normalization.

The inbound persistence schema intentionally excludes:

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

Provider routes, provider delivery-attempt mechanics, webhook headers and verification signatures must not escape into ordinary domain behavior.

## Error taxonomy baseline

Provider-facing failures remain provider-neutral enough for Temporal/domain policy:

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

Provider-specific error codes may later be retained as evidence but must map into canonical categories before leaving Integration Engine.

## Directionality and ownership

### Outbound

```text
Temporal/domain owns intent and orchestration
Integration owns connection resolution and provider delivery mechanics
Provider owns external acceptance semantics
```

### Inbound

```text
Provider adapter owns raw authentication/verification + normalization
Integration owns replay/dedup boundary and canonical event emission
Temporal/domain owns resulting business workflow decisions
```

## Executable certification surfaces

### I0

```text
mk1/runtime/src/contracts/integration-engine/types.ts
mk1/runtime/src/contracts/integration-engine/validation.ts
mk1/runtime/src/contracts/integration-engine/index.ts
mk1/runtime/src/contracts/integration-engine/integration-engine.contract.test.ts
mk1/runtime/scripts/certify-integration-g3-i0.ts
.github/workflows/mk1-integration-g3-i0.yml
```

### I1

```text
mk1/runtime/src/integration/registry.ts
mk1/runtime/src/integration/registry.test.ts
mk1/runtime/src/persistence/postgres/integration-registry.repository.ts
mk1/runtime/migrations/012_integration_registry.sql
mk1/runtime/scripts/migrate-postgres-integration-g3-i1.ts
mk1/runtime/scripts/certify-integration-g3-i1.ts
.github/workflows/mk1-integration-g3-i1.yml
```

I1 receipt: `mk1/Test/g3-integration-engine-i1.md`.
Evidence: `mk1/Build/evidence/integration-g3-i1-certification-2026-09-16.md`.

### I2

```text
mk1/runtime/src/integration/outbound.ts
mk1/runtime/src/persistence/postgres/integration-outbound-ledger.repository.ts
mk1/runtime/migrations/013_integration_outbound_ledger.sql
mk1/runtime/scripts/migrate-postgres-integration-g3-i2.ts
mk1/runtime/scripts/certify-integration-g3-i2.ts
.github/workflows/mk1-integration-g3-i2.yml
```

I2 receipt: `mk1/Test/g3-integration-engine-i2.md`.
Evidence: `mk1/Build/evidence/integration-g3-i2-certification-2026-09-16.md`.

### I3

```text
mk1/runtime/src/integration/inbound.ts
mk1/runtime/src/persistence/postgres/integration-inbound-ledger.repository.ts
mk1/runtime/migrations/014_integration_inbound_event_ledger.sql
mk1/runtime/scripts/migrate-postgres-integration-g3-i3.ts
mk1/runtime/scripts/certify-integration-g3-i3.ts
.github/workflows/mk1-integration-g3-i3.yml
```

I3 receipt: `mk1/Test/g3-integration-engine-i3.md`.
Evidence: `mk1/Build/evidence/integration-g3-i3-certification-2026-09-16.md`.

## Existing channel truth boundary

Existing interactive Telegram/WhatsApp channel transports remain CTA/channel evidence and are not silently reclassified as Integration Engine certification.

Kapso evidence likewise remains within its existing CTA/channel transport claim unless I4 explicitly selects and certifies it as the first real provider adapter through the Integration contract.

## Explicit exclusions after I3

Even after I3 certification, Integration Engine does **not** yet claim:

```text
secret values stored by Engines
concrete secret-manager retrieval/rotation
real provider HTTP/SDK outbound delivery
real provider webhook authentication success
provider-specific signing/key-rotation policy
provider-specific idempotency headers/keys
real provider acceptance
real provider sandbox/production evidence
Temporal Integration composition
production security/readiness
Agent behavior
MCP behavior
```

## Next gate — G3-I4

G3-I4 is the first real-provider gate. It must select one actual external provider and bind its real adapter to the existing I0-I3 surfaces without weakening the authority boundaries.

At minimum I4 must provide real-provider evidence for the selected capability, including the applicable real authentication/credential path and at least one provider-observed request/event or acceptance artifact. Mocks or deterministic fixtures may remain as tests but cannot satisfy the real-provider certification claim.

The selected provider, capability and credential/sandbox availability are therefore explicit inputs to I4 rather than facts to invent in this contract.

No merge authorization is implied by any Integration certification gate. PR #33 remains draft/open/unmerged until explicit owner authorization.
