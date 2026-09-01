# CTA Channel Adapter Contract — CLI-Compatible Multi-Channel Boundary

## Status

**DESIGN CANDIDATE — NO AGENT / NO MCP / CHANNEL RUNTIME NOT YET CERTIFIED**

This contract extends the same CTA → Temporal interaction model already exercised through the CLI. WebChat and Telegram must be transport/rendering adapters over that existing orchestration path, not new business engines.

## Architectural rule

```text
raw channel event
→ provider adapter
→ CanonicalChannelEnvelope
→ CTA core
→ explicit canonical orchestration operation
→ Temporal
→ Workflow Library
```

Outbound:

```text
Temporal query/update/result
→ CanonicalChannelResponse
→ channel renderer
→ user
```

The adapter layer owns transport differences. Temporal and the Workflow Library own durable orchestration. Services/Scheduler/Persistence own their respective business authorities.

## Explicitly excluded from this phase

```text
Agent
LLM
MCP
semantic AI router
AI intent classification
AI-selected tools
AI-owned business policy
```

The operation submitted to Temporal remains explicit and deterministic, as with the CLI.

## Channel adapter interface

The preferred implementation is composition through one stable interface and a registry/binding layer.

Conceptual contract:

```text
ChannelAdapter
  channel
  normalizeInbound(rawEvent, trustedRoute) -> CanonicalChannelEnvelope
  renderOutbound(response)                 -> provider payload
  fetchAttachment?(reference)              -> byte stream + metadata
```

Registration:

```text
ChannelAdapterRegistry
  WEBCHAT  -> WebChatAdapter
  TELEGRAM -> TelegramAdapter
  WHATSAPP -> future adapter
```

The CTA core asks the registry for an adapter by the already-resolved transport binding and then works only with canonical contracts. Provider branching does not belong in Workflows, Services, Scheduler or Customer logic.

## Canonical inbound contract

```text
CanonicalChannelEnvelope
  version                 "v1"
  channel                 WEBCHAT | TELEGRAM | WHATSAPP
  businessSlug            string
  externalConversationId  string
  externalMessageId       string
  externalSenderId        string
  receivedAt              ISO timestamp
  message
    kind                   TEXT | CHOICE | ATTACHMENT | COMPOSITE
    text?                  string
    choiceId?              string
    attachments[]
      externalAttachmentId string
      mediaType?           string
      fileName?            string
      sizeBytes?           integer
  locale?                  string
  replyToExternalMessageId? string
  metadata                 bounded transport metadata
```

Constraints:

- `businessSlug` is derived from trusted route/configuration, never accepted blindly from user text;
- provider credentials/secrets never enter the canonical envelope;
- provider raw payload is observability material, not business truth;
- canonical messages contain transport meaning, not provider-specific business rules.

## Canonical outbound contract

```text
CanonicalChannelResponse
  workflowId
  phase
  message
    text
    choices[]
      id
      label
  attachments[]
  terminal
  result?
  correlation
```

Rendering examples:

```text
WebChat  -> HTML text/buttons/forms
Telegram -> Bot API text + inline keyboard/callback data
WhatsApp -> future transport-specific renderer
```

A renderer may change presentation. It may not change which choices are legal.

## Canonical orchestration port

All adapters converge on the same CTA orchestration surface:

```text
start(operation, businessScope, correlation, initialInput)
update(workflowId, canonicalUpdate)
query(workflowId)
```

This is intentionally analogous to the CLI path. The channel adapter does not know or reproduce the internal Workflow phase machine.

## Durable event identity

Channel delivery is treated as at-least-once.

```text
providerEventIdentity =
  hash(channel + businessSlug + externalMessageId)
```

Required semantics:

```text
same identity + same normalized material
→ reuse / no second Workflow effect

same identity + different normalized material
→ transport conflict
→ no Workflow mutation
```

The dedupe ledger must be durable, not process memory.

## Durable conversation correlation

```text
ChannelConversationBinding
  businessSlug
  channel
  externalConversationId
  workflowId
  operation
  bindingStatus
  createdAt
  updatedAt
```

A WebChat page refresh, WebChat adapter restart or Telegram bot restart must not destroy the active Workflow binding.

PostgreSQL remains the leading candidate for this canonical operational correlation state because uniqueness, idempotency and recovery matter. Mongo may retain evidence but should not be the sole active-binding authority.

## WebChat adapter

C1 remains deliberately minimal:

```text
static HTML/CSS/JS
→ small HTTP CTA endpoint
→ CanonicalChannelEnvelope
→ existing Temporal path
```

The browser owns presentation state only. Durable phase, collected data and legal next actions come from the server/Workflow.

Polling or SSE is acceptable. WebSockets are optional.

## Telegram adapter

C2 uses the Telegram Bot API as an external transport over the same contract.

Initial ingress:

```text
getUpdates / long polling
```

Normalized concerns:

```text
update/message identity
chat identity
sender identity
text
callback_query.data
media references
reply correlation
```

Later webhook ingress may replace polling while preserving the same `TelegramAdapter -> CanonicalChannelEnvelope` output and the same Temporal interaction.

## WhatsApp boundary

WhatsApp is intentionally deferred until WebChat and Telegram prove the architecture. No provider or paid API decision is frozen in C0–C2.

When implemented later, the chosen WhatsApp transport must conform to the same adapter interface and canonical contracts. The provider decision must not require a new business Workflow family.

## Attachments

```text
provider/channel attachment reference
→ adapter-authorized fetch
→ CTA size/type checks
→ AttachmentStore.stage
→ immutable staged reference
→ Workflow update
```

Transport URLs are temporary locators, never durable business-document truth.

## Failure separation

Inbound transport failure:

```text
no canonical event
→ no business mutation
```

Outbound delivery failure after a successful Temporal/business operation:

```text
business result remains committed
transport delivery is retried/reconciled separately
```

A transport retry must not blindly replay the business command.

## Core equivalence invariant

For the same canonical sequence:

```text
CLI
WebChat
Telegram
future WhatsApp
```

must reach equivalent Workflow phases and business outcomes, modulo transport metadata and rendering.

Certification compares Temporal state/history, PostgreSQL truth, Mongo audit, AttachmentStore references and channel correlation evidence—not merely UI screenshots.
