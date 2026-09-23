# Agent Layer A4 — First Manual Agent Trial

Date: 2026-09-23

## Purpose

This is the first human-facing conversational trial after the A3 durable runtime seal.

It is not a new architecture gate and it must not weaken A0/A1/A2/A3 contracts.

## Manual-trial boundary

The current Appointment Agent intentionally does **not** own fresh-browser identity bootstrap.

The human path is therefore:

~~~text
Start Workflow
  ↓
deterministic customer identity intake
  ↓
Customer resolved
  ↓
Agent Runtime owns the conversational journey
  ↓
ManagedEntity
  ↓
Service
  ↓
Offering
  ↓
Date
  ↓
Slot
  ↓
Final confirmation
  ↓
Temporal / Scheduler / PostgreSQL
~~~

From `WAITING_FOR_MANAGED_ENTITY` onward, the WebChat composer and its visible suggestions route through:

~~~text
POST /api/agent/messages
~~~

The UI shows the runtime route after every Agent response:

~~~text
MODEL
DETERMINISTIC_BYPASS
SAFE_FALLBACK
~~~

and whether the local model was invoked.

## Preconditions

The exact A3-integrated `main` is the baseline:

~~~text
3868e2f9a2c8587ff74e0d26d765fadc944623ed
~~~

The local model remains:

~~~text
Qwen2.5 1.5B Instruct Q4_K_M
sha256:
6a1a2eb6d15622bf3c96857206351ba97e1af16c30d7a74ee38970e434e9407e
~~~

The Agent stack must be started with:

~~~text
ENGINES_AGENT_ENABLED=true
AGENT_LLAMA_BASE_URL=http://host.docker.internal:8080
AGENT_LLAMA_MODEL=engines-agent-local
~~~

and WebChat profile enabled.

## Physical fixture

For the known integrated Appointment journey, prepare the existing ManagedEntity physical fixture before the human trial:

~~~bash
docker compose run --rm --no-deps -T \
  -e POSTGRES_URL=postgresql://engines:engines@postgres:5432/engines_mk0 \
  cta npm run fixture:me1:physical
~~~

Expected marker:

~~~text
ME1_PHYSICAL_FIXTURES_READY
~~~

## Human procedure

Open:

~~~text
http://127.0.0.1:8790/webchat/
~~~

Then:

1. Start the Workflow.
2. Resolve the customer through the deterministic identity prompt.
3. When the Agent handoff appears, type naturally instead of calling canonical operations directly.
4. Choose the ManagedEntity in natural language.
5. Choose a visible Service in natural language.
6. Choose a visible Offering in natural language.
7. Enter a natural date such as `este viernes`.
8. Choose one of the visible slots using natural language such as `a las 10:30`.
9. Confirm naturally, for example `sí, confirma`.

Visible choice buttons are allowed, but after customer resolution those buttons also send text through the Agent endpoint; they do not bypass the Agent Runtime.

## PASS criteria

A human trial is PASS only when all are true:

~~~text
human typed at least one non-deterministic natural-language Agent turn
Agent reply was visible in WebChat
runtime audit route was visible
invalid model output did not bypass A0 validation
canonical Engine action executed only after a valid AgentDecision
Temporal workflow reached COMPLETED
Appointment was durably created
Scheduler reservation was durably created
final Agent narration described confirmed state
~~~

## Truth boundary

CI may certify the wiring and regressions, but CI does **not** certify that the first human trial happened.

The first human trial is only complete after a person actually uses this WebChat surface against the real local Qwen/llama.cpp stack and records the resulting durable conversation / Appointment evidence.
