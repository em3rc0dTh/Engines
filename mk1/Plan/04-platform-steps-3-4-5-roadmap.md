# Platform Steps 3–5 Roadmap — Integration G3 Terminal Closure

Integration remains a separate authority from Services, Scheduler, Appointment, CTA/channel ingress and Temporal orchestration.

Canonical track:

```text
BRANCH  build/g3-integration
PR      #33 — Integration G3 canonical track
BASE    feature/pre-scheduler-node-edge-certification @ 3b1d43d87ef7bb9805e01bcaaf8260008327b1f1
```

## Sequential gate state

```text
G3-I0 canonical command/event contracts + authority boundary   ✅ CERTIFIED
G3-I1 connection/provider registry + secret references         ✅ CERTIFIED
G3-I2 durable outbound command + retry/idempotency ledger       ✅ CERTIFIED
G3-I3 authenticated inbound webhook + deduplication ledger      ✅ CERTIFIED
G3-I4 first real provider adapter — Kapso WhatsApp              ✅ CERTIFIED
G3-I5 Temporal composition + failure/recovery certification     ✅ CERTIFIED

currentNext = null
```

The G3 sequential-hard-gate track has no remaining implementation gate.

## I0–I3 deterministic core

G3-I0 froze provider-neutral `IntegrationCommand` / `IntegrationEvent` contracts and the secret/provider-mechanics exclusion boundary.

G3-I1 materialized business-scoped provider/connection configuration while persisting only secret references, never credential values.

G3-I2 became the single durable authority for outbound operation identity, provider-attempt count, retry timing, lease recovery and terminal provider outcome.

G3-I3 established authentication-before-durability for inbound provider events, provider-event deduplication and canonical `IntegrationEvent` persistence without raw webhook/signature material.

## G3-I4 — real provider adapter certified

Kapso WhatsApp is the first physically certified Integration provider.

Physical implementation source head:

```text
25ec2f0dd53c3eb2e56f6230d1d0402e8e3a0c22
```

Observed physical markers:

```text
INTEGRATION_G3_I4_REAL_OUTBOUND_ACCEPTED
INTEGRATION_G3_I4_REAL_WEBHOOK_ACCEPTED
INTEGRATION_G3_I4_REAL_PROVIDER_PASS
```

The physical round trip exercised:

```text
IntegrationCommand
→ I1 registry
→ I2 outbound ledger
→ Kapso Integration adapter
→ real Kapso API
→ real WhatsApp delivery
→ nonce-bound human reply
→ signed Kapso v2 webhook
→ Kapso Integration verifier
→ I3 inbound ledger
→ canonical IntegrationEvent
```

Repository-safe evidence:

```text
mk1/Test/g3-integration-engine-i4.md
mk1/Build/evidence/integration-g3-i4-certification-2026-09-17.md
```

A closed WhatsApp 24-hour service window was observed as a real HTTP 422 rejection before the authorized recipient opened the window. The subsequent current-G3 round trip passed. That operational provider policy is not elevated into Integration authority.

## G3-I5 — Temporal composition and recovery certified

I5 composes the already-certified Integration engine through Temporal while preserving I2/I3 authority.

Executable surfaces:

```text
mk1/runtime/src/orchestration/temporal/activities/integration-delivery.types.ts
mk1/runtime/src/orchestration/temporal/activities/integration-delivery.activities.ts
mk1/runtime/src/orchestration/temporal/workflows/integration.workflows.ts
mk1/runtime/src/orchestration/temporal/workers/integration.worker.ts
mk1/runtime/scripts/certify-integration-g3-i5.ts
.github/workflows/mk1-integration-g3-i5.yml
```

Candidate proof branch head:

```text
72ccb5d0cd5e2cd251fbf25ea9f6731e642361a5
```

Candidate run and artifact:

