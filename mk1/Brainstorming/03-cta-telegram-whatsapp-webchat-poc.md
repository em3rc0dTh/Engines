# CTA Proof of Concept — Telegram + WhatsApp + WebChat

## Status

**BRAINSTORMING / PARALLEL DESIGN TRACK — NOT IMPLEMENTED**

This document runs in parallel with G1 Services Engine work. It does not move the channel proof ahead of the current engine certification sequence and does not claim Telegram, WhatsApp or WebChat support exists yet.

## Objective

Prove that three materially different channels can drive the **same Engines orchestration contracts** without duplicating business logic inside channel adapters.

Target proof channels:

```text
WebChat
Telegram
WhatsApp
```

The channel layer must remain transport and presentation only.

## Proposed shape

```text
WEBCHAT          TELEGRAM          WHATSAPP
   │                 │                 │
   └────────────┬────┴────────────┬────┘
                ↓                 ↓
          CHANNEL ADAPTERS / CTA
                 ↓
        CanonicalChannelEnvelope
                 ↓
          CTA ORCHESTRATION PORT
                 ↓
              TEMPORAL
                 ↓
       SAME WORKFLOW LIBRARY
                 ↓
 Services / Scheduler / Persistence
```

A channel adapter may normalize transport identifiers, text, button/callback input, files, locale and delivery metadata. It must not decide pricing, eligibility, Customer business truth, booking capacity, reservation conflicts or workflow completion.

## Canonical inbound envelope candidate

```text
channel
businessSlug
externalConversationId
externalMessageId
externalSenderId
receivedAt
text?
command/callback?
attachments[]
locale?
metadata
```

The envelope is not itself business truth. Its purpose is to give the CTA core enough canonical transport context to correlate a message with an Engines Workflow and submit a legal start/update/query operation.

## Canonical outbound response candidate

```text
workflowId
phase
prompt/message
choices[]
attachments[]
terminal
resultSummary?
```

Each adapter renders this into its native channel primitives. A Telegram button, WhatsApp interactive response and WebChat button can therefore represent the same canonical choice without changing Workflow semantics.

## Correlation and idempotency

The PoC must never treat provider delivery as exactly-once.

Candidate transport identity:

```text
channelEventKey =
  hash(businessSlug + channel + externalMessageId)
```

Candidate conversation key:

```text
channelSessionKey =
  hash(businessSlug + channel + externalConversationId)
```

The exact durable mapping mechanism remains a design decision. It must preserve restart recovery and must not turn the CTA process into business authority.

Provider retries or duplicated inbound messages must not produce duplicated Temporal Updates or duplicated business effects.

## Attachments

Channel-specific binary uploads must converge on the existing AttachmentStore boundary:

```text
Telegram file / WhatsApp media / WebChat upload
                 ↓
             CTA Adapter
                 ↓
        stage AttachmentStore
                 ↓
          attachment reference
                 ↓
        Temporal Workflow Update
```

No channel adapter should place binary blobs in Customer, Appointment, Services or Scheduler business tables.

## Channel strategy

### WebChat — controlled laboratory surface

WebChat is the easiest place to make workflow state visible and debug canonical message rendering. A minimal local PoC should favor a small static chat client and a narrow transport API rather than building a complete frontend product.

Useful first proof:

```text
browser
→ CTA WebChat adapter
→ Temporal
→ same workflow
→ canonical response
→ browser rendering
```

A WebSocket is not mandatory for the first proof. HTTP start/update/query plus lightweight polling or SSE can be sufficient. Transport complexity must not obscure the architecture proof.

### Telegram — first external conversational channel

Telegram is a strong first external proof because the adapter can begin with Bot API polling in a local laboratory and later move to webhook ingress without changing workflow semantics.

The adapter must normalize:

```text
chat/message identity
text
callback/button data
media/file references
reply correlation
```

Polling versus webhook is an ingress deployment decision, not a business workflow decision.

### WhatsApp — strategic production-shaped proof

WhatsApp is strategically important but introduces more provider/platform concerns than Telegram. The PoC should isolate:

```text
webhook verification/authenticity
provider message identity
inbound message normalization
interactive response normalization
media retrieval/staging
outbound delivery
provider retry/delivery events
```

Those concerns belong in the adapter/integration boundary. They must not leak into Services or Scheduler rules.

## Same-conversation proof

The strongest channel test is not three demos with three code paths. It is one frozen canonical scenario rendered three ways.

Example future Golden scenario:

```text
RegisterNewAppointment
→ Customer resolution
→ Services list
→ Offering selection
→ Scheduler slots
→ Slot selection
→ explicit finalize
→ Appointment created
```

Run that scenario through:

```text
WebChat  → PASS/FAIL
Telegram → PASS/FAIL
WhatsApp → PASS/FAIL
```

Then compare Temporal, PostgreSQL, Mongo and AttachmentStore evidence. Channel-specific transport metadata may differ; business outcome semantics must not.

## PoC acceptance ideas

A future G3 channel certification should require at minimum:

- one adapter restart during an active conversation;
- duplicate inbound provider event does not duplicate workflow effect;
- button/callback input maps to the same canonical update as typed text where applicable;
- attachment ingress uses AttachmentStore rather than business-table blobs;
- no direct channel-to-business-PostgreSQL mutation;
- same Services/Scheduler decisions across channels for the same canonical context;
- terminal business result can be traced back to channel event + Workflow + persistence evidence;
- provider outage or outbound failure does not corrupt business truth.

## Recommended execution order

```text
1. WebChat local adapter proof
2. Telegram polling adapter proof
3. Telegram webhook ingress proof
4. WhatsApp Cloud/API adapter proof
5. cross-channel Golden comparison
```

This ordering minimizes provider friction while still ending with a production-shaped external channel.

## Explicit non-goals for the current S4 branch

This branch is building **Services S4 management mutations**. It must not mix Telegram/WhatsApp/WebChat runtime code into S4.

The CTA channel work remains documented in parallel and should receive its own branch/gates after the engine prerequisites are stable.
