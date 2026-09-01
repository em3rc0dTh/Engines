# CTA Multi-Channel PoC — WebChat → Telegram → WhatsApp

## Status

**BRAINSTORMING / ARCHITECTURE TRACK — NO AGENT, NO MCP**

This track proves channel replaceability around the same CTA → Temporal flow already proven by the CLI. It does not introduce an Agent, LLM routing, MCP tools or an alternate orchestration layer.

## Frozen phase rule

The current platform path is intentionally mechanical and explicit:

```text
Channel transport
→ Channel Adapter
→ canonical CTA operation
→ Temporal
→ existing Workflow contracts
→ Services / Scheduler / Persistence
```

The CLI remains the architectural reference. WebChat and Telegram are new transport/rendering surfaces over the same orchestration boundary.

Not part of this phase:

```text
Agent
LLM intent inference
MCP
AI tool selection
AI-owned workflow routing
AI-owned business decisions
```

Those belong to a later Intelligence Layer only after the Engines platform works correctly without them.

## Proof order

```text
1. WebChat — minimal static HTML/CSS/JS proof
2. Telegram — real bot over the same canonical adapter contract
3. WhatsApp — later, after WebChat and Telegram are certified
```

WhatsApp provider choice is deliberately **not frozen here**. No paid/API-provider assumption is required for C1 or C2. Its transport mechanism will be selected later without changing the canonical CTA/Temporal contract.

## WebChat philosophy

WebChat is not a frontend product project. The first proof should be deliberately small:

```text
index.html
styles.css
app.js
```

Its job is to render the Workflow interaction and submit canonical user actions. It must not own a second state machine.

Target path:

```text
Browser HTML
→ WebChat transport adapter
→ CanonicalChannelEnvelope
→ CTA orchestration port
→ Temporal
→ existing Workflow
→ CanonicalChannelResponse
→ Browser renderer
```

HTTP with polling or SSE is sufficient. WebSockets are optional and must not become a prerequisite for proving the architecture.

## Telegram philosophy

Telegram comes second and must behave as another renderer/transport over the same canonical interaction model.

Initial laboratory shape:

```text
Telegram Bot API long polling
→ Telegram transport adapter
→ CanonicalChannelEnvelope
→ same CTA orchestration port
→ same Temporal Workflow
```

A later webhook transport can replace polling without changing business Workflow code.

Telegram-specific responsibilities are transport concerns only:

```text
update/message identity
chat/conversation identity
sender identity
text extraction
callback/button extraction
media/file retrieval
outbound text/button rendering
provider duplicate handling
```

## No channel branching in orchestration

Channel selection must use composition/registration, not provider condition chains inside business code.

Preferred shape:

```text
ChannelAdapterRegistry
  WEBCHAT  -> WebChatAdapter
  TELEGRAM -> TelegramAdapter
  WHATSAPP -> future WhatsAppAdapter

adapter.normalizeInbound(rawProviderEvent)
        ↓
CanonicalChannelEnvelope
        ↓
CTA core
        ↓
Temporal
```

The core consumes the interface contract. Services, Scheduler and Workflows do not inspect provider names to decide business behavior.

This means no architecture such as:

```text
provider-specific Workflow
provider-specific Services rules
provider-specific Scheduler rules
provider-specific Customer logic
```

Provider differences terminate at the adapter/renderer boundary.

## Canonical inbound candidate

```text
CanonicalChannelEnvelope
  version
  channel
  businessSlug
  externalConversationId
  externalMessageId
  externalSenderId
  receivedAt
  message
    kind
    text?
    choiceId?
    attachments[]
  locale?
  metadata
```

`businessSlug` comes from trusted adapter configuration/routing, not arbitrary user input.

## Canonical outbound candidate

```text
CanonicalChannelResponse
  workflowId
  phase
  message
    text
    choices[]
  attachments[]
  terminal
  result?
  correlation
```

WebChat renders HTML controls. Telegram renders Bot API messages/buttons. A later WhatsApp adapter renders its provider-native representation. Legal business choices remain identical.

## Correlation and duplicate safety

Providers are treated as at-least-once delivery systems.

```text
ProviderEventIdentity
  businessSlug
  channel
  externalMessageId
```

```text
ChannelConversationBinding
  businessSlug
  channel
  externalConversationId
  workflowId
  operation
  status
```

Bindings and inbound-event identities must be durable so adapter restart does not lose a conversation and provider retries cannot duplicate a Temporal Update or business effect.

## Attachments

All channel media converges on the existing AttachmentStore boundary:

```text
channel media
→ adapter fetch/validation
→ AttachmentStore.stage
→ canonical attachment reference
→ Workflow update
```

No channel-specific binary storage is introduced into Customer, Appointment, Services or Scheduler tables.

## Same-flow proof

The final architecture property is:

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

The channel can change. Business authority cannot.

## Relationship to Services S4/S5

S4 remains the certified versioned Services management gate.

S5 now has successful runtime evidence for durable Service/Offering snapshots across mutable catalog revision and real Worker restart. Its formal receipt is maintained separately under `Build/evidence`.

The channel architecture documentation may evolve in parallel, but WebChat/Telegram runtime code must live in dedicated channel branches rather than being mixed into Services certification source.
