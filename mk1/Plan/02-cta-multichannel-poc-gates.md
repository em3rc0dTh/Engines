# G3 — CTA Multi-Channel Proof Plan

## Status

**WEBCHAT HARDENED — TELEGRAM NEXT — NO AGENT / NO MCP**

```text
C0A Workflow-view projection             ✅ CERTIFIED
C1A Workflow-visible HTML WebChat         ✅ CERTIFIED + HUMAN VERIFIED POST-FIX
C0B/C1B Durable channel semantics         ✅ CERTIFIED
C2 Telegram bot / long polling            🔧 NEXT
C3 Telegram webhook parity                ⏭ OPTIONAL FOLLOW-UP
C4 WhatsApp                               ⏭ LATER
C5 Cross-channel Golden                   ⏭ LATER
```

C1A receipt: [`../Build/evidence/c1a-webchat-workflow-visibility-certification-2026-09-01.md`](../Build/evidence/c1a-webchat-workflow-visibility-certification-2026-09-01.md)

C1B receipt: [`../Build/evidence/c1b-durable-channel-certification-2026-09-02.md`](../Build/evidence/c1b-durable-channel-certification-2026-09-02.md)

## Phase boundary

Forbidden in the current WebChat/Telegram track:

```text
Agent
MCP
LLM orchestration
semantic AI routing
AI-owned intent selection
AI-owned business decisions
```

The same explicit operation and Temporal Workflow model used by the CLI remains authoritative.

## Architecture now proven through WebChat

```text
CLI / WebChat / Telegram / later transport
              │
              ▼
        Channel Adapter
              │
              ▼
   CanonicalChannelEnvelope
              │
              ▼
      ChannelExecutionCore
              │
       ┌──────┴────────┐
       ▼               ▼
PostgreSQL          Temporal
binding/event       Workflow authority
correlation             │
                        ▼
                 same Workflow Library
```

Provider distinctions terminate at adapter/renderer boundaries. Customer, Services, Scheduler and Workflow policy do not branch on provider identity.

## C0A — provider-independent Workflow view ✅

The durable Appointment state is projected into the engineering execution map:

```text
01 Start Workflow
02 Customer name
03 Customer email
04 Customer phone
05 Resolve Customer
06 Select Service
07 Select Offering / Product
08 Set Date
09 Load Available Slots
10 Select Slot
11 Finalize Appointment
12 Appointment Created
```

`phase` and `nextAction` remain the real Temporal state. Human data-capture checkpoints are not synthetic Temporal phases.

## C0B/C1B — canonical transport durability ✅

Implemented and certified:

```text
CanonicalChannelEnvelope
ChannelAdapter interface / registry
WebChatAdapter
server-side ChannelConversationBinding
server-side ChannelInboundEvent identity/fingerprint
same-event replay semantics
same-identity/different-material conflict semantics
stable transport event -> Temporal idempotencyKey/inputId mapping
PostgreSQL restart-safe correlation
```

PostgreSQL operational tables:

```text
channel_conversation_bindings
channel_inbound_events
```

Certified C1B authority:

```text
Source SHA       2008fce4f863fdabf8e8f323eee1d7cda05cb454
Run              33647842017
Job              100307008849
Artifact         9853555059
Artifact SHA256  efa65255fdc4c8569f55cefd38202145d2feb5a275d1c897f4b58dbb10a023bf
```

The run proved exact start/update replay, typed material conflict with unchanged Workflow state, physical WebChat process restart (`7982 → 8190`), durable binding recovery, terminal Appointment completion, terminal event replay, and the full C1A visibility regression.

## C1 — WebChat ✅ HARDENED FOR CURRENT POC BOUNDARY

The minimal surface remains:

```text
/webchat/
/webchat/workflow.html?workflowId=<id>
```

C1A gives the visible deterministic interaction. C1B gives durable transport correlation/replay semantics beneath it.

The browser may retain an external conversation ID for convenience, but PostgreSQL—not local storage—owns the `externalConversationId → workflowId` correlation.

Current bounded WebChat claim:

> WebChat can drive the explicit Appointment Workflow, expose its real durable state, recover correlation across adapter restart, and safely handle at-least-once inbound event replay/conflict semantics.

This is not a production-webchat claim.

## C2 — Telegram Bot PoC 🔧 NEXT

Telegram must **reuse** the certified C1B architecture.

Initial ingress:

```text
Telegram Bot API
      ↓
long polling
      ↓
TelegramAdapter
      ↓
CanonicalChannelEnvelope
      ↓
existing ChannelExecutionCore
      ↓
existing PostgreSQL binding/event ledger
      ↓
existing Temporal Workflow Library
```

Telegram-specific responsibilities are limited to transport normalization/rendering:

```text
update_id / message identity
chat identity
sender identity
text payload
callback/button payload
later media metadata when needed
outbound Bot API rendering
```

The Telegram adapter must map these into the existing canonical contract. It must not define new Appointment phases or provider-specific business operations.

### C2 required proof

```text
Bot starts one real Appointment Workflow
chat -> Workflow binding persists in PostgreSQL
same update/message identity exact replay is harmless
same identity + different material conflicts
bot process restart recovers same conversation/Workflow
text input maps to existing explicit operations
callback buttons map to existing explicit operations
complete Appointment reaches CREATED
HTML Workflow Inspector observes the same Telegram-driven Workflow
C1B WebChat regression stays green
Agent=false
MCP=false
```

Initial C2 transport is long polling because it allows a real Telegram proof without requiring public webhook exposure. Webhook parity remains a later transport-delivery proof.

## C3 — Telegram webhook parity

Optional after C2. Replace ingress delivery only:

```text
long polling -> webhook
```

Required invariant:

```text
same TelegramAdapter canonical output
same ChannelExecutionCore
same PostgreSQL correlation semantics
same Temporal Workflow
same business result
```

## C4 — WhatsApp later

WhatsApp remains deferred. No paid provider or specific API mechanism is frozen now. A future chosen transport must conform to the same adapter/canonical channel contract rather than drive a business redesign.

## C5 — cross-channel Golden proof

Later, freeze one scenario and execute equivalent canonical interaction through:

```text
CLI
WebChat
Telegram
future WhatsApp
```

Compare:

```text
Temporal Workflow state/history
PostgreSQL business truth
PostgreSQL channel correlation/event truth
Mongo semantic audit
AttachmentStore refs when applicable
terminal business result
```

The verdict is semantic equivalence, not screenshot equivalence.

## Stop conditions

Stop and redesign if:

- Telegram requires a separate business Workflow implementation;
- an adapter writes Customer/Services/Scheduler/Appointment rows directly;
- bot process memory becomes the sole conversation authority;
- a duplicate inbound event can create a second logical business effect;
- provider metadata becomes business policy merely because of transport;
- the renderer becomes a second durable phase engine;
- Agent, MCP or LLM routing appears in the current channel phase.

## Execution sequence

```text
G1 Services work continues independently.

G3:
  C0A Workflow projection                 ✅
  C1A visible WebChat                     ✅
  C0B/C1B durable correlation/dedupe       ✅
  C2 Telegram long-polling bot             🔧 NEXT
  C3 Telegram webhook parity               ⏭ optional
  C4 WhatsApp                              ⏭ later
  C5 cross-channel Golden                  ⏭ later
```
