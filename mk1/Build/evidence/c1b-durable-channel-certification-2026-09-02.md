# C1B — Durable Channel Semantics Certification Receipt — 2026-09-02

## Verdict

**✅ CERTIFIED — BOUNDED C1B CLAIM**

C1B certifies durable WebChat conversation binding and inbound-event replay/conflict semantics across a real adapter-process restart while preserving the explicit CTA → Temporal Appointment Workflow and C1A visibility model.

## Certification authority

```text
Branch        build/mk1-c1b-durable-channel
Source SHA    2008fce4f863fdabf8e8f323eee1d7cda05cb454
Run           33647842017
Job           100307008849
Result        SUCCESS
Artifact      9853555059
Artifact SHA  efa65255fdc4c8569f55cefd38202145d2feb5a275d1c897f4b58dbb10a023bf
```

The documentation commits written after this successful run are evidence indexing only. They are not the executed runtime source revision.

## Certified architecture

```text
WebChat browser
      ↓
WebChatAdapter
      ↓
CanonicalChannelEnvelope
      ↓
ChannelExecutionCore
      ↓
PostgreSQL channel correlation ledger
      ↓
existing Temporal Appointment operation identity
      ↓
RegisterNewAppointment Workflow
```

Provider composition is adapter/registry based. Appointment, Customer, Services, Scheduler and Workflow policy do not select behavior by provider.

## Certified persistence boundary

PostgreSQL now contains durable channel operational truth:

```text
channel_conversation_bindings
channel_inbound_events
```

`channel_conversation_bindings` owns the restart-safe external-conversation → Workflow correlation.

`channel_inbound_events` owns transport-event identity, canonical material fingerprint, processing/terminal status, terminal response and rejection code.

These tables do not become shadow Appointment business truth. Temporal remains orchestration authority; canonical Appointment persistence remains in the inherited business boundary.

## Certified replay/conflict semantics

```text
same business + channel + externalMessageId
+ same canonical material
→ exact replay
→ one logical Workflow operation

same business + channel + externalMessageId
+ different canonical material
→ CHANNEL_EVENT_IDENTITY_CONFLICT
→ zero conflicting Workflow mutation
```

Canonical event identity is propagated into the existing Appointment `idempotencyKey` or `inputId`, so transport retry composes with the already-certified Temporal/Workflow logical-operation identity rather than replacing it.

## Restart evidence

The run physically replaced the WebChat adapter process:

```text
PID before  7982
PID after   8190
```

The same external conversation then recovered the same active Workflow through PostgreSQL-backed binding lookup and continued to terminal completion.

## Runtime markers

```text
WEBCHAT_C1B_PRE_RESTART_PASS
WEBCHAT_C1B_DURABLE_CHANNEL_PASS
WEBCHAT_C1_WORKFLOW_VISIBILITY_PASS
```

The C1B terminal marker reported:

```text
finalPhase=CREATED
workflowStatus=COMPLETED
allVisibleStepsComplete=true
bindingRecoveredAfterAdapterRestart=true
exactStartReplay=true
exactUpdateReplay=true
materialConflictRejected=true
conflictMutationFree=true
terminalReplayFromDurableLedger=true
agent=false
mcp=false
```

The inherited C1A regression also reached `CREATED` with all 12 visible Workflow checkpoints `COMPLETE`.

## Regression scope

Successful source `2008fce4...` passed:

```text
strict TypeScript typecheck
C0 Workflow-view tests
C1B canonical identity/adapter tests
RegisterNewCustomer regression
CLI CTA regression
Appointment contract regression
clean Docker Compose startup
PostgreSQL channel migration
Temporal Worker readiness
CTA health
channel-core health
hardened WebChat health
pre-restart replay/conflict probe
physical WebChat adapter restart
post-restart binding recovery + full Appointment completion
C1A full workflow-visible WebChat regression
evidence capture and upload
```

## Evidence artifact contents

Artifact `9853555059` includes the executed source SHA and runtime evidence such as:

```text
c1b prepare marker/output
c1b complete marker/output
C1A regression output
WebChat restart PID record
WebChat logs before/after restart
channel-core health/log
WebChat health
Compose process state
Worker log
PostgreSQL channel_conversation_bindings projection
PostgreSQL channel_inbound_events projection
```

Digest:

```text
sha256:efa65255fdc4c8569f55cefd38202145d2feb5a275d1c897f4b58dbb10a023bf
```

## Failure provenance

Initial attempt:

```text
Run           33647731151
Source SHA    9cedded6ca7ebd3e0d5ddd12468a358784573089
Result        FAILURE
Failure stage strict TypeScript typecheck
Cause         exactOptionalPropertyTypes replay-response fallback mismatch
Artifact      9853467649
Artifact SHA  b663d43180b259ea1bd565b57f025884599dd63dbb9337401e37f1f32e91120e
```

That run did not reach runtime execution. The source was corrected without weakening channel, Temporal, persistence or business invariants. Successful run `33647842017` is the certification authority.

## Bounded certified statement

> Engines can durably correlate a WebChat external conversation to one Temporal Appointment Workflow and safely process at-least-once inbound events across exact replay, same-identity/different-material conflict, and WebChat adapter-process restart, while retaining the workflow-visible C1A interaction and terminal Appointment creation.

## Explicit non-claims

This receipt does **not** certify:

```text
Telegram
WhatsApp
full G3 multi-channel equivalence
full Services Engine / G1 closure
Scheduler Engine
production authentication/security
internet exposure
Agent
MCP
LLM orchestration
semantic intent routing
```

## Next channel gate

With C1B certified, the next bounded channel proof is **C2 Telegram**, using the same canonical channel contract, registry, durable event/binding semantics and Temporal Workflow library. Telegram transport mechanics must not redefine the business flow.
