# Agent Layer — A0 Contract Gate

Date: 2026-09-22

## Goal

Open the Agent Layer without weakening the PRE-AGENT seal.

A0 must define the conversational boundary before a real model is introduced.

## Build

1. Add provider-neutral Agent contracts.
2. Add default Agent Soul/Personality/Identity/Voice.
3. Add safe partial business overrides.
4. Keep Engine invariants outside the customizable profile.
5. Add bounded ConversationContext and EngineProjection.
6. Add untrusted AgentModelProvider output boundary.
7. Add AgentDecision validation.
8. Reject actions outside EngineProjection.allowedActions.
9. Reject secret-like context/action data.
10. Encode the 4 vCPU / 8 GB total-node, 1.5B Q4 target.
11. Add deterministic tests and certification probe.
12. Run protected pre-Agent contract regressions.

## Gate

A0 is sealed only when the exact branch head passes:

~~~text
TypeScript
Agent A0 contract tests
Agent A0 executable probe
Appointment contract regression
Channel contract regression
Scheduler contract regression
Integration contract regression
A0 exact-head seal
~~~

## Next gate

A1 may introduce one real local inference adapter.

A1 must not change the business-authority boundary established here.
