# G3 — CTA Multi-Channel Proof Plan

## Status

**DESIGN / PLAN ONLY — WEBCHAT FIRST, TELEGRAM SECOND — NO AGENT, NO MCP**

This track extends the certified CLI-style CTA → Temporal interaction into additional channels without introducing an Intelligence Layer.

## Phase boundary

The following are forbidden in G3 C0–C2:

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

Prove that materially different transports can drive one canonical Engines orchestration surface with equivalent business semantics.

```text
CLI
WebChat
Telegram
later WhatsApp
   │
   ▼
canonical CTA boundary
   │
   ▼
Temporal
   │
   ▼
same Workflow Library
```

The channel adapter owns normalization and rendering only.

## C0 — Canonical adapter contract freeze

Freeze before WebChat runtime:

- `ChannelAdapter` interface;
- adapter registry/binding model;
- `CanonicalChannelEnvelope`;
- `CanonicalChannelResponse`;
- durable conversation binding;
- durable inbound event identity/dedupe;
- attachment staging contract;
- trusted business routing;
- transport conflict semantics;
- secret/redaction rules.

Required contract evidence:

```text
same inbound event identity + same material
→ one canonical effect

same inbound event identity + different material
→ conflict / zero Workflow mutation

adapter choice
→ composition through registry/binding
→ no provider-specific business Workflow
```

## C1 — WebChat controlled PoC

WebChat is the first runtime channel proof.

Keep it intentionally simple:

```text
index.html
styles.css
app.js
```

No framework is required for the first proof.

Target path:

```text
Browser
→ WebChatAdapter
→ CanonicalChannelEnvelope
→ CTA orchestration port
→ Temporal
→ existing durable Workflow
→ CanonicalChannelResponse
→ browser renderer
```

Required proof:

- start one real Workflow from the HTML chat;
- continue that same Workflow through multiple turns;
- browser refresh does not erase durable Workflow state;
- adapter process restart does not lose conversation correlation;
- duplicate browser submission does not duplicate a Workflow/business effect;
- buttons/choices map to canonical Updates;
- browser contains no duplicate business phase engine;
- at least one terminal result is traceable through Temporal and persistence evidence.

Polling or SSE is sufficient. WebSockets are optional.

## C2 — Telegram Bot PoC

Telegram is the second runtime channel proof and must reuse C0 unchanged.

Initial transport:

```text
Telegram Bot API
→ long polling
→ TelegramAdapter
→ CanonicalChannelEnvelope
→ same CTA orchestration port
→ same Temporal Workflow family
```

Required proof:

- durable `update_id`/message dedupe;
- chat/conversation → Workflow binding;
- text normalization;
- callback/button normalization;
- bot process restart/recovery;
- same canonical interaction already proven with WebChat;
- no Services/Scheduler/Workflow provider-specific branch;
- one media path only when the chosen scenario needs AttachmentStore evidence.

## C3 — Telegram webhook parity

This is optional after C2, not a prerequisite for proving Telegram conversation semantics.

Change only ingress delivery:

```text
long polling
→ webhook
```

Required result:

```text
same TelegramAdapter canonical output
same CTA core
same Temporal Workflow
same business result
```

No Workflow or business-engine rewrite is permitted for the transport switch.

## C4 — WhatsApp later

WhatsApp is explicitly deferred until WebChat and Telegram prove the canonical contract.

The provider/transport mechanism is **not selected in this plan yet**. We do not assume a paid provider or a specific official API during C0–C2.

Future requirement:

```text
chosen WhatsApp transport
→ WhatsAppAdapter
→ same CanonicalChannelEnvelope
→ same CTA core
→ same Temporal Workflow Library
```

Provider mechanics belong to the adapter. They cannot redefine Customer, Services, Scheduler or Workflow semantics.

## C5 — Cross-channel Golden proof

Once the required engines exist, freeze one scenario and replay equivalent canonical interaction through:

```text
CLI
WebChat
Telegram
future WhatsApp
```

Candidate end-state scenario:

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

Compare evidence:

```text
Temporal Workflow state/history
PostgreSQL business truth
Mongo semantic audit
AttachmentStore references when applicable
channel correlation/dedupe ledger
```

The verdict is based on business-semantic equivalence, not visual similarity.

## Implementation rule — no provider condition chains

The channel architecture must be composition-based:

```text
ChannelAdapterRegistry
  WEBCHAT  -> WebChatAdapter
  TELEGRAM -> TelegramAdapter
  WHATSAPP -> future adapter
```

The CTA core consumes the adapter interface and canonical contracts. Provider-specific switching does not enter Services, Scheduler, Customer logic or Workflow phase definitions.

## Persistence model to design in C0

Likely canonical operational tables:

```text
channel_conversation_bindings
channel_inbound_events
```

They must provide:

```text
business scope
channel identity
external conversation identity
Workflow binding
normalized event fingerprint
idempotency/replay state
created/updated timestamps
```

PostgreSQL is the preferred authority candidate because active correlation requires uniqueness and restart safety. Mongo may retain semantic/transport evidence.

## Stop conditions

Stop and redesign when any of these appear:

- WebChat or Telegram requires a separate business Workflow implementation;
- adapter code writes Customer/Services/Scheduler/Appointment rows directly;
- browser or bot process memory is the only conversation authority;
- duplicate inbound transport event can cause a second business effect;
- provider-specific values become Services/Scheduler policy inputs merely because of the transport;
- WebChat frontend reconstructs a second durable state machine;
- Agent, MCP or LLM routing is introduced into C0–C2.

## Execution sequence

```text
G1 Services certification work continues independently

G3 channel proof:
  C0 canonical adapter contract
  C1 minimal HTML WebChat
  C2 Telegram bot / long polling
  C3 Telegram webhook parity (optional follow-up)
  C4 WhatsApp later
  C5 cross-channel Golden certification later
```

S4 and S5 certification evidence remain documented under the Services build ledger; channel work receives dedicated branches and evidence rather than being mixed into those source gates.