```text
run        35249039047
artifact   integration-g3-i5-candidate-35249039047
artifactId 10509345555
digest     sha256:af89ce47a80be6bbe7a30c123873d53cd038787ace9b09458a41a7cadb02cb68
```

The candidate started real PostgreSQL and a real Temporal development server, built a workflow bundle and ran a worker. Required markers all passed:

```text
INTEGRATION_G3_I5_ACTIVITY_RETRY_TERMINAL_REPLAY_PASS
INTEGRATION_G3_I5_I2_RETRY_AUTHORITY_PASS
INTEGRATION_G3_I5_TERMINAL_FAILURE_PASS
INTEGRATION_G3_I5_CANONICAL_EVENT_HANDOFF_PASS
INTEGRATION_G3_I5_WORKFLOW_REPLAY_NO_DUPLICATE_PROVIDER_ATTEMPT_PASS
INTEGRATION_G3_I5_WORKFLOW_HISTORY_BOUNDARY_PASS
INTEGRATION_G3_I5_CERTIFICATION_PASS
```

### Certified authority split

```text
Temporal
  = workflow orchestration, replay, waiting and process recovery

Integration activity boundary
  = execution entry into certified Integration engine surfaces

I2 outbound ledger
  = only provider-attempt count, retry schedule, lease and terminal-delivery authority

I3 inbound ledger
  = authenticated inbound acceptance and provider-event dedup authority
```

Temporal activity retry does not itself mean another provider delivery attempt. The certification deliberately failed an activity after I2 had already durably recorded `SUCCEEDED`; Temporal retried the activity under the same business/operation identity and I2 returned the existing terminal record. Provider call count remained one.

A separate retryable-provider scenario proved:

```text
provider attempt 1 → RETRYABLE
I2                 → RETRY_WAIT + nextAttemptAt
Temporal           → waits
provider attempt 2 → SUCCEEDED
```

Temporal did not create a second provider retry counter or calculate a competing provider backoff.

A permanent provider rejection also returned deterministic `FAILED_PERMANENT / PROVIDER_REJECTED` after one provider call.

Canonical inbound `IntegrationEvent` handoff crossed a real Temporal workflow boundary without passing raw webhook transport material or credentials.

Repository-safe evidence:

```text
mk1/Test/g3-integration-engine-i5.md
mk1/Build/evidence/integration-g3-i5-certification-2026-09-17.md
```

## Frozen authority boundaries after G3 closure

```text
Services     = commercial/catalog + abstract scheduling semantics
Scheduler    = concrete time/resource allocation
Appointment  = appointment business orchestration
CTA/Channel  = interactive conversation ingress/egress
Integration  = external-system registry, delivery, provider adapter, webhook/dedup mechanics
Temporal     = durable workflow orchestration/replay/recovery
I2           = provider delivery retry/attempt authority
I3           = authenticated inbound acceptance/dedup authority
PostgreSQL   = transactional operational truth
MongoDB      = operational document/audit/semantic evidence
Object Store = attachment bytes/content integrity
```

## Truth boundary

G3 terminal closure does not claim:

```text
production rollout authorization
all WhatsApp/provider policies or message types
multiple physically certified providers
global exactly-once external effects in every provider ambiguity window
Agent/MCP completion
PR #33 merge authorization
```

G3-I4 is the physical external-provider proof. G3-I5 uses a deterministic certification provider behind a real Temporal + PostgreSQL runtime to prove composition/recovery; it is not relabelled as a second physical provider proof.

## Final closure procedure

The documentation-complete branch head must rerun the dedicated G3-I5 workflow and require:

```text
Integration certified gates: 6
Integration next gate: none — final closure certified
INTEGRATION_G3_CERTIFICATION_LEDGER_PASS
INTEGRATION_G3_I5_CERTIFICATION_PASS
```

Protected predecessor regressions must remain green on that same final head.

After exact-head seal succeeds, G3 is terminally certified. PR #33 remains draft/open/unmerged until explicit owner authorization.
