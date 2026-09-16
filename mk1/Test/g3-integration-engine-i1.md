# MK1 Integration Engine — G3-I1 Certification Receipt

## Gate

**G3-I1 — Connection / Provider Registry + Secret References**

Status: **CERTIFIED**

This receipt is authoritative only when the documentation-complete exact head passes the dedicated push and PR workflows. Any later branch mutation invalidates that exact-head seal until the same gate is rerun.

Predecessor: `G3-I0 CERTIFIED`.

## Certified intent

G3-I1 introduces the durable, business-scoped registry that resolves a provider-neutral `connectionRef` into configured Integration metadata without persisting credential values.

The registry owns:

```text
providerKind
provider status
provider capabilities
businessSlug + connectionRef identity
externalAccountRef metadata
connection status
connection capability subset
secretRef + purpose + bindingKind + bindingRef
optimistic connection revision
```

It does not own outbound delivery, provider retries, inbound webhook authentication/dedup, provider SDK/HTTP calls, Temporal workflow composition, Agent behavior, or MCP.

## Persistence truth

PostgreSQL is the transactional authority for G3-I1 registry state:

```text
integration_providers
integration_connections
integration_secret_references
```

Connection identity is composite and business scoped:

```text
(businessSlug, connectionRef)
```

Therefore the same `connectionRef` may exist for two businesses without crossing their configuration or lifecycle state.

## Secret boundary

`integration_secret_references` persists locators only. It intentionally has no column for token/API-key/password/authorization/credential values.

Supported binding classes in I1:

```text
ENV
EXTERNAL_SECRET_STORE
```

Example reference:

```text
secretRef   = auth-primary
purpose     = provider-auth
bindingKind = ENV
bindingRef  = BUSINESS_A_CALENDAR_TOKEN
```

`bindingRef` names where a later provider adapter may resolve material; it is not the material itself.

## Executable invariants

The dedicated G3-I1 probe proves:

```text
provider registration is durable and idempotent for identical material
conflicting material under the same provider identity is rejected
connection registration is durable and business scoped
connection capabilities must be a subset of provider capabilities
identical business + connection material replays safely
connection material conflict is rejected
disabled connections cannot be resolved for delivery
stale connection revision updates fail with CONNECTION_REVISION_CONFLICT
a stale update leaves durable state unchanged
the same connectionRef in another business remains independent
unknown business/connection fails closed
only secret references are persisted
I0 canonical authority and predecessor regressions remain intact
```

## Terminal proof markers

```text
INTEGRATION_G3_I1_PROVIDER_REGISTRY_PASS
INTEGRATION_G3_I1_CONNECTION_REGISTRY_PASS
INTEGRATION_G3_I1_SECRET_REFERENCE_PASS
INTEGRATION_G3_I1_CAPABILITY_GUARD_PASS
INTEGRATION_G3_I1_REVISION_GUARD_PASS
INTEGRATION_G3_I1_BUSINESS_ISOLATION_PASS
INTEGRATION_G3_I1_REGISTRY_SEMANTICS_PASS
INTEGRATION_G3_I1_PREDECESSOR_REGRESSION_PASS
INTEGRATION_G3_I1_CERTIFICATION_PASS
```

## Truth boundary / explicit non-claims

G3-I1 does **not** certify:

```text
real credential values stored by Engines
a concrete secret manager implementation
credential rotation or revocation against a provider
provider authentication success
outbound command persistence or delivery
retry/backoff persistence
provider idempotency keys
webhook authentication
inbound event dedup persistence
real provider adapter acceptance
Temporal Integration composition
Agent or MCP behavior
production security/readiness
```

Those claims belong to later gates.

## Gate transition

On a successful documentation-complete exact-head seal:

```text
G3-I1 CERTIFIED
G3-I2 NEXT
```

No merge authorization is implied. PR #33 remains draft/open/unmerged until the owner explicitly decides otherwise.
