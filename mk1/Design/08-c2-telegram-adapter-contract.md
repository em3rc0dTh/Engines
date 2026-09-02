# C2 — Telegram Adapter Contract

## Status

**DESIGN / BUILD PREPARATION — HUMAN TEST DEFERRED**

Telegram is the second CTA transport. It must reuse the C1B channel core rather than introduce new business behavior.

## 1. Runtime path

```text
Telegram Bot API
   ↓
Telegram long-polling transport
   ↓
TelegramAdapter
   ↓
CanonicalChannelEnvelope
   ↓
existing ChannelExecutionCore
   ↓
existing PostgreSQL channel binding/event ledger
   ↓
existing Temporal Workflow Library
```

No Agent, MCP or semantic AI router is introduced.

## 2. Transport identities

Candidate mapping:

```text
externalConversationId = Telegram chat identity
externalMessageId      = update_id + relevant message/callback identity
externalSenderId       = Telegram user identity when available
channel                = TELEGRAM
```

Exact identity construction must be deterministic and collision-safe inside one business scope.

## 3. Trusted business routing

`businessSlug` must come from server-side bot/route configuration, not from arbitrary Telegram message text.

Possible initial configuration:

```text
one Telegram bot process/configuration
→ one trusted businessSlug
```

Multi-business bot routing can be designed later if required, but it must remain explicit and trusted.

## 4. Supported inbound forms for C2 baseline

```text
text message
callback query / button selection
/start command
```

Media/attachments may be deferred until the AttachmentStore staging contract is extended for Telegram file retrieval.

## 5. Deterministic interaction

C2 should initially render the same explicit Appointment operation sequence already proven in WebChat:

```text
Start
Customer name
Customer email
Customer phone
Resolve Customer
Service
Offering
Date
Slot
Finalize
Created
```

The adapter does not infer arbitrary intents from free text. Free text is accepted only where the current Workflow nextAction expects a textual value.

## 6. Outbound rendering

Canonical responses are rendered into Telegram messages/buttons.

Examples:

```text
SELECT_SERVICE  → inline keyboard buttons
SELECT_PRODUCT  → inline keyboard buttons
SELECT_SLOT     → inline keyboard buttons
PROVIDE_DATE    → text prompt
FINALIZE        → explicit confirmation button
```

Telegram callback payloads must contain opaque action/value references, not trusted business truth supplied by the client.

## 7. Durable restart semantics

Telegram process memory is never conversation authority.

After bot process restart:

```text
chat identity
→ channel_conversation_bindings
→ same workflowId
→ query Temporal state
→ render current nextAction
```

This directly reuses the C1B recovery model.

## 8. Delivery replay

Telegram can redeliver updates or the poller can process an update after restart. The normalized `externalMessageId` must feed the existing `channel_inbound_events` exact replay/conflict semantics.

```text
same Telegram transport event + same material
→ stored exact replay

same event identity + different canonical material
→ conflict/no Workflow mutation
```

## 9. Polling checkpoint

Long polling requires a durable or safely reconstructible update offset strategy so a process restart does not cause uncontrolled replay storms.

However, correctness must not depend on the offset being perfect: C1B event idempotency remains the final duplicate-effect protection.

## 10. Error handling

Transport/provider errors are Telegram adapter concerns:

```text
network timeout
429/rate limiting
Telegram API temporary failure
message rendering limit
invalid callback/query lifecycle
```

Business/Workflow errors remain canonical errors from ChannelExecutionCore/Temporal and are rendered to the user without being reclassified as provider business policy.

## 11. Engineering visibility

A Telegram-driven Workflow should remain inspectable through the existing HTML Workflow Inspector using `workflowId`.

The inspector follows Temporal and therefore requires no Telegram-specific implementation beyond surfacing the correlated workflow identifier to engineering tooling.

## 12. C2 build target

Before human Telegram testing, implement and automate:

```text
TelegramAdapter normalization tests
trusted business routing test
message/update identity tests
callback normalization tests
process restart/binding recovery test with synthetic Telegram events
exact update replay test
material-conflict test
same Appointment Workflow completion using synthetic transport fixtures
C1B WebChat regression retained
```

Actual Telegram Bot API credential/network execution remains a later manual/physical proof.

## 13. Non-claims

Design/build preparation does not certify a real Telegram bot, Telegram network delivery, production bot security, media uploads, webhook mode or multi-business bot routing.
