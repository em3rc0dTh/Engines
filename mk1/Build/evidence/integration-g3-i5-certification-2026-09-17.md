# Integration G3-I5 Temporal Composition Certification Evidence — 2026-09-17

## Baseline candidate result

**PASS**

Original candidate branch head:

```text
72ccb5d0cd5e2cd251fbf25ea9f6731e642361a5
```

Original GitHub Actions evidence:

```text
run        35249039047
artifact   integration-g3-i5-candidate-35249039047
artifactId 10509345555
digest     sha256:af89ce47a80be6bbe7a30c123873d53cd038787ace9b09458a41a7cadb02cb68
```

That run established the initial Temporal failure/recovery boundary. The I5 gate is now hardened further: every implementation/documentation mutation must pass the dedicated exact-head workflow, including concurrent-idempotency and conflicting-replay assertions. Exact-head workflow artifacts are authoritative for the hardened gate and are intentionally not pre-recorded here before the run exists.

## Actual Temporal proof

The certification job starts real local PostgreSQL and a real Temporal development server, applies I1-I3 persistence migrations, builds a Temporal workflow bundle and runs a worker on an isolated I5 certification task queue.

Required runtime evidence includes:

```text
Temporal worker state RUNNING
integrationDeliveryWorkflow
executeIntegrationDelivery activity
real Temporal activity retry after injected failure
concurrent workflows over one Integration operation identity
I2 idempotency-conflict enforcement
Temporal worker states STOPPING → DRAINING → DRAINED → STOPPED
```

## Required markers

```text
INTEGRATION_G3_I5_ACTIVITY_RETRY_TERMINAL_REPLAY_PASS
INTEGRATION_G3_I5_I2_RETRY_AUTHORITY_PASS
INTEGRATION_G3_I5_TERMINAL_FAILURE_PASS
INTEGRATION_G3_I5_CANONICAL_EVENT_HANDOFF_PASS
INTEGRATION_G3_I5_WORKFLOW_REPLAY_NO_DUPLICATE_PROVIDER_ATTEMPT_PASS
INTEGRATION_G3_I5_CONCURRENT_IDEMPOTENCY_PASS
INTEGRATION_G3_I5_IDEMPOTENCY_CONFLICT_PASS
INTEGRATION_G3_I5_WORKFLOW_HISTORY_BOUNDARY_PASS
INTEGRATION_G3_I5_CERTIFICATION_PASS
```

All markers are independently required by the workflow before the exact-head certification seal may pass.

## Recovery proof

A forced exception is injected after an I2 operation has already persisted `SUCCEEDED`. Temporal retries the activity. The second activity execution reuses the same business/operation identity and I2 returns the existing terminal operation instead of claiming another provider attempt.

Evidence boundary:

```text
Temporal activity executions > 1
I2 provider attempts          = 1
provider deliver calls        = 1
terminal result               = SUCCEEDED
```

This proves terminal replay safety under Temporal activity retry.

## Explicit idempotency proof

I5 preserves the I2 durable identity:

```text
businessSlug + operationId
```

The hardened executable proof covers four idempotency cases:

```text
1. terminal workflow replay
   same identity → existing SUCCEEDED → zero duplicate provider attempt

2. concurrent Temporal workflows
   same identity → one atomic I2 delivery winner → both converge on SUCCEEDED
   provider calls = 1; durable attempts = 1

3. identical enqueue replay
   same identity + same canonical material → existing terminal operation returned

4. conflicting replay
   same identity + changed canonical material → IDEMPOTENCY_CONFLICT
   durable terminal command/status unchanged
   provider calls and durable attempts remain 1
```

This certifies that Temporal composition does not weaken or replace I2 idempotency authority.

## Retry ownership proof

A different operation returns one retryable provider result followed by success.

```text
I2 attempt 1 = RETRYABLE / TRANSIENT_PROVIDER_FAILURE
I2 state     = RETRY_WAIT
Temporal     = waits until nextAttemptAt
I2 attempt 2 = SUCCEEDED
```

The workflow does not own a separate provider retry count or provider delay calculation. I2 remains the durable delivery/retry authority.

## Permanent failure proof

A permanent provider rejection yields `FAILED_PERMANENT / PROVIDER_REJECTED` after one provider call. Temporal returns the terminal provider-neutral outcome without an independent provider retry.

## Inbound handoff proof

A valid canonical `IntegrationEvent` crosses a real Temporal workflow boundary. The workflow result projects only canonical identity/routing metadata; provider message content is not returned by the certification handoff.

## Secret/raw-provider boundary

The workflow source is provider-neutral and does not import Kapso/provider adapters or secret-resolution modules. Certification output is explicitly checked to exclude common credential/raw-transport field names.

## Scope limit

The I5 proof uses a deterministic certification provider adapter behind the real Integration activity boundary. It certifies Temporal composition, idempotency, failure/recovery and I2/I3 authority preservation. The real external-provider proof remains G3-I4 and is not duplicated or relabelled here.

I5 explicitly does **not** claim global exactly-once external side effects across an ambiguous provider-accepted / ledger-not-yet-committed failure window.
