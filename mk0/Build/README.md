# Build — mk0

## Status

**AUTHORIZED — STAGED B0–B6**

Approval record:

```text
mk0/Plan/pre-build-approval-2026-08-24.md
```

Current Build position:

```text
B0  runtime/repository skeleton                         ✅ CERTIFIED
B1  canonical contracts + versioned RegistrationPolicy ✅ CERTIFIED
B2  real Temporal runtime/topology + visibility proof  ✅ CERTIFIED
B3  first CLI CTA Adapter                              ← ACTIVE
B4  Worker + Task Queue + interactive RegisterNewCustomer
B5  PostgreSQL duplicate/customer/registration Activities
B6  MongoDB mandatory interaction/audit Activities
B7  AttachmentStore                                    🔒 GATED
```

Certification evidence:

```text
B0 → mk0/Build/evidence/B0-runtime-certification-2026-08-24.md
B1 → mk0/Build/evidence/B1-contracts-policy-certification-2026-08-24.md
B2 → mk0/Build/evidence/B2-temporal-continuity-certification-2026-08-24.md
```

`B7 AttachmentStore` remains explicitly gated until attachment technology + synthetic fixtures + expected SHA-256 values are frozen.

No application/web framework is selected or required for mk0.

## Authorized build target

```text
CTA channel
   CLI first
   Postman transport later
        ↓
CTA Adapter contract
        ↓
FULL TEMPORAL ORCHESTRATION ENGINE
   Temporal Service
   Workflow
   Task Queue
   Worker
   Activities
   durable Event History
   retry/recovery/query/update semantics
        ↓
Persistence Activities
   ├── PostgreSQL → Customer + registration/idempotency truth
   ├── MongoDB    → execution/audit/workflow context
   └── AttachmentStore → B7 gated
```

## Certified runtime baseline

```text
Language/runtime:         TypeScript / Node.js 20+
Certified Node runtime:   v24.19.0
Temporal TypeScript SDK:  1.22.0
Temporal CLI:             1.8.1
Temporal Server observed: 1.31.2
Temporal Web UI observed: 2.50.1
Temporal endpoint:        localhost:7233
Temporal Web UI:          localhost:8233
Namespace:                default
Task Queue:               engines-mk0-registration
PostgreSQL observed:      17.8
MongoDB observed:         8.0.29
Web/application framework: none
```

Dependency resolution is frozen through the committed `mk0/runtime/package-lock.json`, and certification uses `npm ci`.

## B1 certified contract layer

B1 converted the documentation contract into executable pure/deterministic code:

```text
RegisterNewCustomer start envelope
Customer draft/contact/document/phone types
ProvideCustomerData input contract
Registration state/result projections
structural start/Update validation
Customer normalization + patch merge
versioned RegistrationPolicy
policy-driven required-field evaluation
HARD_UNIQUE / SOFT_MATCH / NON_UNIQUE representation
Golden RegistrationPolicy v1 fixture
business-scoped session identity material
normalized initial-start fingerprint material
canonical serialization/comparison
Golden-oriented contract tests
```

B1 preserved the approved boundary:

- missing Customer business-completeness fields do not become CTA/start validation failures;
- `businessSlug` + operation + idempotency identity remain the logical session scope;
- channel/correlation metadata is excluded from initial-start fingerprint material;
- later Customer patches evolve draft state without redefining initial-start identity;
- policy controls document/attachment requirements instead of universal hard-coding;
- no DB, transport, AttachmentStore or production business Workflow side effects exist in B1.

## B2 certified Temporal execution plane

B2 proved that Workflow execution truth survives Worker process loss and remains owned by Temporal.

Certified experiment:

```text
real Temporal Service + Web UI
Worker #1 starts b2ContinuitySmoke
Query observes WAITING_ON_TEMPORAL_TIMER
Worker #1 receives SIGKILL
timer expires with no Worker alive
same Workflow ID + Run ID remains RUNNING in Temporal visibility
Worker #2 starts as a distinct process
Worker #2 recovers the same execution
same Workflow ID + Run ID reaches COMPLETED
Event History captured
```

Observed Event History includes:

