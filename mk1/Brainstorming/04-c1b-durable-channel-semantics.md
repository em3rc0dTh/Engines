# C1B — Durable Channel Semantics Brainstorming

## Status

**ACTIVE BUILD DISCOVERY — WEBCHAT HARDENING BEFORE TELEGRAM — NO AGENT / NO MCP**

C1A proved that a minimal HTML WebChat can drive the same explicit CTA → Temporal Appointment workflow already exercised through the CLI and can expose the real durable Workflow phase and human-readable execution map.

C1B addresses the remaining transport correctness gap: the browser and adapter process must not be the authority for conversation identity or inbound-event replay safety.

## Problem

C1A can resume a known `workflowId` through browser URL/local storage. That is sufficient for a workflow-visible PoC but insufficient for a reusable multi-channel adapter architecture.

The transport layer is at-least-once in practice. Browser double-clicks, client retry, bot redelivery, adapter restart, network timeout, and later Telegram `update_id` replay can all cause the same inbound event to arrive more than once.

We need one durable contract before adding the second provider.

## Required truth

```text
external conversation
      ↓
ChannelConversationBinding in PostgreSQL
      ↓
workflowId

external event identity
      ↓
ChannelInboundEvent ledger in PostgreSQL
      ↓
material fingerprint + terminal response
```

PostgreSQL is operational authority for active channel correlation because uniqueness and restart recovery are transactional concerns. Temporal remains orchestration authority. Mongo remains semantic/audit evidence and is not required to recover the active binding.

## C1B invariants

```text
same inbound identity + same normalized material
→ no second business effect
→ replay/reuse recorded result

same inbound identity + different normalized material
→ CHANNEL_EVENT_IDENTITY_CONFLICT
→ zero new Workflow mutation

adapter process restart
→ binding recovered from PostgreSQL
→ same Temporal Workflow continues

browser local storage deleted
→ known externalConversationId can still recover the server-side binding
```

The durable event ledger must not pretend it alone makes a business operation idempotent. The canonical event identity is also propagated into the existing Temporal/Workflow `idempotencyKey` or `inputId`, so a crash after the Workflow mutation but before channel-ledger completion remains safe to retry.

## Canonical action vocabulary for the Appointment proof

C1B stays deterministic and explicit:

```text
START_APPOINTMENT
PROVIDE_CUSTOMER
RESOLVE_CUSTOMER
SELECT_SERVICE
SELECT_OFFERING
SET_DATE
SELECT_SLOT
FINALIZE_APPOINTMENT
```

This is not intent classification. A renderer chooses one already-legal canonical action based on the Workflow projection.

## Composition rule

Provider selection must remain outside business logic.

```text
AdapterRegistry
  WEBCHAT -> WebChatAdapter
  later TELEGRAM -> TelegramAdapter

Adapter
  normalize raw transport event
      ↓
CanonicalChannelEvent
      ↓
ChannelExecutionCore
      ↓
CTA / Temporal
```

No provider conditional chain may enter Customer, Services, Scheduler, Appointment Workflow, or persistence policy.

## Crash/retry reasoning

Critical window:

```text
1 durable inbound event claimed
2 CTA/Temporal operation succeeds
3 adapter dies before storing terminal channel response
4 same event delivered again
```

C1B must be safe here.

For Appointment start, the existing Temporal port derives a stable Workflow ID from business scope + idempotency key and returns the same Workflow for exact replay while rejecting different initial material.

For Appointment Updates, the existing explicit `inputId` is the canonical update identity. C1B derives that input identity from the durable transport event identity. Re-executing after adapter failure therefore cannot create a second logical update.

## Binding lifecycle

For this PoC:

```text
ACTIVE
COMPLETED
FAILED
```

A binding is created when the start operation obtains a Workflow identity. Querying the Workflow can reconcile the binding status with terminal Workflow state. C1B does not introduce a second workflow lifecycle.

## What C1B does not add

```text
Agent
MCP
LLM router
WebSocket requirement
Telegram
WhatsApp
new Appointment business semantics
new Scheduler semantics
```

## Exit condition

C1B is certifiable only when a clean Compose run proves:

- persistent binding survives adapter restart;
- exact inbound replay returns one effect;
- same identity/different material rejects before mutation;
- duplicate start resolves to one Workflow;
- duplicate update resolves to one durable logical update;
- the complete Appointment still reaches `CREATED` through the hardened channel path;
- C1A visibility remains intact;
- no Agent/MCP/provider business branching appears.
