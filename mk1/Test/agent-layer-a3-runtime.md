# Agent Layer A3 — Runtime Test Matrix

Date: 2026-09-23

## A3-01 Context reconstruction after restart

Process turn 1, close the PostgreSQL client, create a new pool/repository/runtime, then process turn 2.

Expected: turn 2 receives turn 1 USER and AGENT history.

## A3-02 Durable replay

Send the same message id and material twice.

Expected:

~~~text
second response replayed
worker calls do not increment
model not called again
Engine not called again
~~~

## A3-03 Identity conflict

Reuse the same message id with different material.

Expected:

~~~text
AGENT_RUNTIME_TURN_IDENTITY_CONFLICT
~~~

## A3-04 Stale claim recovery

Leave an identical turn PROCESSING beyond the stale window and reclaim it.

Expected: claim succeeds and attempt_count increments.

## A3-05 Deterministic bypass

Use an unambiguous state/input pair such as an exact available slot.

Expected:

~~~text
canonical action executes
modelInvoked = false
route = DETERMINISTIC_BYPASS
~~~

## A3-06 Model unavailable

Give a message that requires natural-language interpretation while provider fails.

Expected:

~~~text
route = SAFE_FALLBACK
modelInvoked = true
Engine calls = 0
reply is durable
~~~

## A3-07 Multi-turn model context

Persist a previous turn and send a later non-deterministic turn.

Expected: bounded prior USER/AGENT history is present in AgentModelInput.

## A3-08 Audit ledger

Verify persisted:

~~~text
route
model_invoked
context_turn_count
engine_phase_before
engine_phase_after
response
interpretation
attempt_count
~~~

## Protected regressions

A0, A1, Appointment, Channel, Scheduler, and Integration remain green.

A2's real integrated journey must run again on the PR before merge.
