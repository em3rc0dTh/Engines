# Agent Layer A2 — Integrated Journey and 8 GB Node Certification

Date: 2026-09-22
Branch: `feat/agent-layer-a2-integrated-journey`

## Verdict

A2 is sealed for one integrated CPU-only Agent journey over the certified Engines runtime and for one bounded complete-node memory proof inside the 4 vCPU / 8 GB product target.

Executed exact-head authority:

~~~text
9438e5eb85fab866d437effe7063b18afdff500e
~~~

GitHub Actions:

~~~text
workflow:
MK1 Agent Layer A2 Integrated Journey

run:
35807358759

result:
PASS

jobs:
deterministic-a2-contract            PASS
real-integrated-journey             PASS
protected-pre-agent-regressions     PASS
agent-a2-seal                       PASS
~~~

Artifacts:

~~~text
mk1-agent-a2-deterministic-35807358759
sha256:b12a3df70f5bfbad5e6e11d7378f2cffa5ae6a56cbc169c8e5561c014714b617

mk1-agent-a2-integrated-35807358759
sha256:10db90e06c6a5354a82ba9dc3cb3788449cc17deb0151e89c1c688a26d7b26bc

mk1-agent-a2-seal-35807358759
sha256:c5724e5ab08002a40cc9620929ba8aa95502550da59d69a8fe5cc33e96c62e0d
~~~

## Integrated journey

A2 exercised:

~~~text
WebChat
  ↓
Agent-enabled Channel Core
  ↓
real local Qwen2.5 1.5B Q4_K_M
  ↓
A0/A1 AgentDecision validation
  ↓
canonical Engine action
  ↓
Temporal RegisterNewAppointment
  ↓
ManagedEntity / Services / Scheduler
  ↓
durable PostgreSQL truth
  ↓
Engine projection
  ↓
natural Agent reply
  ↓
WebChat
~~~

Observed user-facing replies:

~~~text
date:
"La cita está confirmada para el 25 de septiembre. ¿Qué horario prefieres de los disponibles?"

slot:
"El servicio se realizará a las 06:00. ¿Podemos confirmar la cita?"

final:
"La cita está confirmada. ¿Qué deseas hacer ahora?"
~~~

Certification markers:

~~~text
AGENT_A2_WEBCHAT_CHANNEL_PASS
AGENT_A2_LOCAL_MODEL_ENGINE_ACTION_PASS
AGENT_A2_TEMPORAL_DURABLE_STATE_PASS
AGENT_A2_SCHEDULER_RESERVATION_PASS
AGENT_A2_NATURAL_REPLY_PASS
AGENT_A2_INTEGRATED_JOURNEY_PASS
~~~

## Durable Scheduler truth

The integrated run produced:

~~~text
appointment:
apt_00a6b50b1fba85cb63e6791f4e14c4b1

managed entity:
men_me1_phys_logan

scheduler reservation:
schedres_3c1576caf8942bd0ea36e467d40d5bc0

scheduler reservation status:
RESERVED

assignment count:
1
~~~

The SQL proof passed:

~~~text
AGENT_A2_SQL_DURABILITY_PASS
~~~

A2 therefore does not substitute Agent output for durable Engine state.

## 4 vCPU profile

The model process and every operational container were observed constrained to CPU set:

~~~text
0-3
~~~

Containers:

~~~text
runtime-channel-core-1
runtime-cta-1
runtime-mongo-1
runtime-postgres-1
runtime-temporal-1
runtime-webchat-1
runtime-worker-1
~~~

Marker:

~~~text
AGENT_A2_FOUR_VCPU_AFFINITY_PROFILE_PASS
~~~

## Complete-node memory budget

Product constraint:

~~~text
4 vCPU
8 GB RAM total target
no GPU
~~~

Measured/accounted A2 profile:

~~~text
budget                         8192 MB
OS + Docker reserve            1024 MB
operational containers          977 MB
llama-server                   2055 MB
--------------------------------------
accounted total                4057 MB
remaining headroom             4135 MB
~~~

Observed container snapshot:

~~~text
channel-core   157.9 MB
cta            152.8 MB
mongo          118.1 MB
postgres        44.61 MB
temporal       102.1 MB
webchat         97.37 MB
worker         304.5 MB
~~~

Marker:

~~~text
AGENT_A2_TOTAL_NODE_MEMORY_BUDGET_PASS
~~~

This is a bounded laboratory proof using an explicit 1 GB OS/Docker reserve plus measured process/container memory. It is not a production capacity or concurrency SLA.

## Agent boundary preserved

A2 did not move business authority into the model.

~~~text
model:
language + interpretation + reply

Agent adapter:
canonical envelope + validation

Engine:
business truth + allowed actions

Temporal/domain engines:
execution

Scheduler:
capacity/reservation truth

PostgreSQL:
durable state
~~~

A0 and A1 contract regressions passed, along with the protected PRE-AGENT regression suite.

## Certified boundary

A2 certifies:

~~~text
real WebChat Agent journey                     PASS
real local 1.5B model in integrated path       PASS
validated Engine action proposals              PASS
Temporal durable workflow state                PASS
SchedulerReservation durable truth             PASS
natural Spanish response path                  PASS
4 vCPU affinity profile                        PASS
complete-node accounted memory < 8 GB          PASS
A0/A1 contract preservation                    PASS
protected PRE-AGENT regressions                PASS
~~~

## Non-claims

A2 does not certify:

~~~text
50+ concurrent conversations
production latency SLA
production HA / DR
Telegram physical Agent journey
WhatsApp physical Agent journey
long-term memory
RAG
MCP
production autoscaling
production readiness
~~~

## Next gate — A3

A3 should focus on conversational continuity and channel-independent runtime behavior:

~~~text
ConversationContext durability
multi-turn projection/reconstruction
model-unavailable fallback behavior
deterministic bypass where LLM is unnecessary
channel-independent Agent Runtime boundary
replay/audit evidence
~~~

Final verdict:

~~~text
AGENT A2 ✅ SEALED
~~~
