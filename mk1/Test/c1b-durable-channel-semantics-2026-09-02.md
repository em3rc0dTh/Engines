# C1B — Durable Channel Semantics Verification — 2026-09-02

## Verdict

**✅ PASS — AUTOMATED C1B CERTIFICATION**

C1B proves that the WebChat transport no longer depends on browser memory or adapter-process memory as the authoritative `conversation → Workflow` binding, and that at-least-once inbound transport events are protected by durable identity/material semantics before they reach the existing Temporal Appointment operations.

This is a bounded channel proof. It does not certify Telegram, WhatsApp, production security, Scheduler, Agent, MCP, or full G3 closure.

## Executed source

```text
Branch        build/mk1-c1b-durable-channel
Source SHA    2008fce4f863fdabf8e8f323eee1d7cda05cb454
Run           33647842017
Job           100307008849
Result        SUCCESS
Artifact      9853555059
Artifact SHA  efa65255fdc4c8569f55cefd38202145d2feb5a275d1c897f4b58dbb10a023bf
```

## Tested architecture

```text
HTML WebChat
    ↓
WebChatAdapter
    ↓
CanonicalChannelEnvelope
    ↓
ChannelExecutionCore
    ↓
PostgreSQL channel binding/event ledger
    ↓
existing CTA / Temporal Appointment operations
    ↓
RegisterNewAppointment Workflow
```

Authority remained separated:

```text
Temporal     durable orchestration / Workflow state / Update execution
PostgreSQL   channel conversation binding + inbound event identity/result
Browser      presentation + external conversation convenience identity
MongoDB      existing semantic audit; not active channel binding authority
```

## Persistence verified

Migration `007_channel_adapter_durability.sql` adds:

```text
channel_conversation_bindings
channel_inbound_events
```

The certification artifact captured PostgreSQL projections for both tables after execution.

## Replay semantics

The probe explicitly submitted the same start event identity twice with identical canonical material.

Expected and observed:

```text
first START       applied
same START replay replayed=true
Workflow identity unchanged
```

It then submitted the same customer-data event identity twice with identical material.

Expected and observed:

```text
first update       applied
same update replay replayed=true
second logical Workflow update not created
```

The transport event identity is also propagated to the existing Appointment `idempotencyKey` / `inputId`, preserving safety across the crash window between Temporal success and channel-ledger terminal persistence.

## Material-conflict semantics

The same inbound message identity was then replayed with materially different customer data.

Observed:

```text
HTTP 409
CHANNEL_EVENT_IDENTITY_CONFLICT
```

The Workflow projection was queried before and after the conflicting submission. The previously accepted customer name was unchanged.

Therefore:

```text
same identity + same material      -> replay
same identity + different material -> conflict
conflicting material               -> zero Workflow mutation
```

## Adapter restart proof

The CI physically stopped and restarted the WebChat adapter process while the Appointment Workflow was still active.

```text
WebChat PID before  7982
WebChat PID after   8190
```

After restart, the certification did not recover through a cached `workflowId`. It queried the external conversation identity through the hardened WebChat/channel path, which resolved the PostgreSQL binding and returned the same Temporal Workflow.

Observed marker:

```text
bindingRecoveredAfterAdapterRestart=true
```

## Complete Appointment proof

After restart, the same durable conversation continued through:

```text
Customer email
Customer phone
Resolve Customer
Select Service
Select Offering
Set Date
Select Slot
Finalize Appointment
```

Terminal evidence:

```text
finalPhase               CREATED
workflowStatus           COMPLETED
allVisibleStepsComplete  true
issues                    []
```

The final `FINALIZE_APPOINTMENT` event was replayed once more with exactly the same inbound identity and material. The durable event ledger returned the stored result with `replayed=true` instead of creating a second terminal business effect.

## Direct runtime markers

Pre-restart:

```text
WEBCHAT_C1B_PRE_RESTART_PASS
```

with:

```text
exactStartReplay=true
exactUpdateReplay=true
materialConflictRejected=true
conflictMutationFree=true
agent=false
mcp=false
```

Post-restart terminal marker:

```text
WEBCHAT_C1B_DURABLE_CHANNEL_PASS
```

with:

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

## C1A regression retained

The same successful run executed the original workflow-visible WebChat certification probe through the hardened C1B server and produced:

```text
WEBCHAT_C1_WORKFLOW_VISIBILITY_PASS
```

All 12 visible checkpoints remained `COMPLETE` at terminal `CREATED`.

C1B therefore hardened correlation/idempotency without removing the C1A engineering visibility surface.

## Unit / contract regression

Before runtime execution:

```text
strict TypeScript typecheck            PASS
C0 + channel-core test surface         7 / 7 PASS
C1B focused tests                       5 / 5 PASS
RegisterNewCustomer regression         21 / 21 PASS
CLI CTA regression                      7 / 7 PASS
Appointment contract regression         6 / 6 PASS
```

C1B focused tests cover deterministic canonical fingerprinting, material-change detection, stable Workflow input identity, trusted WebChat normalization, and fail-closed unsupported operations.

## First-run failure provenance

The first CI attempt is retained as evidence provenance:

```text
Run       33647731151
Source    9cedded6ca7ebd3e0d5ddd12468a358784573089
Result    FAILURE
Stage     strict TypeScript typecheck
Cause     exactOptionalPropertyTypes violation in replay-response fallback
Artifact  9853467649
Digest    b663d43180b259ea1bd565b57f025884599dd63dbb9337401e37f1f32e91120e
```

No Temporal runtime or business mutation executed in that failed run. The replay response construction was made strict-optional-safe in `2008fce4f863fdabf8e8f323eee1d7cda05cb454`; no domain invariant was relaxed.

## Golden case accounting

```text
C1B-001 durable conversation binding             PASS
C1B-002 adapter restart recovery                  PASS
C1B-003 exact start replay                        PASS
C1B-004 exact update replay                       PASS
C1B-005 material identity conflict                PASS
C1B-006 conflict mutation-free                    PASS
C1B-007 duplicate transport/business safety       PASS by stable event/input identity proof
C1B-008 complete hardened Appointment             PASS
C1B-009 C1A visibility retained                   PASS
C1B-010 provider-independent execution core       PASS
C1B-011 business-scoped event identity            CONTRACT/PERSISTENCE CONSTRAINT; not separately runtime-probed in final scenario
C1B-012 durable terminal response                 PASS
```

C1B-011 remains supported by the composite PostgreSQL primary key and business-scoped repository API but is not overstated as a separate two-business runtime scenario; broader materially different multi-business proof belongs to the Services S6 track.

## Bounded claim

C1B permits the statement:

> The WebChat channel can durably correlate one external conversation to one Temporal Workflow and safely process at-least-once inbound events across exact replay, material conflict, and adapter process restart while preserving the existing workflow-visible Appointment interaction.

## Explicit non-claims

C1B does not certify:

```text
Telegram
WhatsApp
full cross-channel equivalence
production authentication/security
public internet deployment
Scheduler Engine
full Services Engine closure
Agent
MCP
LLM orchestration
semantic intent inference
```
