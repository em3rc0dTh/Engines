# C1B — Durable Channel Gate Plan

## Status

**✅ CERTIFIED — C2 TELEGRAM NEXT**

```text
C0A Workflow view               ✅ CERTIFIED
C1A WebChat workflow visibility ✅ CERTIFIED + HUMAN VERIFIED POST-FIX
C1B durable channel semantics   ✅ CERTIFIED
C2 Telegram                     🔧 NEXT CHANNEL GATE
```

Certification authority:

```text
Source SHA    2008fce4f863fdabf8e8f323eee1d7cda05cb454
Run           33647842017
Job           100307008849
Artifact      9853555059
Artifact SHA  efa65255fdc4c8569f55cefd38202145d2feb5a275d1c897f4b58dbb10a023bf
```

Receipt: [`../Build/evidence/c1b-durable-channel-certification-2026-09-02.md`](../Build/evidence/c1b-durable-channel-certification-2026-09-02.md)

Verification ledger: [`../Test/c1b-durable-channel-semantics-2026-09-02.md`](../Test/c1b-durable-channel-semantics-2026-09-02.md)

## Build completion

### B1 — contract and migration ✅

Implemented:

- canonical channel types;
- deterministic canonical material fingerprint;
- PostgreSQL `channel_conversation_bindings`;
- PostgreSQL `channel_inbound_events`;
- migration `007_channel_adapter_durability.sql`;
- Compose migration integration.

### B2 — repository semantics ✅

Implemented:

```text
claimInboundEvent
completeInboundEvent
rejectInboundEvent
getConversationBinding
bindConversation
updateBindingStatus
```

Certified semantics:

```text
same identity + same material       replay
same identity + different material  typed conflict
terminal response                   durable replay source
```

### B3 — adapter + registries ✅

Implemented:

```text
WebChatAdapter
ChannelAdapterRegistry
canonical action registry
```

Provider choice terminates at adapter/renderer composition. Appointment/Customer/Services/Scheduler/Workflow policy remains provider-independent.

### B4 — hardened channel endpoint ✅

Implemented generic channel core:

```text
POST /channel/events
GET  /channel/conversations/:externalConversationId
GET  /health
```

The channel core owns transport correlation only. Temporal remains Workflow authority.

### B5 — browser migration ✅

The C1B WebChat browser now sends explicit canonical actions through the durable channel endpoint and polls state by external conversation identity.

The browser can keep `externalConversationId` as convenience state, but `workflowId` recovery comes from PostgreSQL binding authority rather than local storage.

### B6 — certification probe ✅

The successful clean-Compose run executed:

```text
new conversation
→ start event
→ exact start replay
→ customer update
→ exact update replay
→ same event id / different material conflict
→ prove Workflow state unchanged
→ physically restart WebChat adapter process
→ recover same Workflow via durable binding
→ continue Appointment
→ finalize
→ CREATED / COMPLETED
→ replay terminal event from durable event result
→ run full C1A visibility regression
```

Physical process replacement:

```text
before PID 7982
after  PID 8190
```

Runtime markers:

```text
WEBCHAT_C1B_PRE_RESTART_PASS
WEBCHAT_C1B_DURABLE_CHANNEL_PASS
WEBCHAT_C1_WORKFLOW_VISIBILITY_PASS
```

## Golden result

```text
C1B-001 durable conversation binding          PASS
C1B-002 adapter restart recovery               PASS
C1B-003 exact start replay                     PASS
C1B-004 exact update replay                    PASS
C1B-005 material conflict                      PASS
C1B-006 conflict leaves Workflow unchanged     PASS
C1B-007 duplicate transport/business safety    PASS
C1B-008 complete Appointment via hardened path PASS
C1B-009 C1A visibility retained                PASS
C1B-010 provider-independent execution core    PASS
C1B-011 business-scoped identity               schema/contract protected; broader runtime generality deferred
C1B-012 durable terminal event response        PASS
```

## Failure provenance

First attempt:

```text
Run       33647731151
Source    9cedded6ca7ebd3e0d5ddd12468a358784573089
Result    FAILURE
Stage     strict TypeScript typecheck
Cause     exactOptionalPropertyTypes replay fallback mismatch
```

The strict-optional construction was corrected in `2008fce4...`; no runtime/domain invariant was weakened. Run `33647842017` is the sole C1B certification authority.

## Stop conditions carried forward to C2

C2 must stop and redesign if any of these appear:

```text
Telegram needs a separate Appointment business Workflow
Telegram chat memory becomes binding authority
update_id/message replay can produce a second logical Workflow update
provider-specific values enter Services/Scheduler/Appointment policy
canonical action semantics are forked for Telegram
Agent/MCP/LLM is introduced
```

## Certified claim boundary

C1B permits only:

> The WebChat channel can durably correlate one external conversation to one Temporal Workflow and safely process at-least-once inbound events across exact replay, material conflict, and adapter restart while preserving C1A Workflow visibility.

It does not certify Telegram, WhatsApp, production security, Scheduler, full G3, Agent, or MCP.

## Next — C2 Telegram

C2 must reuse, not redesign:

```text
Telegram Bot API / long polling
        ↓
TelegramAdapter
        ↓
CanonicalChannelEnvelope
        ↓
existing ChannelExecutionCore
        ↓
existing PostgreSQL binding/event semantics
        ↓
existing Temporal Workflow Library
```

The HTML Workflow Inspector remains useful as an engineering view because it follows `workflowId`, not the provider.
