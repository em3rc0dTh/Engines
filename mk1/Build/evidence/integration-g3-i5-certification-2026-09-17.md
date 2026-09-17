# Integration G3-I5 Temporal Composition Certification Evidence — 2026-09-17

## Candidate result

**PASS**

Branch head:

```text
72ccb5d0cd5e2cd251fbf25ea9f6731e642361a5
```

GitHub Actions:

```text
run        35249039047
artifact   integration-g3-i5-candidate-35249039047
artifactId 10509345555
digest     sha256:af89ce47a80be6bbe7a30c123873d53cd038787ace9b09458a41a7cadb02cb68
```

## Actual Temporal proof

The certification job started real local PostgreSQL and a real Temporal development server, applied I1-I3 persistence migrations, built a Temporal workflow bundle and ran a worker on an isolated I5 certification task queue.

Observed worker bundle/runtime evidence included:

```text
Temporal worker state RUNNING
integrationDeliveryWorkflow
executeIntegrationDelivery activity
real Temporal activity retry after injected failure
Temporal worker states STOPPING → DRAINING → DRAINED → STOPPED
```

## Required markers

```text
INTEGRATION_G3_I5_ACTIVITY_RETRY_TERMINAL_REPLAY_PASS
INTEGRATION_G3_I5_I2_RETRY_AUTHORITY_PASS
INTEGRATION_G3_I5_TERMINAL_FAILURE_PASS
INTEGRATION_G3_I5_CANONICAL_EVENT_HANDOFF_PASS
INTEGRATION_G3_I5_WORKFLOW_REPLAY_NO_DUPLICATE_PROVIDER_ATTEMPT_PASS
INTEGRATION_G3_I5_WORKFLOW_HISTORY_BOUNDARY_PASS
INTEGRATION_G3_I5_CERTIFICATION_PASS
```

All markers were produced by the candidate run and independently required by the workflow before the candidate seal passed.

## Recovery proof

A forced exception was injected after an I2 operation had already persisted `SUCCEEDED`. Temporal retried the activity. The second activity execution reused the same business/operation identity and I2 returned the existing terminal operation instead of claiming another provider attempt.

Evidence boundary:

```text
Temporal activity executions > 1
I2 provider attempts          = 1
provider deliver calls        = 1
terminal result               = SUCCEEDED
```

This proves terminal replay safety under Temporal activity retry.

## Retry ownership proof

A different operation returned one retryable provider result followed by success.

```text
I2 attempt 1 = RETRYABLE / TRANSIENT_PROVIDER_FAILURE
I2 state     = RETRY_WAIT
Temporal     = waits until nextAttemptAt
I2 attempt 2 = SUCCEEDED
```

The workflow does not own a separate provider retry count or provider delay calculation. I2 remains the durable delivery/retry authority.

## Permanent failure proof

A permanent provider rejection yielded `FAILED_PERMANENT / PROVIDER_REJECTED` after one provider call. Temporal returned the terminal provider-neutral outcome without an independent provider retry.

## Inbound handoff proof

A valid canonical `IntegrationEvent` crossed a real Temporal workflow boundary. The workflow result projected only canonical identity/routing metadata; provider message content was not returned by the certification handoff.

## Secret/raw-provider boundary

The workflow source is provider-neutral and does not import Kapso/provider adapters or secret-resolution modules. Certification output was explicitly checked to exclude common credential/raw-transport field names.

## Scope limit

The I5 proof uses a deterministic certification provider adapter behind the real Integration activity boundary. It certifies Temporal composition, failure/recovery and I2/I3 authority preservation. The real external-provider proof remains G3-I4 and is not duplicated or relabelled here.
