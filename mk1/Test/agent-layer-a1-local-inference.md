# Agent Layer A1 — Real Local Inference Test Matrix

Date: 2026-09-22

## Deterministic provider tests

- request is OpenAI-style llama.cpp Chat Completions;
- temperature 0;
- max output 128;
- response_format is JSON Schema;
- only Engine allowedActions appear in the schema;
- provider HTTP errors fail closed;
- non-JSON model output fails closed;
- A0 rejects a disallowed action even if a provider emits it.

## Real-model cases

~~~text
A1-GOLDEN-DATE
"Mejor el viernes."
expected SET_DATE

A1-GOLDEN-ENTITY
"El Logan."
expected SELECT_MANAGED_ENTITY + men_logan

A1-GOLDEN-OFFERING
"La ejecutiva."
expected SELECT_OFFERING + off_executive

A1-GOLDEN-FINALIZE
"Sí, confirma."
expected FINALIZE_APPOINTMENT

A1-GOLDEN-CONVERSATION
"Gracias!"
expected RESPOND
~~~

## Resource evidence

Capture:

~~~text
model file size
model file SHA-256
llama.cpp source commit
server log
maximum llama-server RSS
CPU/thread settings
golden-case output
median latency
maximum latency
exact Engines SHA
~~~

Gate:

~~~text
max llama-server RSS <= 2304 MB
each golden turn < 30 seconds
~~~

This is an inference-component gate. Whole-node <= 8 GB remains A2.
