# C1B — Durable Channel Contract

## Status

**IMPLEMENTATION CONTRACT — WEBCHAT DURABILITY — TELEGRAM REUSE TARGET — NO AGENT / NO MCP**

## Scope

C1B hardens the channel boundary introduced by C1A. It makes channel conversation correlation and inbound-event idempotency durable without changing Appointment business semantics.

## Canonical contracts

```ts
ChannelKind = 'WEBCHAT' | 'TELEGRAM' | 'WHATSAPP'

CanonicalChannelAction =
  | START_APPOINTMENT
  | PROVIDE_CUSTOMER
  | RESOLVE_CUSTOMER
  | SELECT_SERVICE
  | SELECT_OFFERING
  | SET_DATE
  | SELECT_SLOT
  | FINALIZE_APPOINTMENT

CanonicalChannelEnvelope {
  version: 'v1'
  channel: ChannelKind
  businessSlug: string
  externalConversationId: string
  externalMessageId: string
  externalSenderId: string
  action: CanonicalChannelAction
  payload: object
}
```

The canonical contract contains transport meaning plus an explicit operation. It does not contain an inferred intent.

## Adapter contract

```ts
interface ChannelAdapter<RawInbound> {
  readonly channel: ChannelKind
  normalizeInbound(raw: RawInbound, route: TrustedChannelRoute): CanonicalChannelEnvelope
}
```

Adapter resolution is registry-based. Provider identity does not enter business Workflow logic.

## Durable PostgreSQL model

### channel_conversation_bindings

```text
business_slug               text
channel                     text
external_conversation_id    text
workflow_id                 text
operation                   text
binding_status              ACTIVE | COMPLETED | FAILED
created_at
updated_at

PK (business_slug, channel, external_conversation_id)
UNIQUE (business_slug, channel, workflow_id)
```

### channel_inbound_events

```text
business_slug
channel
external_message_id
external_conversation_id
material_hash
status                      PROCESSING | APPLIED | REJECTED
response_json               jsonb nullable
error_code                  text nullable
created_at
updated_at

PK (business_slug, channel, external_message_id)
```

## Event identity and fingerprint

Identity:

```text
businessSlug + channel + externalMessageId
```

Material fingerprint:

```text
SHA-256(canonicalJson({
  version,
  channel,
  businessSlug,
  externalConversationId,
  externalSenderId,
  action,
  payload
}))
```

`receivedAt` and other retry-varying metadata are intentionally excluded from material identity.

## Claim semantics

Repository operation `claimInboundEvent(envelope)` returns one of:

```text
CLAIMED
REPLAY_APPLIED
REPLAY_REJECTED
RESUME_PROCESSING
```

or throws:

```text
CHANNEL_EVENT_IDENTITY_CONFLICT
```

Rules:

```text
new identity
→ INSERT PROCESSING
→ CLAIMED

same identity + different hash
→ conflict

same identity + same hash + APPLIED/REJECTED
→ return durable terminal response

same identity + same hash + PROCESSING
→ RESUME_PROCESSING
```

`RESUME_PROCESSING` is safe because the same event identity is propagated into the existing Temporal start/update idempotency boundary.

## Channel event → Workflow identity

For the C1B Appointment proof:

```text
START_APPOINTMENT
  idempotencyKey = channel:<channel>:<externalMessageId>
  correlationId  = externalConversationId
```

Every Appointment Update:

```text
inputId = channel:<channel>:<externalMessageId>
```

This makes recovery compositional:

```text
transport replay
→ same durable event identity
→ same Temporal logical operation identity
→ one business effect
```

## Conversation binding rules

`START_APPOINTMENT` is the only action allowed to create a binding.

Non-start action:

```text
lookup binding by business + channel + externalConversationId
not found -> CHANNEL_CONVERSATION_NOT_BOUND
found     -> use workflowId
```

Binding creation:

```text
Temporal start succeeds/replays
→ upsert binding
```

A conflicting attempt to bind one conversation to a different Workflow returns `CHANNEL_BINDING_CONFLICT`.

## Execution core

```text
CanonicalChannelEnvelope
    ↓
ChannelEventRepository.claimInboundEvent
    ↓
ConversationBindingRepository.resolve/create
    ↓
CanonicalActionRegistry[action]
    ↓
existing CTA HTTP / Temporal operation
    ↓
project real Workflow state
    ↓
ChannelEventRepository.complete
```

Canonical action dispatch is registry composition, not a provider conditional chain.

## WebChat transport

C1B WebChat uses a thin raw event format:

```text
conversationId
messageId
senderId
businessSlug
operation
data
```

The WebChat adapter validates and normalizes that into the canonical contract.

The browser may store `conversationId` for convenience, but PostgreSQL is authoritative for the `conversationId → workflowId` binding.

## Query/recovery endpoint

The hardened channel surface must expose:

```text
GET /api/channel/conversations/:externalConversationId
```

The server resolves the binding from PostgreSQL and returns the same Workflow projection used by C1A.

This allows browser refresh or adapter restart to recover without requiring local storage to be the workflow authority.

## Typed failures

```text
CHANNEL_EVENT_INVALID
CHANNEL_EVENT_IDENTITY_CONFLICT
CHANNEL_CONVERSATION_NOT_BOUND
CHANNEL_BINDING_CONFLICT
CHANNEL_OPERATION_NOT_SUPPORTED
CHANNEL_EVENT_PROCESSING_FAILED
```

No typed transport failure may silently become a business success.

## Security / trust boundary

C1B laboratory allows a configured business scope for WebChat. A later deployment must resolve `businessSlug` from authenticated/trusted route binding rather than arbitrary user text.

Provider secrets and raw credential material never enter canonical payloads or durable business records.

## C1B acceptance

A clean certification run must prove all of:

```text
C1B-001 binding created server-side
C1B-002 binding recovered after WebChat process restart
C1B-003 exact START replay -> one Workflow
C1B-004 exact UPDATE replay -> one logical Workflow update
C1B-005 same event identity + different material -> conflict
C1B-006 conflict leaves Workflow state unchanged
C1B-007 browser duplicate submit does not duplicate business effect
C1B-008 complete Appointment reaches CREATED via hardened endpoint
C1B-009 C1A Workflow view remains correct
C1B-010 Agent=false / MCP=false / provider-independent core
```
