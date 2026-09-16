# Integration G3-I1 Certification Evidence — 2026-09-16

## Scope

Gate: `G3-I1 — Connection / Provider Registry + Secret References`

Canonical branch: `build/g3-integration`

Predecessor seal: G3-I0 exact head `41bc349c6cd5487a34f706653171c71ce3792d81`.

## Candidate implementation evidence

The first executable G3-I1 candidate was assembled on head `ec70ffd08b43bcff12457cd3322af74e8dffa249` and passed the dedicated gate for both push and PR events before documentation promotion.

Candidate dedicated runs:

```text
Push 35146652798  SUCCESS
PR   35146656845  SUCCESS
```

Both candidates passed:

```text
g3-i1-registry-contracts
g3-i1-postgres-registry
g3-i1-protected-predecessor-regressions
integration-g3-i1-seal
```

Candidate evidence is not the terminal exact-head seal because the receipt, design, ledger and strengthened stale-revision proof are committed afterward. The dedicated gate must pass again on that documentation-complete head.

## Durable model

Migration `012_integration_registry.sql` establishes:

```text
integration_providers
integration_connections
integration_secret_references
```

Key authority properties:

```text
provider identity                    provider_kind
connection identity                  business_slug + connection_ref
connection/provider relationship     FK provider_kind
secret relationship                  FK business_slug + connection_ref
secret material                      NOT STORED
```

## Secret-reference proof

The schema contains reference metadata (`secret_ref`, `purpose`, `binding_kind`, `binding_ref`) but no secret-value/token/API-key/password/credential fields. G3-I1 deliberately certifies indirection, not a secret vault.

## Business isolation proof

The certifier registers the same `connectionRef = calendar-primary` for two different businesses and then disables only business A. Business B remains independently resolvable and enabled.

## Capability proof

A connection may expose only capabilities declared by its provider. Registration with `payments.capture` against a provider that exposes only calendar capabilities fails with `CAPABILITY_NOT_SUPPORTED`.

## Lifecycle and concurrency-safety proof

Connection lifecycle mutation requires an expected revision. After revision 1 is disabled and becomes revision 2, a stale write using expected revision 1 must fail with `CONNECTION_REVISION_CONFLICT` and leave durable state unchanged.

## Protected predecessors

The dedicated workflow re-runs I0 plus protected Scheduler, Services, Appointment, CTA and channel regressions. Integration registry code is also guarded from importing Scheduler/Services contracts, Temporal orchestration or CTA implementation modules.

## Truth boundary

G3-I1 proves configured provider metadata, business-scoped connections and secret references. It does not prove external provider authentication, secret retrieval, outbound delivery/retries, inbound webhook authentication/dedup, a real provider adapter, Temporal composition, Agent or MCP.

## Final-seal requirement

The terminal exact head is established only after all documentation-complete branch mutations stop and both dedicated push and PR G3-I1 workflows pass on that same SHA. Final run/artifact IDs are recorded in PR #33 without mutating the sealed head.
