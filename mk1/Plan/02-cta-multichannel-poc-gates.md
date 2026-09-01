# G3 — CTA Multi-Channel Proof Plan

## Status

**WEBCHAT FIRST / TELEGRAM SECOND — NO AGENT / NO MCP**

The channel track extends the already-proven CLI-style CTA → Temporal interaction into additional transports. It does not introduce an Intelligence Layer.

Current bounded result:

```text
C0A Workflow-view projection             ✅ CERTIFIED
C1A Workflow-visible HTML WebChat         ✅ CERTIFIED
C1B Durable channel semantics             🔧 NEXT CHANNEL HARDENING
C2  Telegram bot                          ⏭ AFTER C1B
C3  Telegram webhook parity               ⏭ OPTIONAL FOLLOW-UP
C4  WhatsApp                              ⏭ LATER
```

C1A receipt: [`../Build/evidence/c1a-webchat-workflow-visibility-certification-2026-09-01.md`](../Build/evidence/c1a-webchat-workflow-visibility-certification-2026-09-01.md)

## Phase boundary

Forbidden in the current WebChat/Telegram track:

```text
Agent
LLM orchestration
MCP
semantic AI routing
AI-owned intent selection
AI-owned business decisions
```

The same explicit operation and Temporal Workflow model used by the CLI remains authoritative.

## Goal

```text
CLI
WebChat
Telegram
later WhatsApp
   │
   ▼
Channel Adapter / CTA transport boundary
   │
   ▼
canonical explicit operation
   │
   ▼
Temporal
   │
   ▼
same Workflow Library
```

Channel adapters own transport normalization and rendering. Provider distinctions do not become business Workflow branches.

## C0 — canonical channel foundation

C0 is intentionally separated into the parts already proven and the transport-durability work still open.

### C0A — provider-independent Workflow view ✅ CERTIFIED

Implemented in:

```text
src/cta/channel-core/appointment-workflow-view.ts
```

It converts the durable `AppointmentStateProjection` into a human-readable execution view while preserving the real Temporal `phase` and `nextAction`.

Visible checkpoints:

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

The Customer data rows are presentation checkpoints derived from the durable draft; they are not synthetic Temporal phases.

C0A is provider-independent and is intended to be reused by WebChat, Telegram, and later renderers.

### C0B — canonical transport durability 🔧 OPEN

Before a channel is considered fully hardened, freeze and implement:

```text
CanonicalChannelEnvelope
CanonicalChannelResponse
ChannelAdapter interface / registry
server-side ChannelConversationBinding
server-side ChannelInboundEvent identity/fingerprint
same-event replay semantics
same-identity/different-material conflict semantics
trusted business routing
attachment staging contract
secret/redaction policy
```

Likely PostgreSQL operational authority:

```text
channel_conversation_bindings
channel_inbound_events
```

Mongo may retain semantic/transport evidence but must not be the sole active-binding authority.

## C1 — WebChat

### C1A — workflow-visible WebChat ✅ CERTIFIED

Branch:

```text
build/mk1-c0-c1-webchat
```

Implemented surface:

```text
/webchat/
  minimal HTML/CSS/JS conversational UI

/webchat/workflow.html?workflowId=<id>
  separate live Workflow inspector
```

Runtime path:

```text
Browser
→ minimal WebChat transport server
→ existing canonical CTA HTTP surface
→ Temporal
→ RegisterNewAppointment
```

C1A proves:

```text
real Workflow start from WebChat transport
multi-turn Customer capture
Customer resolution
Service selection
Offering selection
human date input
slot selection
explicit finalization
CREATED terminal result
real phase + nextAction always projected
all 12 visible execution steps reach COMPLETE
no Agent
no MCP
```

Certification:

```text
Source SHA       860629e9ada498e225ae803a9fe6f077949ec320
Run              33542468975
Job              99971830150
Artifact         9814172765
Artifact SHA256  a12fa1b0283524948d5fa0d253953c5588ba2692a5cc0bbee93ded65265656f3
Marker           WEBCHAT_C1_WORKFLOW_VISIBILITY_PASS
```

