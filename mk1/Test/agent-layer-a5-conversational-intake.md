# Agent Layer A5 — Conversational Intake Human Trial

Date: 2026-09-24

## Goal

Prove that the human can begin with natural language while the solid Engines core remains unchanged.

Initial human message:

~~~text
Tengo un problema con la suspensión de mi carro.
~~~

The human must not click `Start Workflow`.

## Expected visible behavior

The Agent should answer naturally with its configured identity and business identity, for example:

~~~text
Hola, soy <agentName>, parte del staff de <businessName>. Cuéntame un poco más sobre el problema.
~~~

Exact wording is not required.

The response must not expose workflow phases, canonical ids, action names, internal architecture, or slot/field terminology.

The developer-only side panel may expose durable Workflow state and A5 distillation evidence.

## Expected hidden behavior

After the first message:

~~~text
existing START_APPOINTMENT canonical action executed silently
Appointment Workflow exists
Engine remains authoritative
customer identity is still unconfirmed
no Service is selected merely because "suspensión" was mentioned
~~~

Expected A5 distillation shape:

~~~text
observed:
  problem_statement = ...

inferred:
  managed_entity_type = vehicle
  service_intent/domain may reference suspension

confirmed:
  only data actually returned by Engines
~~~

An inferred suspension concern is not permission to map to an unrelated catalog Service.

## Progressive conversation

The user should be able to continue with natural turns such as:

~~~text
Cuando paso por un bache escucho un golpe seco adelante.

Parece venir del lado derecho. Es mi Logan.

Soy Eduardo.
~~~

A5 may understand the concern before asking identity. When customer identity is eventually supplied, it must cross:

~~~text
A5 model output
→ A0 AgentDecision validation
→ existing PROVIDE_CUSTOMER
→ existing Temporal/Customer resolution
~~~

The same rule applies to later ManagedEntity, Service, Offering, Date, Slot and confirmation actions.

## Core isolation proof

A5 implementation is rejected if it changes any solid-core authority surface.

The gate must emit:

~~~text
CORE_DIFF_ZERO_PASS
~~~

Forbidden change classes include Customer/ManagedEntity/Appointment contracts, Services, Scheduler, Temporal, Integration, persistence repositories/migrations, and canonical AppointmentChannelExecutionCore semantics.

## Real-model regression gate

The exact first physical-trial phrase must also pass against the certified Dockerized Qwen runtime:

~~~text
Tengo un problema con la suspensión de mi carro.
~~~

The real-model probe must produce valid structured A5 output before the human retry. A mocked provider is not sufficient evidence.

A5 has a dedicated 192-token output cap for the combined natural reply + progressive distillation. This does not alter the existing A0 action-adapter budget.

## S0 PASS

~~~text
free-form first message works
no Start Workflow click
workflow starts silently through existing canonical action
natural staff introduction visible
progressive observed/inferred data exists
no invented business truth
A0 validates any proposed action
A3 durable runtime remains turn/replay authority
A4 deterministic bypass remains usable
CORE_DIFF_ZERO_PASS
real Qwen first-turn probe green
A0-A4 regressions green
~~~

S0 is a conversational-experience gate. It does not certify diagnosis quality, a complete suspension-service catalog, autonomous multi-action execution, or production readiness.