```text
WORKFLOW_EXECUTION_STARTED
TIMER_STARTED
TIMER_FIRED
WORKFLOW_TASK_TIMED_OUT
WORKFLOW_TASK_SCHEDULED
WORKFLOW_TASK_STARTED
WORKFLOW_TASK_COMPLETED
WORKFLOW_EXECUTION_COMPLETED
```

The timeout is retained as evidence: Temporal recovered from interrupted Workflow processing and completed the same durable execution.

B2 introduced no Customer, audit, attachment or scheduling side effects.

## B3 active target — first CLI CTA Adapter

B3 implements the first replaceable channel boundary in front of Engines.

The CLI is a **transport**, not business authority.

B3 may implement:

```text
CLI input parsing
channel metadata capture
CTA Adapter interface
canonical RegisterNewCustomer start-envelope construction
structural/session validation through the B1 contract
normalization of accepted transport input
stable adapter result/error projection
orchestration port/interface for later Temporal binding
CLI contract tests
```

B3 must preserve this boundary:

```text
CLI-specific input
      ↓
CLI parser
      ↓
CTA Adapter
      ↓
canonical RegisterNewCustomer envelope
      ↓
Orchestration port
```

B3 must **not**:

```text
write PostgreSQL or MongoDB directly
own Customer completeness rules
hard-code business-required fields in the CLI
implement a fake Workflow engine
implement production RegisterNewCustomer orchestration before B4
implement duplicate lookup before B5
implement AttachmentStore
implement scheduling
introduce Agent/Hermes
```

A legal intent-only command must be accepted by the CTA boundary when it contains the minimum structural/session fields, even when Customer business fields are incomplete. That incomplete Customer state will become a durable waiting state only when B4 binds the adapter to the real `RegisterNewCustomer` Workflow.

B3 completes when executable CLI/adapter tests prove:

```text
valid intent-only input → canonical accepted envelope
full Customer input → canonical accepted envelope
malformed/unknown operation → structural rejection
missing businessSlug → structural rejection
missing idempotency identity → structural rejection
channel/correlation metadata preserved as metadata but not business authority
no direct persistence writes/imports
no business Workflow implementation hidden inside the adapter
```

## Non-negotiable Temporal rule

mk0 must not use:

- an in-process fake Workflow engine;
- a hand-written state-machine loop presented as Temporal;
- database flags as a substitute for Temporal Workflow state;
- a CTA process that must remain alive for Workflow progress;
- a reduced custom orchestrator that bypasses Task Queue/Worker semantics.

Later Workflow proof must continue to use a real Temporal Service, real Workflow execution, real Task Queue dispatch, real Worker execution and real Activity retry/recovery behavior.

## CTA rule

The channel and adapter remain replaceable.

```text
CLI first
Postman next
Form later
WhatsApp later
Telegram later
API/Webhook later
...
    ↓
CTA Adapter
    ↓
Temporal
```

A structurally legal registration session may start with incomplete Customer business data. Customer completeness is resolved by the versioned `RegistrationPolicy` inside Temporal.

## Frozen constraints

- no web framework dependency in the architecture;
- all channels converge on one CTA Adapter contract;
- CTA validates structural/session input before Temporal start, not final Customer completeness;
- CTA/adapter never writes business persistence directly;
- Temporal owns durable sequencing/retries/recovery;
- real Task Queue/Worker semantics are required;
- Workflow code calls no DB/file/network driver directly;
- Activities are retry-safe/idempotent;
- registration session identity is business-scoped by `(operation, businessSlug, idempotencyKeyHash)`;
- normalized material initial-start input is fingerprinted for exact replay/conflict detection;
- later `ProvideCustomerData` Updates evolve Workflow state without rewriting the initial-start fingerprint;
- PostgreSQL is canonical Customer + registration/idempotency truth;
- MongoDB stores execution/audit/workflow context, not a shadow Customer truth;
- required MongoDB success-gating milestones must exist before `CREATED` or `ALREADY_EXISTS` is reported as successful;
- exhausted mandatory-audit failure cannot be converted into success;
- attachments use a separate persistence contract and remain gated in B7;
- CTA disconnect must not stop an accepted Workflow;
- Worker restart must not lose accepted Workflow progress;
- CTA reconnect/query must resolve the same durable outcome;
- RegisterNewCustomer creates zero scheduling side effects.

> **B0 = CERTIFIED. B1 = CERTIFIED. B2 = CERTIFIED. B3 = ACTIVE.**