C1A is now suitable for manual visual testing.

### C1B — durable WebChat channel semantics 🔧 OPEN

C1 is not fully closed until the transport itself proves restart-safe correlation and delivery idempotency.

Required proof:

```text
server-side durable conversation binding
browser refresh/reconnect using server-side binding
adapter process restart without losing Workflow correlation
duplicate browser event same material -> one canonical effect
duplicate identity different material -> transport conflict
no second Temporal Update/business effect
transport evidence ledger
```

The current C1A browser can resume a known `workflowId` via URL/local browser storage. That is useful for the visual PoC but is not sufficient evidence for C1B.

## C2 — Telegram Bot PoC

Telegram is the second runtime channel proof and must reuse the provider-independent C0 contracts.

Initial ingress:

```text
Telegram Bot API long polling
→ TelegramAdapter
→ canonical CTA operation
→ Temporal
→ same Workflow family
```

Required proof:

```text
durable update/message identity dedupe
chat/conversation -> Workflow binding
text normalization
callback/button normalization
bot process restart/recovery
same Appointment interaction semantics already proven in WebChat
same provider-independent Workflow view for engineering observation
no provider-specific business Workflow branch
```

A Telegram conversation should be observable from the same HTML Workflow inspector by `workflowId`; the inspector follows the Temporal Workflow, not the provider.

## C3 — Telegram webhook parity

Optional after C2. Replace ingress delivery only:

```text
long polling -> webhook
```

Required invariant:

```text
same Telegram adapter canonical output
same CTA core
same Temporal Workflow
same business result
```

No Services, Scheduler, Customer, or Workflow rewrite is permitted for the ingress switch.

## C4 — WhatsApp later

WhatsApp remains deferred. No paid-provider or specific API assumption is frozen during C0–C2.

Future requirement:

```text
chosen WhatsApp transport
→ adapter conforming to the same canonical contract
→ same CTA core
→ same Temporal Workflow Library
```

Provider mechanics remain adapter concerns.

## C5 — cross-channel Golden proof

Once the relevant engine semantics exist, freeze one scenario and execute equivalent canonical interaction through:

```text
CLI
WebChat
Telegram
future WhatsApp
```

Candidate end-state:

```text
RegisterNewAppointment
→ Customer resolution
→ Services read/recommendation
→ Offering selection
→ Scheduler availability
→ Slot selection
→ explicit finalize
→ Appointment persisted
```

Compare:

```text
Temporal Workflow state/history
PostgreSQL business truth
Mongo semantic audit
AttachmentStore refs when applicable
channel correlation/dedupe ledger
```

The verdict is based on equivalent business semantics, not equivalent screenshots.

## Composition rule

Provider adapters are implementations behind one stable boundary. Provider-specific normalization/rendering stops before business orchestration.

```text
WebChatAdapter  ─┐
TelegramAdapter ─┼─> ChannelAdapter contract -> CTA core -> Temporal
Future adapter  ─┘
```

Services, Scheduler, Customer logic, and Workflow phase definitions remain unaware of provider mechanics.

## Stop conditions

Stop and redesign when:

- a new channel requires a separate business Workflow implementation;
- an adapter writes Customer/Services/Scheduler/Appointment rows directly;
- browser or bot process memory is the only conversation authority after C1B;
- a duplicate inbound event can create a second business effect;
- provider metadata leaks into business policy merely because of the transport;
- the frontend becomes a second durable Workflow state machine;
- Agent, MCP, or LLM routing appears in the WebChat/Telegram phase.

## Execution sequence

```text
G1 Services work continues on its own certification line.

G3 channel line:
  C0A provider-independent Workflow view       ✅
  C1A minimal workflow-visible WebChat          ✅
  C0B/C1B durable correlation + event dedupe    🔧
  C2 Telegram bot / long polling                ⏭
  C3 Telegram webhook parity                    ⏭ optional
  C4 WhatsApp                                   ⏭ later
  C5 cross-channel Golden                       ⏭ later
```

S4/S5 Services evidence remains separate and frozen; channel work has its own branch, tests, artifacts, and receipts.
