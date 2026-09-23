# Agent Layer A3 — Runtime Execution Gate

Date: 2026-09-23

## Build

1. Persist Agent turns in PostgreSQL.
2. Make inbound Agent messages idempotent.
3. Reconstruct bounded recent context after runtime restart.
4. Reject same message id with different material.
5. Recover identical stale PROCESSING claims.
6. Add channel-independent AgentConversationRuntime.
7. Route Appointment Agent through that runtime.
8. Add deterministic bypass for unambiguous input.
9. Add safe no-action model-unavailable behavior.
10. Replace post-action LLM narration with confirmed-state deterministic narration.
11. Record route/model/phase audit evidence.
12. Preserve A0, A1, A2 and PRE-AGENT boundaries.

## Seal

A3 is sealed only when one exact head proves:

~~~text
TypeScript
A0 regression
A1 regression
A3 runtime tests
PostgreSQL restart reconstruction
durable replay
identity-conflict rejection
stale-claim recovery
audit ledger
Appointment regression
Channel regression
Scheduler regression
Integration regression
~~~

The PR must additionally allow the A2 real integrated journey to rerun against A3.

## After A3

Run the first manual Agent trial.

Do not expand into MCP, RAG, long-term memory, or autonomous tool loops before that trial.
