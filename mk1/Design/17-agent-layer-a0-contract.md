# Agent Layer A0 — Conversational Contract

Date: 2026-09-22

## Purpose

Agent Layer exists to make already-certified Engines capabilities feel natural and conversational.

It is not a new business core.

~~~text
User
  ↓
Channel
  ↓
Agent Layer
  ↓
canonical Engine action proposal
  ↓
existing Engine boundary
  ↓
Temporal / Customer / ManagedEntity / Services / Scheduler / Appointment
~~~

The Agent may interpret language and express personality. Engines remains authoritative for business truth and execution.

## A0 principles

~~~text
The Agent converses.
The Engine decides and executes.
~~~

A0 therefore introduces only:

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

No LLM provider is required by A0.

## Default → override → resolved profile

Every Agent has a complete default profile.

~~~text
Default Soul
Default Personality
Default Identity
Default Voice
      +
Business overrides
      ↓
Resolved Agent Profile
~~~

No customization is required to operate.

Partial customization changes only declared fields. Unspecified values continue to inherit defaults.

## Soul vs system invariants

Soul is configurable character:

~~~text
helpfulness
patience
empathy
userAgency
groundedness
~~~

System invariants are not Soul and are not configurable:

~~~text
Engine owns business truth
no direct persistence
only current Engine-allowed actions
never invent completed execution
credentials stay outside model context
~~~

A customer may give an Agent a different character. A customer may not configure the Agent into bypassing Engines.

## Personality

Initial personality dimensions:

~~~text
warmth
formality
initiative
humor
verbosity
~~~

These values affect expression, not permissions.

## Model boundary

The provider contract intentionally returns unknown:

~~~text
AgentModelProvider.generateTurn(input) -> unknown
~~~

The value is accepted only after:

~~~text
canonical shape validation
+
secret exclusion
+
current Engine capability boundary
~~~

A provider can therefore be local or remote without becoming an authority.

## AgentDecision

A0 keeps model output intentionally small.

~~~text
RESPOND
CLARIFY
PROPOSE_ACTION
~~~

A proposed action contains:

~~~text
action
arguments
~~~

The action must be present in the current EngineProjection.allowedActions.

If it is not, Engines rejects the decision.

## Conversation context

The model does not receive the entire Engine database, Temporal history, or complete conversation archive.

Initial bounded context:

~~~text
recent turns      <= 8
allowed actions   <= 16
engine hints      <= 8
facts             small JSON projection
current message   <= 2000 chars
~~~

Secret-like data is rejected recursively.

## Local inference target

A0 records the product constraint rather than coupling the runtime to one implementation.

~~~text
TOTAL NODE
4 vCPU
8 GB RAM
no required GPU

MODEL TARGET
~1.5B parameters
Q4

CONTEXT
normal 2048 tokens
initial maximum 4096 tokens

OUTPUT
maximum target 128 tokens

PARALLEL MODEL GENERATIONS
1
~~~

This budget includes the node, not only the model.

The future A1 implementation must prove that the chosen local runtime fits this boundary rather than silently increasing infrastructure.

## No unnecessary inference

Future Agent runtime should preserve deterministic paths when language interpretation is unnecessary.

Examples:

~~~text
button/callback selection       → Engine directly
exact slot callback             → Engine directly
explicit yes/no when canonical  → deterministic path where possible
natural ambiguous sentence      → Agent model
~~~

A0 does not implement that router yet.

## Out of scope

~~~text
real LLM runtime
llama.cpp/Ollama binding
prompt implementation
model download
MCP
RAG
business reasoning inside the model
direct DB access
new Temporal semantics
new Scheduler semantics
production deployment
~~~

## A0 acceptance

~~~text
default profile works without customization
partial overrides inherit defaults
invariants cannot be overridden
small-context limits enforced
secret-like context rejected
provider output treated as untrusted
disallowed proposed action rejected
4 vCPU / 8 GB / 1.5B target encoded
protected pre-Agent contracts remain green
~~~
