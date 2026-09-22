# Integration G3-I3 Certification Evidence — 2026-09-16

## Scope

Gate: `G3-I3 — Authenticated Inbound Webhook + Durable Provider-Event Deduplication`

Canonical branch: `build/g3-integration`

Protected predecessors: `G3-I0`, `G3-I1`, `G3-I2`.

## Candidate implementation evidence

Candidate head:

```text
609a205727519aab15c648215a3243afc41a6b2c
```

Dedicated candidate run:

```text
35155056830  SUCCESS
```

Jobs:

```text
g3-i3-inbound-contracts                 PASS
g3-i3-postgres-inbound                  PASS
g3-i3-protected-predecessor-regressions PASS
integration-g3-i3-seal                  PASS
```

Artifacts:

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

All artifacts report candidate `head_sha = 609a205727519aab15c648215a3243afc41a6b2c`.

This run establishes the implementation candidate only. Receipt, evidence, design status and the sequential certification ledger are promoted afterward, so the terminal claim requires the same G3-I3 workflow to pass again on the documentation-complete exact head.

## Authentication-before-persistence evidence

The I3 certifier presents an invalid deterministic proof signature before any accepted event exists. The boundary maps verification failure to `AUTHENTICATION_FAILED`, and PostgreSQL is queried immediately afterward to prove zero accepted durable rows exist for that business.

This establishes the ordering invariant:

```text
verify first
resolve connection second
canonicalize third
persist last
```

The deterministic HMAC verifier is only a certification fixture. It is intentionally not a real-provider claim.

## Connection-resolution evidence

A correctly signed webhook addressed to a missing business-scoped connection is rejected by the I1 registry before the inbound ledger accepts anything. This reuses the existing connection/capability authority rather than duplicating it in I3.

## Durable inbound identity

Migration `014_integration_inbound_event_ledger.sql` creates:

```text
integration_inbound_events
```

with primary durable provider-event identity:

```text
(business_slug, connection_ref, provider_event_identity)
```

and a business-scoped unique canonical event id.

## Replay / dedup evidence

The candidate probe proves:

```text
first valid delivery       → one new durable event
later identical delivery   → replay of the first durable event
concurrent same delivery   → exactly one insertion + one replay
mutated canonical material → IDEMPOTENCY_CONFLICT
```

The durable material hash excludes transport arrival time while preserving canonical event semantics, so a later replay cannot become a second fact merely because its webhook reached Engines later.

## Multi-business evidence

The same `connectionRef` and same `providerEventIdentity` are accepted independently for a second business. Their canonical event ids differ and tenant state does not leak across the business boundary.

## Canonicalization evidence

The proof webhook body contains provider transport fields in addition to canonical event data. The verifier normalizes only the provider-neutral event material. Persisted `IntegrationEvent` therefore excludes raw provider route/attempt mechanics.

I0 validation remains in force over the resulting `IntegrationEvent`, including the recursive secret/provider-transport rejection rules.

## Raw transport and secret boundary

The certifier verifies both schema and persisted JSON.

The inbound table does not contain credential/transport columns such as raw body, headers, signature, token, API key, password, webhook secret, credential, authorization or raw response.

The stored canonical event is separately checked to ensure it does not contain the proof HMAC secret, proof-signature header, provider trace header or provider-route material.

## Protected predecessor evidence

The candidate gate:

```text
re-certifies I0 contract behavior
re-certifies I1 registry behavior
runs I1 and I2 PostgreSQL migration/probes before I3
requires the I2 certification terminal marker
reruns Scheduler G2 protected tests
reruns Services S1
reruns Appointment
reruns CTA PoC
reruns channel C0
```

All workflow shell pipelines are fail-closed via `bash --noprofile --norc -eo pipefail`.

## Truth boundary

I3 certifies engine-level authenticated/verified inbound mechanics with a deterministic proof verifier. It does not establish a real provider adapter, real provider credentials, real provider acceptance, provider signing/key-rotation semantics, Temporal composition, Agent/MCP, or production readiness.

## Terminal exact-head requirement

After all documentary promotion is complete, the dedicated G3-I3 workflow must pass again on that exact branch head. Only that documentation-complete SHA is the terminal G3-I3 seal. Its run/artifact identifiers may then be recorded in PR #33 without mutating the sealed branch head.
