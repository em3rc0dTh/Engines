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
B2  real Temporal runtime/topology + visibility proof  ← ACTIVE
B3  first CLI CTA Adapter
B4  Worker + Task Queue + interactive RegisterNewCustomer
B5  PostgreSQL duplicate/customer/registration Activities
B6  MongoDB mandatory interaction/audit Activities
B7  AttachmentStore                                    🔒 GATED
```

Certification evidence:

```text
B0 → mk0/Build/evidence/B0-runtime-certification-2026-08-24.md
B1 → mk0/Build/evidence/B1-contracts-policy-certification-2026-08-24.md
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

## B2 active target

B2 must strengthen the **Temporal execution plane itself**, independently from Customer business behavior.

B0 already proved that a real Temporal Service/Worker/Task Queue/Workflow can execute. B2 now proves that this runtime is a reusable orchestration substrate with explicit topology, visibility and continuity semantics.

B2 may implement laboratory-only orchestration proof such as:

```text
central Temporal topology/config contract
shared Temporal Client/Worker bootstrap boundaries
explicit namespace + Task Queue identity
visibility/list/describe evidence
real Event History retrieval/evidence
long-running continuity smoke Workflow
Worker stop/restart while Workflow remains durable
same Workflow completion after Worker restart
runtime health/diagnostic probe
replay/version-compatibility build decision record
```

B2 must **not** yet implement `RegisterNewCustomer` business orchestration. That belongs to B4 after the CTA boundary in B3.

B2 must not:

```text
write Customer business data
write MongoDB application audit
implement duplicate lookup
implement AttachmentStore
implement Postman transport
create Appointment/ResourceReservation behavior
introduce Agent/Hermes
```

B2 completes only when a real Temporal runtime test proves visibility + durable Worker restart/continuity and produces structured evidence.

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

> **B0 = CERTIFIED. B1 = CERTIFIED. B2 = ACTIVE.**
