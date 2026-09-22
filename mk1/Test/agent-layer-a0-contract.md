# Agent Layer A0 — Contract Test Matrix

Date: 2026-09-22

## A0-01 Default profile

Given no business customization, resolve a complete default Agent profile.

Expected: PASS.

## A0-02 Partial customization

Override only selected Identity, Soul, Personality, or Voice fields.

Expected:

~~~text
overridden fields use custom values
all other fields inherit defaults
~~~

## A0-03 Invariant override rejection

Attempt to inject a configurable invariants/system-policy field.

Expected: reject.

## A0-04 Engine capability boundary

Engine projection allows:

~~~text
SET_DATE
CANCEL
~~~

Model proposes SET_DATE.

Expected: accept canonical AgentDecision.

Model proposes FINALIZE_APPOINTMENT.

Expected: reject before Engine execution.

## A0-05 Secret exclusion

Place secret-like keys in Engine facts or proposed-action arguments.

Examples:

~~~text
apiKey
accessToken
password
credentials
~~~

Expected: reject recursively.

## A0-06 Small-context boundary

Supply more than eight recent turns.

Expected: reject.

## A0-07 Untrusted provider output

Fake provider emits a valid CLARIFY response.

Expected: accept.

Fake provider emits a disallowed action.

Expected: runAgentModelTurn rejects it.

## A0-08 Infrastructure constraint

Verify the committed A0 resource contract:

~~~text
4 vCPU total
8192 MB RAM total
no required GPU
1.5B target
Q4
2048 normal context
4096 maximum context
1 parallel generation
~~~

Expected: PASS.

## Protected regressions

A0 CI must run existing deterministic contracts for:

~~~text
RegisterNewAppointment
Channel Core
Scheduler G2
Integration G3
~~~

A0 does not alter their semantics.
