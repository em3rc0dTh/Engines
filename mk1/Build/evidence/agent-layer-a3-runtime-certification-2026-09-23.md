# Agent Layer A3 — Durable Runtime Certification

Date: 2026-09-23
Branch: feat/agent-layer-a3-runtime

## Verdict

A3 is sealed as the durable conversational runtime gate immediately before the first manual Agent trial.

Executed exact-head authority:

~~~text
9e22f3a58c06a24627302f03856adfe4c62c36df
~~~

GitHub Actions:

~~~text
workflow:
MK1 Agent Layer A3 Runtime

run:
35867288650

result:
PASS

jobs:
runtime-contract        PASS
postgres-durability     PASS
protected-regressions   PASS
agent-a3-seal           PASS
~~~

Artifacts:

~~~text
mk1-agent-a3-runtime-35867288650
sha256:bfa01ba7e58c42f5d992a629b7f942a4a30488aea6875be7d7d9ba526a56b951

mk1-agent-a3-seal-35867288650
sha256:f1eadf01c5349f32b8f263006d6c75561c33e921fe6841e6d00c60413b225837
~~~

## Certified runtime

A3 establishes:

~~~text
AgentConversationRuntime
PostgreSQL turn ledger
bounded recent-turn reconstruction
durable replay
message material identity
stale PROCESSING recovery
deterministic LLM bypass
safe no-action model fallback
runtime audit evidence
~~~

The runtime layer itself is channel-independent. It has no Appointment, WebChat, Telegram, WhatsApp, Temporal, Scheduler, or llama.cpp dependency.

## Durable reconstruction proof

The certification persisted a first conversational turn, closed its PostgreSQL client, opened a new pool/repository/runtime, and processed a second turn.

The second turn reconstructed:

~~~text
USER:
Quiero una cita esta semana.

AGENT:
Claro. ¿Qué fecha prefieres?
~~~

Marker:

~~~text
AGENT_A3_CONTEXT_RECONSTRUCTION_PASS
~~~

## Durable replay proof

The first message was submitted again with identical identity and material.

The persisted response was returned and the worker was not executed again.

Marker:

~~~text
AGENT_A3_DURABLE_REPLAY_PASS
~~~

The same message identity with different material was rejected.

Marker:

~~~text
AGENT_A3_IDENTITY_CONFLICT_PASS
~~~

## Stale claim recovery

A PROCESSING turn was aged beyond the certification stale window and reclaimed with identical material.

The resulting attempt count was:

~~~text
2
~~~

Marker:

~~~text
AGENT_A3_STALE_CLAIM_RECOVERY_PASS
~~~

## Audit ledger evidence

Observed certification rows:

~~~text
a3-msg-1
status=APPLIED
route=MODEL
model_invoked=true
context_turn_count=0
phase WAITING_FOR_DATE → WAITING_FOR_DATE

a3-msg-2
status=APPLIED
route=MODEL
model_invoked=true
context_turn_count=2
phase WAITING_FOR_DATE → WAITING_FOR_SLOT

a3-msg-stale
status=APPLIED
route=DETERMINISTIC_BYPASS
model_invoked=false
context_turn_count=0
phase WAITING_FOR_SLOT → READY_TO_FINALIZE
~~~

Markers:

~~~text
AGENT_A3_AUDIT_LEDGER_PASS
AGENT_A3_CHANNEL_INDEPENDENT_RUNTIME_PASS
AGENT_A3_RUNTIME_DURABILITY_CERTIFICATION_PASS
~~~

## Deterministic bypass

A3 now avoids model inference when the current Engine state and user input are unambiguous.

Initial deterministic forms include:

~~~text
exact ManagedEntity name
exact Service name/code
exact Offering name/code
parseable appointment date
exact available time
explicit confirmation
~~~

A bypass still produces a canonical AgentDecision and crosses AppointmentChannelExecutionCore and Temporal.

It is not a business-logic bypass.

## Model-unavailable behavior

When language interpretation requires the model but the provider is unavailable or its output cannot pass validation:

~~~text
route = SAFE_FALLBACK
Engine action = none
state invention = none
safe reply = durable
~~~

A3 unit evidence verifies that model failure does not become an Engine action.

## Inference reduction

A2 used a model pass for interpretation and a second model pass for post-action narration.

A3 uses confirmed Engine state for deterministic narration.

Expected runtime behavior:

~~~text
unambiguous turn            0 model calls
natural/ambiguous turn      normally 1 model call
post-action narration       0 model calls
~~~

## Protected boundaries

The exact A3 head passed:

~~~text
A0 contract regression        PASS
A1 provider regression        PASS
Appointment regression        PASS
Channel regression            PASS
Scheduler regression          PASS
Integration regression        PASS
~~~

## Truth boundary

A3 certifies runtime continuity, idempotency, recovery, deterministic bypass, safe degradation, and conversation reconstruction.

A3 does not certify:

~~~text
first manual human Agent trial
Telegram physical Agent journey
WhatsApp physical Agent journey
production concurrency SLA
long-term memory
RAG
MCP
autonomous tool loops
production readiness
~~~

## Next

The next gate is no longer another architecture layer.

It is the first manual Agent trial over the integrated runtime.

Final verdict:

~~~text
AGENT A3 ✅ SEALED
READY FOR FIRST MANUAL AGENT TRIAL
~~~
