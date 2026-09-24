# Agent Layer A5 — Conversational Intake & Progressive Distillation

Date: 2026-09-24

## Product intent

A5 removes the visible form/wizard as the primary human experience.

A human may begin with free text such as:

~~~text
Tengo un problema con la suspensión de mi carro.
~~~

The top layer should answer naturally, for example:

~~~text
Hola, soy <agentName>, parte del staff de <businessName>. Cuéntame un poco más sobre el problema.
~~~

While the conversation continues, A5 progressively distills conversational evidence and only crosses into Engines through already-existing canonical actions.

## Hard boundary

~~~text
CORE DIFF = 0
~~~

A5 must not change authority, semantics, contracts, persistence rules, or business truth in the solid Engines layers.

Forbidden A5 implementation changes include:

~~~text
Customer contracts/core
ManagedEntity contracts/core
Services contracts/core
Scheduler contracts/core
Appointment contracts/core
Temporal workflows/activities/workers
Integration core
PostgreSQL/Mongo persistence
canonical Channel execution semantics
~~~

A5 may change only the conversational/Agent experience and transport-facing wiring required to invoke already-existing canonical operations.

## Business-scoped experience profile

Agent identity and business presentation are tenant/customer configuration, not process-global runtime settings.

~~~text
businessSlug
    ↓
A5BusinessExperienceProfileResolver
    ↓
businessDisplayName
agentProfile.identity
agentProfile.personality
agentProfile.voice
~~~

A single A5 process may serve multiple business customers with different agent identities and branding. No `ENGINES_AGENT_NAME`, `ENGINES_AGENT_ROLE`, or `ENGINES_AGENT_BUSINESS_NAME` process-global authority is allowed.

The current lab adapter reads a business-keyed configuration file/JSON. That adapter is intentionally replaceable by Ground Control or onboarding configuration later without changing the solid Engines core or the A5 conversation contract.

Unknown/unconfigured businesses receive an isolated generic profile using their own `businessSlug`; they must never inherit another tenant's profile.

## Architecture

~~~text
Human free-form conversation
        ↓
A5 Conversational Experience
        ├── natural staff identity / tone
        ├── progressive distillation
        │     observed
        │     inferred
        └── optional proposed action
                 ↓
          A0 AgentDecision validation
                 ↓
       existing canonical Channel action
                 ↓
╔══════════════════════════════════════╗
║ SOLID ENGINES CORE — UNCHANGED       ║
║ Customer · ManagedEntity · Services  ║
║ Scheduler · Appointment · Temporal   ║
║ Persistence · Integration            ║
╚══════════════════════════════════════╝
~~~

## Truth states

A5 distinguishes:

~~~text
OBSERVED
directly stated by the human

INFERRED
conversation interpretation; not business truth

CONFIRMED
returned by the existing Engine projection after canonical execution
~~~

Only the Engine may create CONFIRMED operational truth.

## A5 S0 build

1. First free-form message silently creates the existing Appointment workflow through `START_APPOINTMENT`.
2. No Start Workflow button is required in A5 mode.
3. A5 identifies itself using configurable agent/business display names.
4. The model returns a natural reply plus bounded observed/inferred distillation.
5. If an Engine action is justified, A5 converts it to an A0 `AgentDecision` and validates it against the current allowed-actions projection.
6. Customer name can enter the existing `PROVIDE_CUSTOMER` action only when explicitly supplied.
7. Existing deterministic A4 bypass remains available for unambiguous vehicle/service/offering/date/slot/finalization input.
8. A3 durable turn ledger remains the conversation/replay authority.
9. No new business persistence table is introduced.
10. WebChat uses one natural composer for the whole journey.

## Initial proof

The first physical A5 test starts with:

~~~text
Tengo un problema con la suspensión de mi carro.
~~~

PASS requires:

~~~text
no Start Workflow click
workflow created silently
natural staff introduction visible
problem_statement observed
suspension/vehicle context may be inferred but is not Engine-confirmed
no unrelated Service selected
no Engine action invented
subsequent turns remain one natural conversation
existing A0-A4 and solid-core regressions remain green
CORE_DIFF_ZERO_PASS
~~~

A5 S0 does not claim diagnosis capability, universal intent understanding, or autonomous multi-action execution.
