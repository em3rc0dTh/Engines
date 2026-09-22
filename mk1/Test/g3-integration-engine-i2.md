# MK1 Integration Engine — G3-I2 Certification Receipt

## Gate

**G3-I2 — Durable Outbound Command + Retry / Idempotency Ledger**

## Status

**✅ CERTIFIED — durable business-scoped outbound execution state, idempotent replay, bounded retries and lease recovery established. G3-I3 is NEXT.**

This receipt is authoritative only when the documentation-complete exact branch head passes the dedicated G3-I2 workflow. Any later mutation invalidates that exact-head seal until the same gate is rerun.

Predecessor: `G3-I1 CERTIFIED`.

## Certified intent

G3-I2 turns provider-neutral `IntegrationCommand` intent into durable Integration-owned delivery state without yet claiming a real provider adapter.

Integration owns at this gate:

```text
business-scoped operation identity
durable outbound command state
idempotent enqueue/replay
material-conflict rejection
atomic delivery claim
attempt history
retry scheduling
bounded attempt exhaustion
lease-expiry recovery
terminal replay
provider-neutral receipt reference
```

It does not own Services catalog semantics, Scheduler capacity, Appointment decisions, CTA/channel routing, customer identity authority, Temporal workflow policy, Agent behavior or MCP.

## Persistence truth

PostgreSQL is the transactional authority for G3-I2 outbound state:

```text
integration_outbound_commands
integration_outbound_attempts
```

The durable idempotency scope is business + operation:

```text
(businessSlug, operationId)
```

Therefore the same `operationId` may exist for different businesses without sharing state.

## Idempotency and replay semantics

For the same business-scoped operation identity:

```text
same canonical material      → safe replay of existing durable command
changed canonical material   → IDEMPOTENCY_CONFLICT
terminal command replay      → same terminal state; no duplicate attempt
```

`commandId` and request timestamps may differ on a replay; durable semantic identity is based on the operation identity plus canonical command material enforced by the ledger.

## Claim / retry / recovery semantics

The dedicated probe proves:

```text
concurrent claims have one winner
retryable failure enters RETRY_WAIT
claim before nextAttemptAt returns no work
claim at/after nextAttemptAt creates the next attempt
attempt count is bounded by maxAttempts
exhausted retry becomes FAILED_PERMANENT
an expired in-flight lease is recovered on the next eligible claim
expired attempt is recorded as LEASE_EXPIRED
a later successful attempt may complete the operation
```

This is durable delivery state, not a claim that an external provider has accepted a request.

## Secret boundary

I2 preserves the I1 secret-reference boundary. Outbound ledger schemas intentionally do not persist token, API key, password, Authorization header, credential value or raw provider response fields.

Connection credential material remains outside canonical commands and outside the outbound ledger.

## Executable invariants

The dedicated G3-I2 gate proves:

```text
I0 canonical contracts remain valid
I1 provider/connection registry remains valid
identical operation replay is idempotent
mutated operation material is rejected
claim is atomic under concurrency
retry schedule is enforced
retry attempts are bounded
expired leases are recoverable without a second simultaneous winner
terminal replay does not redeliver
business scopes remain isolated
secret material is absent from outbound persistence
Scheduler / Services / Appointment regressions remain green
CTA / channel regressions remain green
```

## Terminal proof markers

```text
INTEGRATION_G3_I2_ENQUEUE_IDEMPOTENCY_PASS
INTEGRATION_G3_I2_ATOMIC_CLAIM_PASS
INTEGRATION_G3_I2_RETRY_SCHEDULE_PASS
INTEGRATION_G3_I2_BOUNDED_RETRY_PASS
INTEGRATION_G3_I2_LEASE_RECOVERY_PASS
INTEGRATION_G3_I2_BUSINESS_ISOLATION_PASS
INTEGRATION_G3_I2_SECRET_BOUNDARY_PASS
INTEGRATION_G3_I2_DURABLE_OUTBOUND_PASS
INTEGRATION_G3_I2_PREDECESSOR_REGRESSION_PASS
INTEGRATION_G3_I2_CERTIFICATION_PASS
```

## Truth boundary / explicit non-claims

G3-I2 does **not** certify:

```text
real provider HTTP/SDK delivery
provider authentication success
secret retrieval or rotation
provider-specific idempotency headers/keys
provider response normalization
inbound webhook authentication/verification
inbound provider-event deduplication
canonical event emission from a webhook
real provider acceptance
Temporal Integration composition
Agent or MCP behavior
production security/readiness
```

Those claims belong to later gates.

## Candidate evidence before documentary promotion

The implementation candidate on head `17dcd61bafddf420c3160976996151176ce635c1` passed PR run `35148540870` with all four jobs green:

```text
g3-i2-outbound-contracts                PASS
g3-i2-postgres-outbound                 PASS
g3-i2-protected-predecessor-regressions PASS
integration-g3-i2-seal                  PASS
```

That candidate run is supporting evidence only. The terminal seal is the later documentation-complete exact head that reruns this same gate.

## Gate transition

On successful documentation-complete exact-head recertification:

```text
G3-I2 CERTIFIED
G3-I3 NEXT
```

No merge authorization is implied. PR #33 remains draft/open/unmerged until the owner explicitly decides otherwise.
