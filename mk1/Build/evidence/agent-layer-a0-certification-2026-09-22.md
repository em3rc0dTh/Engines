# Agent Layer A0 — Conversational Contract Certification

Date: 2026-09-22
Branch: `feat/agent-layer-a0-contract`

## Verdict

A0 is sealed as a provider-neutral conversational contract over the already-certified Engines platform.

Executed runtime/contract authority:

~~~text
3b53202b55e2c7309ea2bea7fc0dfb481329d0ab
~~~

GitHub Actions:

~~~text
workflow:
MK1 Agent Layer A0 Contract

run:
35784801132

result:
PASS

terminal job:
agent-a0-seal PASS
~~~

Artifacts:

~~~text
mk1-agent-a0-35784801132
sha256:a30c4763c0108b55c4d58111b852a65bc7f54b9e445e4b9db36dbc26bd6457f6

mk1-agent-a0-seal-35784801132
sha256:9ca44bdd7dd67a860f6c101094b1ad515c5509ee49af449cde2421e4446302c3
~~~

## Certified A0 contract

A0 establishes:

~~~text
AgentIdentity
AgentSoul
AgentPersonality
AgentVoice
AgentProfileOverrides
AgentResolvedProfile
AgentConversationContext
AgentEngineProjection
AgentModelProvider
AgentDecision
CapabilityBoundary
~~~

## Default personality and Soul

An Agent is complete without customer customization.

~~~text
Default Agent Profile
  ├─ Identity
  ├─ Soul
  ├─ Personality
  └─ Voice
~~~

Business customization uses partial overrides:

~~~text
defaults + declared overrides = resolved profile
~~~

Unspecified values continue to inherit defaults.

## Non-configurable authority boundary

The following are system invariants rather than personality options:

~~~text
Engine owns business truth
no direct persistence
only Engine-allowed actions
never invent completed execution
credentials stay outside model context
~~~

A0 rejects attempts to inject these controls through Agent profile customization.

## Model trust boundary

The provider interface deliberately returns unknown:

~~~text
AgentModelProvider.generateTurn(input) -> unknown
~~~

Provider output must cross canonical validation before Engines consumes it.

A proposed action is accepted only when:

~~~text
proposedAction.action
∈
EngineProjection.allowedActions
~~~

A physically or logically capable LLM therefore still has zero independent Engine authority.

## Small-context boundary

A0 constrains the conversational surface for a small local model:

~~~text
recent turns       <= 8
allowed actions    <= 16
engine hints       <= 8
current message    <= 2000 chars
small projected facts only
~~~

Secret-like keys are rejected recursively from model context and proposed-action arguments.

## Resource contract

The initial Agent product constraint is explicit:

~~~text
TOTAL NODE
4 vCPU
8 GB RAM
GPU not required

MODEL TARGET
~1.5B
Q4

CONTEXT
2048 tokens normal
4096 tokens maximum initially

OUTPUT TARGET
<= 128 tokens

PARALLEL GENERATIONS
1
~~~

This is a total-node target, not memory reserved exclusively for the model.

A1 must prove a real local inference runtime inside this budget rather than increasing the infrastructure assumption.

## Protected regressions

The exact A0 authority head also passed:

~~~text
RegisterNewAppointment contract regression  PASS
Channel Core regression                     PASS
Scheduler G2 contract regression             PASS
Integration G3 contract regression           PASS
~~~

Therefore A0 did not weaken the PRE-AGENT authority boundaries.

## What A0 does not claim

~~~text
real local LLM runtime
model quality
Spanish conversational golden-dataset pass
llama.cpp binding
Ollama binding
API provider binding
model download/distribution
production latency
production concurrency
Agent persistence
MCP
RAG
business reasoning inside the model
production readiness
~~~

## Next gate — A1

A1 may introduce one real local 1.5B-class inference adapter.

Required A1 proof should include:

~~~text
real local model load
structured AgentDecision output
Spanish natural-language interpretation
default Soul / Personality expression
business override expression
Engine allowed-action enforcement
no business-state invention
resource measurement inside 4 vCPU / 8 GB total-node target
bounded latency measurement
fallback behavior when model is unavailable
~~~

Final verdict:

~~~text
AGENT A0 ✅ SEALED
~~~
