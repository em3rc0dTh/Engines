# Agent Layer A2 — Integrated Channel Journey

Date: 2026-09-22

## Goal

Prove the first real Engines journey where natural language crosses the local Agent Layer and changes durable Engine state without giving the model business authority.

~~~text
WebChat
  ↓
AgentAppointmentChannelCore
  ↓
Qwen2.5 1.5B Q4_K_M via llama.cpp
  ↓
validated AgentDecision
  ↓
CanonicalChannelEnvelope
  ↓
AppointmentChannelExecutionCore
  ↓
Temporal / Services / Scheduler / persistence
  ↓
confirmed durable state
  ↓
Agent narration
  ↓
WebChat response
~~~

## Authority boundary

The model never receives a direct Temporal, Scheduler, repository, or database port.

A2 translates a validated `PROPOSE_ACTION` into the same canonical channel envelope already used by deterministic channels.

The existing `AppointmentChannelExecutionCore` remains the only execution path.

## Supported A2 conversational phases

A2 exposes only actions that map cleanly to existing canonical Engine operations:

~~~text
WAITING_FOR_MANAGED_ENTITY
  → SELECT_MANAGED_ENTITY or CREATE_MANAGED_ENTITY

WAITING_FOR_SERVICE
  → SELECT_SERVICE

WAITING_FOR_PRODUCT
  → SELECT_OFFERING

WAITING_FOR_DATE
  → SET_DATE

WAITING_FOR_SLOT
  → SELECT_SLOT

READY_TO_FINALIZE
  → FINALIZE_APPOINTMENT
~~~

Customer capture/resolution remains deterministic in A2.

## Engine projection

The model receives only a bounded projection:

~~~text
phase
workflow status
next action
ManagedEntity candidates / selection
services
offerings
appointment date
available slots
selected slot
issues
terminal result summary
~~~

No database connection, Temporal history, secrets, or provider credentials enter the model context.

## Post-action narration

After a validated action executes, A2 re-reads the durable Appointment state.

Transient phases such as `LOADING_SLOTS` and `RESERVING_APPOINTMENT` are allowed to settle briefly before narration.

The narration pass has:

~~~text
allowedActions = []
~~~

so it can only describe confirmed Engine state and ask naturally for the next user choice. It cannot chain another business action.

## Initial integrated proof

The deterministic setup reaches `WAITING_FOR_DATE`.

Then WebChat natural language drives the tail of the workflow:

~~~text
"Mejor el viernes."
→ SET_DATE
→ Scheduler availability
→ WAITING_FOR_SLOT

"A las <real slot>."
→ SELECT_SLOT
→ READY_TO_FINALIZE

"Sí, confirma."
→ FINALIZE_APPOINTMENT
→ SchedulerReservation
→ Appointment CREATED
~~~

The final durable truth must preserve:

~~~text
managed_entity_id = men_me1_phys_logan
scheduler_reservation_id != NULL
resource_reservation_id = NULL
SchedulerReservation status = RESERVED
assignment_count = 1
~~~

## Resource budget proof

Hard product target remains:

~~~text
4 vCPU
8 GB RAM TOTAL
no GPU
~~~

A2 pins product workloads to CPU 0-3.

Memory accounting is intentionally conservative:

~~~text
running Docker service memory
+ llama-server RSS
+ 1024 MB reserved for OS / Docker daemon
<= 8192 MB
~~~

This is a deployment-footprint budget proof on the CI host. It is not represented as a physical 8 GB hardware/cgroup proof.

A later field/release gate may repeat the same workload on a physically constrained 8 GB node.

## Out of scope

~~~text
natural Customer identity capture
Telegram physical Agent journey
WhatsApp physical Agent journey
multi-user model concurrency
long-term Agent memory
RAG
MCP
production autoscaling
production readiness
~~~
