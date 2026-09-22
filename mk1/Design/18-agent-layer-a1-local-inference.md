# Agent Layer A1 — Real Local Inference

Date: 2026-09-22

## Goal

Bind one real local ~1.5B model to the A0 contract without moving any business authority into the model.

## Selected laboratory candidate

~~~text
runtime:
llama.cpp v0.4.1
commit b29c606e28a01b1bc8c1351026a0fa6e616bf6c4

model:
Qwen/Qwen2.5-1.5B-Instruct-GGUF
qwen2.5-1.5b-instruct-q4_k_m.gguf

quantization:
Q4_K_M

model alias:
engines-agent-local
~~~

The model is downloaded at certification/runtime setup time. Model weights are not committed to Engines.

## Runtime path

~~~text
AgentModelInput
  ↓
A1 prompt builder
  ├─ resolved Soul / Personality
  ├─ current user message
  ├─ bounded recent turns
  └─ EngineProjection
       ├─ facts
       ├─ hints
       └─ allowedActions
  ↓
llama.cpp /v1/chat/completions
  ↓
JSON-schema constrained output
  ↓
unknown provider output
  ↓
A0 validateAgentDecision
  ↓
AgentDecision
~~~

A1 does not bypass the A0 validator.

## Provider contract

A1 sends:

~~~text
temperature = 0
seed = 42
max_tokens = 128
reasoning_effort = none
stream = false
response_format = json_schema
~~~

The response schema dynamically exposes only the current Engine allowedActions.

Even if the model attempts another action, A0 validation remains the final gate.

## Prompt truth boundary

The system prompt explicitly states:

~~~text
Engines owns business truth and execution.
Do not invent ids, availability, prices, state, or results.
Do not claim execution unless Engine facts say it completed.
Copy canonical ids only from Engine facts.
~~~

This prompt improves behavior but is not the security boundary.

The actual security boundary is deterministic validation.

## Resource envelope

The product constraint remains:

~~~text
4 vCPU
8 GB RAM TOTAL NODE
no GPU required
~~~

A1 certifies the inference component with:

~~~text
generation threads = 4
batch threads = 4
context = 4096
parallel generations = 1
max output = 128
inference-process RSS cap = 2304 MB
~~~

The RSS cap intentionally leaves substantial RAM for Engines and the operating system.

A1 does not yet claim that the complete Engines + persistence + Temporal + local-model node has been physically held below 8 GB simultaneously. That integrated proof belongs to A2.

## Golden conversational slice

A1 real-model certification covers:

~~~text
"Mejor el viernes."
→ SET_DATE

"El Logan."
→ SELECT_MANAGED_ENTITY
→ exact men_logan copied from facts

"La ejecutiva."
→ SELECT_OFFERING
→ exact offering id copied from facts

"Sí, confirma."
→ FINALIZE_APPOINTMENT

"Gracias!"
→ RESPOND
~~~

This is an initial language slice, not a broad benchmark.

## Failure behavior

Provider failure, timeout, malformed completion, invalid JSON, or disallowed AgentDecision fails closed.

A1 does not silently fall back to invented deterministic behavior.

## Out of scope

~~~text
full 8 GB integrated-node proof
channel wiring
long conversation memory
RAG
MCP
business reasoning in the model
multi-model routing
multi-generation concurrency
production autoscaling
production readiness
~~~
