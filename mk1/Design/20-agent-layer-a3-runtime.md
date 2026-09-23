# Agent Layer A3 — Durable Conversation Runtime

Date: 2026-09-23

## Goal

Prepare Agent Layer for its first real user-facing trial by making conversation handling durable, replay-safe, channel-independent, and safe when the local model is unavailable.

A3 does not move business authority into the model.

## Runtime boundary

~~~text
Channel message
  ↓
AgentConversationRuntime
  ├─ durable claim / replay
  ├─ bounded history reconstruction
  ├─ audit ledger
  └─ stale claim recovery
  ↓
Appointment Agent adapter
  ├─ deterministic bypass when unambiguous
  ├─ local model when interpretation is needed
  └─ safe no-action fallback if model fails
  ↓
validated AgentDecision
  ↓
canonical Channel envelope
  ↓
AppointmentChannelExecutionCore
  ↓
Temporal / Engines
~~~

AgentConversationRuntime has no Appointment, WebChat, Telegram, WhatsApp, Temporal, Scheduler, or provider-specific dependency.

## Durable turn ledger

A3 introduces agent_runtime_turns.

Each inbound message is keyed by:

~~~text
business_slug
channel
external_message_id
~~~

The row records conversation identity, material hash, user text, status, route, whether the model was invoked, reconstructed context size, visible reply, interpretation, persisted response, Engine phases, attempts, and timestamps.

The conversational ledger is audit evidence. It is not business truth.

## Replay

Same message identity plus identical material returns the persisted response.

The runtime does not invoke the worker, model, or Engine again.

Same identity with different material fails closed with:

~~~text
AGENT_RUNTIME_TURN_IDENTITY_CONFLICT
~~~

## Context reconstruction

The runtime reconstructs at most eight recent USER/AGENT turns from APPLIED rows.

The model remains stateless. Restarting the process therefore does not erase recent conversational continuity.

## Stale PROCESSING recovery

An identical turn left PROCESSING can be reclaimed after a bounded stale window.

The material hash must still match. Conflicting material is never reclaimed.

## Deterministic bypass

A3 skips the model when Engine state plus input is sufficient deterministically.

Initial bypasses:

~~~text
exact ManagedEntity display name
exact Service name/code
exact Offering name/code
parseable date
exact available HH:mm slot
explicit confirmation
~~~

The bypass still emits a canonical AgentDecision and still executes through AppointmentChannelExecutionCore and Temporal.

## Model-unavailable behavior

If natural-language interpretation requires the model and the provider fails or emits invalid output:

~~~text
Engine action count = 0
no invented state
safe CLARIFY or RESPOND
result is persisted and replayable
~~~

This is an explicit A3 degradation path.

## Post-action narration

After an accepted action, A3 re-reads settled Engine state and creates the visible reply deterministically from confirmed state.

This removes A2's second inference pass.

~~~text
unambiguous turn → 0 LLM calls
natural/ambiguous turn → normally 1 LLM call
post-action narration → 0 LLM calls
~~~

## First-trial boundary

A3 is the final runtime gate before the first manual Agent trial.

It does not certify a physical Telegram or WhatsApp Agent journey.
