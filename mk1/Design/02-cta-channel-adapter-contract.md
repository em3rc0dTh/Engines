# CTA Channel Adapter Contract — WebChat / Telegram / WhatsApp PoC

## Status

**DESIGN CANDIDATE — NOT IMPLEMENTED / NOT CERTIFIED**

This design refines the parallel brainstorming in `../Brainstorming/03-cta-telegram-whatsapp-webchat-poc.md`. It does not change the current S4 Services certification claim and must not be read as channel support.

## Design goal

A channel adapter is a replaceable transport boundary. WebChat, Telegram and WhatsApp must converge on one canonical CTA contract and then call the same orchestration port. No adapter may become a second Workflow Library.

```text
provider payload
    ↓
channel authenticity / transport validation
    ↓
provider-specific normalization
    ↓
CanonicalChannelEnvelope
    ↓
CTA correlation + duplicate guard
    ↓
canonical orchestration operation
    ↓
Temporal
```

The inverse path is:

```text
Temporal query/update/result
    ↓
CanonicalChannelResponse
    ↓
provider renderer
    ↓
WebChat / Telegram / WhatsApp
```

## Canonical inbound contract

Candidate TypeScript-neutral shape:

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
  metadata                 provider-safe transport metadata
```

Constraints:

- `businessSlug` must be resolved from trusted adapter configuration/routing, not accepted blindly from an end-user message;
- provider secrets/tokens are never copied into the envelope;
- transport metadata is not business truth;
- provider-specific raw payloads may be retained only in a bounded observability/audit surface if required, not injected into Workflow policy.

## Canonical event identity

The platform must assume at-least-once provider delivery.

```text
providerEventIdentity =
  channel + businessSlug + externalMessageId
```

The durable duplicate guard should store a normalized hash/identity rather than rely on an in-memory Set.

Required semantics:

```text
same provider event + same material
→ replay/reuse
→ no second Temporal Update effect

same provider event identity + different material
→ transport conflict
→ do not mutate Workflow
```

## Conversation correlation

The adapter needs a durable mapping:

```text
ChannelConversationBinding
  businessSlug
  channel
  externalConversationId
  workflowId
  workflowType/operation
  bindingStatus
  createdAt
  updatedAt
```

The exact persistence home remains a G3 decision. PostgreSQL is the likely canonical mapping authority because this is operational correlation state with uniqueness/idempotency requirements. Mongo can retain evidence but must not become the only binding truth.

A process restart must not lose the ability to continue an active conversation.

## Canonical orchestration operation

The adapter must not know the internal steps of a business Workflow. It should invoke a stable CTA orchestration surface such as:

```text
start(operation, businessScope, correlation, initialInput)
update(workflowId, canonicalUpdate)
query(workflowId)
```

A future deterministic router can resolve an explicit canonical operation. Natural-language intent inference, when Agent capability eventually exists, remains upstream of the same operation boundary and cannot bypass it.

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

Provider renderers convert this representation into:

```text
WebChat  -> buttons/cards/text
Telegram -> text + inline keyboard/callback_data
WhatsApp -> text + interactive button/list payload when supported
```

Provider rendering must not change which business choices are legal.

## Attachments

Channel media ingress follows the existing binary authority boundary:

```text
provider media reference
→ authenticated provider fetch
→ CTA size/type checks
→ AttachmentStore.stage
→ immutable staged reference + integrity metadata
→ Workflow Update
→ normal AttachmentStore commit lifecycle
```

Provider URLs are transient transport locators and must never become durable business-document truth.

## WebChat adapter boundary

The PoC WebChat should deliberately be small:

```text
static browser client
HTTP/SSE or HTTP/polling
CTA WebChat endpoint
canonical envelope
```

Avoid adding a frontend state machine that reconstructs Workflow phases independently. The browser renders server/Workflow state; it does not own it.

## Telegram adapter boundary

Initial laboratory ingress:

```text
Bot API getUpdates / long polling
```

Later ingress:

```text
Telegram webhook
```

Both must produce the same `CanonicalChannelEnvelope`.

Normalization targets:

- `update_id` / message identity;
- chat identity;
- sender identity;
- text;
- `callback_query.data` as canonical choice input;
- document/photo media staging;
- provider retry/duplicate handling.

The polling-to-webhook switch must require no Workflow change.

## WhatsApp adapter boundary

Target production-shaped proof: official WhatsApp Business/Cloud API style webhook adapter.

Responsibilities:

- webhook authenticity/verification according to provider requirements;
- message/conversation/sender normalization;
- text and supported interactive replies;
- media retrieval through provider-authorized transport;
- delivery/status events classified separately from inbound user intent;
- outbound response rendering.

Delivery/read receipts must not be mistaken for business Workflow updates.

## Security boundary

Channel adapters must enforce:

```text
provider authenticity where available
payload size bounds
content-type/media bounds
business routing from trusted configuration
secret redaction
bounded raw-event logging
rate/abuse protection at ingress
```

Authentication of a Telegram/WhatsApp sender is not equivalent to Customer identity verification. Customer Recognition remains an Engines business capability and must be explicit.

## Failure semantics

Inbound provider outage:

```text
no inbound event
→ no business mutation
```

Outbound response failure after a successful Workflow update:

```text
business truth remains committed
outbound delivery enters retry/error handling
must not replay the business command blindly
```

This separation becomes especially important when Integration Engine is implemented.

## Cross-channel equivalence invariant

For the same canonical business input sequence:

```text
WebChat
Telegram
WhatsApp
```

must reach equivalent Workflow phases and equivalent business outcomes, modulo channel-specific transport metadata.

A G3 certification should compare:

```text
Temporal Workflow state/history
PostgreSQL business records
Mongo semantic audit
AttachmentStore references
```

not merely screenshots/messages from each provider.

## Current decision

The preferred proof path is:

```text
WebChat local controlled adapter
→ Telegram external adapter (polling)
→ Telegram webhook parity
→ WhatsApp external adapter
→ frozen cross-channel Golden scenario
```

This gives a fast local debugging surface first, then an easy external channel, then the more operationally demanding WhatsApp proof.
