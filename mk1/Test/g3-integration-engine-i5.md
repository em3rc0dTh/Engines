# G3-I5 — Temporal Composition + Failure/Recovery Certification Receipt

## Verdict

**✅ CERTIFIED**

Terminal marker:

```text
INTEGRATION_G3_I5_CERTIFICATION_PASS
```

## Candidate proof

The executable I5 candidate was proven through a real Temporal dev server and PostgreSQL on branch head:

```text
72ccb5d0cd5e2cd251fbf25ea9f6731e642361a5
```

GitHub Actions run:

```text
35249039047
```

Candidate evidence artifact:

```text
integration-g3-i5-candidate-35249039047
artifact id 10509345555
sha256:af89ce47a80be6bbe7a30c123873d53cd038787ace9b09458a41a7cadb02cb68
```

Required observed markers:

```text
INTEGRATION_G3_I5_ACTIVITY_RETRY_TERMINAL_REPLAY_PASS
INTEGRATION_G3_I5_I2_RETRY_AUTHORITY_PASS
INTEGRATION_G3_I5_TERMINAL_FAILURE_PASS
INTEGRATION_G3_I5_CANONICAL_EVENT_HANDOFF_PASS
INTEGRATION_G3_I5_WORKFLOW_REPLAY_NO_DUPLICATE_PROVIDER_ATTEMPT_PASS
INTEGRATION_G3_I5_WORKFLOW_HISTORY_BOUNDARY_PASS
INTEGRATION_G3_I5_CERTIFICATION_PASS
```

## Certified recovery scenario

The proof deliberately injected an activity failure after the Integration delivery activity had already completed I2 durable state as `SUCCEEDED`.

```text
Temporal activity attempt 1
→ executeIntegrationOutboundOperation
→ I2 claims provider attempt
→ deterministic certification provider accepts
→ I2 durably records SUCCEEDED
→ forced process/activity exception before activity result reaches workflow

Temporal activity retry
→ same businessSlug + operationId
→ executeIntegrationOutboundOperation
→ I2 observes terminal SUCCEEDED
→ returns terminal record
→ zero additional provider delivery attempt
```

The provider call count remained exactly one and the I2 durable attempt ledger contained exactly one successful provider attempt.

This certifies terminal replay/idempotency across Temporal activity retry. It does **not** claim global exactly-once delivery in the ambiguous provider-accepted / ledger-not-yet-committed failure window.

## Certified I2 retry authority

A separate operation used a provider sequence of:

```text
attempt 1 → RETRYABLE / TRANSIENT_PROVIDER_FAILURE
I2        → RETRY_WAIT + nextAttemptAt
Temporal  → waits until I2 nextAttemptAt
attempt 2 → SUCCEEDED
```

The durable I2 attempt ledger contained exactly two attempts in that order. Temporal did not create an independent provider retry counter or provider backoff policy.

Therefore:

```text
I2       = provider delivery-attempt and retry timing authority
Temporal = orchestration/wait/replay/recovery authority
```

## Certified terminal failure

A deterministic provider permanent rejection produced:

```text
FAILED_PERMANENT
lastErrorCode = PROVIDER_REJECTED
provider calls = 1
```

The Temporal workflow returned the provider-neutral terminal outcome instead of retrying the provider independently.

## Certified inbound handoff

A canonical `IntegrationEvent` was executed through `integrationEventHandoffWorkflow`.

The workflow validated the canonical event and returned only provider-neutral identity/routing metadata:

```text
eventId
providerEventIdentity
businessSlug
connectionRef
capability
eventType
receivedAt
```

Message payload content was intentionally omitted from the handoff result used by the certification proof.

## Workflow-history / secret boundary

I5 workflow code does not import provider adapters or secret-resolution modules. Provider-specific execution exists only in the activity/Integration boundary.

The certification projection was checked for absence of:

```text
api_key
access_token
authorization
webhook_secret
raw_body
headers
```

I5 does not place raw provider webhook material or credential values in its workflow inputs/results.

## Protected predecessor truth

The candidate gate also re-ran protected Integration, Scheduler, Services, Appointment, CTA/channel and Kapso transport regressions. Those regressions passed before candidate seal.

G3-I4 remains the real-provider proof. I5 does not relabel deterministic I5 provider fixtures as another physical provider certification.

## Final promotion

With I0 through I5 certified, the Integration G3 sequential ledger reaches terminal closure:

```text
G3-I0 CERTIFIED
G3-I1 CERTIFIED
G3-I2 CERTIFIED
G3-I3 CERTIFIED
G3-I4 CERTIFIED
G3-I5 CERTIFIED
currentNext = null
```

Final certification remains subject to re-running the dedicated I5 workflow on the documentation-complete exact branch head and requiring its terminal seal to pass.

## Truth boundary

G3 completion does not claim:

```text
production rollout approval
all provider policy/failure classes
all WhatsApp message types
multiple physically certified providers
global exactly-once external side effects
Agent/MCP completion
PR #33 merge authorization
```

PR #33 remains draft/open/unmerged until explicit owner authorization.
