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
B3  first CLI CTA Adapter                              ✅ CERTIFIED
B4  Worker + Task Queue + interactive RegisterNewCustomer ← ACTIVE
B5  PostgreSQL duplicate/customer/registration Activities
B6  MongoDB mandatory interaction/audit Activities
B7  AttachmentStore                                    🔒 GATED
```

Certification evidence:

```text
B0 → mk0/Build/evidence/B0-runtime-certification-2026-08-24.md
B1 → mk0/Build/evidence/B1-contracts-policy-certification-2026-08-24.md
B2 → mk0/Build/evidence/B2-temporal-continuity-certification-2026-08-24.md
B3 → mk0/Build/evidence/B3-cli-cta-certification-2026-08-24.md
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

B1 converted the documentation contract into executable pure/deterministic code for start envelopes, Customer draft normalization, `RegistrationPolicy`, required-field evaluation, duplicate classifications, Update input, state/result projections, and business-scoped idempotency/fingerprint material.

## B2 certified Temporal execution plane

B2 proved that the same Workflow ID + Run ID remains durable and visible when Worker #1 is SIGKILLed, a Temporal timer expires with no Worker alive, and a distinct Worker #2 later resumes and completes the same execution from Event History.

## B3 certified CTA boundary

B3 introduced the first replaceable channel implementation:

```text
CLI command + JSON
      ↓
CLI parser
      ↓
CTA Adapter
      ↓
B1 structural validation + normalization
      ↓
canonical RegisterNewCustomerStartEnvelope
      ↓
READY_FOR_ORCHESTRATION
```

B3 certification proved:

- legal intent-only input is accepted without Customer completeness;
- full Customer input is normalized by B1 rather than reimplemented in the CLI;
- unknown/malformed transport input is rejected structurally;
- `channel = cli` is transport metadata;
- CTA has no direct Temporal SDK dependency;
- CTA has no direct PostgreSQL/MongoDB dependency;
- CTA contains no hidden Workflow engine or business Workflow implementation.

## B4 active target — interactive RegisterNewCustomer Workflow

B4 binds the B3 orchestration port to the real Temporal Client and introduces the real `RegisterNewCustomer` Workflow execution.

B4 owns **durable interaction state**, not Customer persistence yet.

B4 may implement:

```text
RegisterNewCustomer Temporal Workflow
real Worker registration on engines-mk0-registration
Temporal Client implementation of RegisterNewCustomerOrchestrationPort
GetRegistrationState Query
ProvideCustomerData Update
policy selection/loading for the frozen Golden business profile
durable Customer draft state
policy-driven missing-field evaluation
WAITING_FOR_REQUIRED_DATA behavior
multi-round Update merge/deduplication by inputId
transition to REQUIRED_DATA_COMPLETE
CTA → Temporal start receipt with Workflow ID / Run ID
Worker restart/reconnect proof while waiting
```

B4 must not pretend persistence exists. Until B5/B6 are present, it must **not** report `CREATED` or `ALREADY_EXISTS` as a successful terminal business outcome.

For B4 certification, a Workflow may remain running after reaching `REQUIRED_DATA_COMPLETE`; the laboratory client may terminate that proof execution after evidence is captured. This is preferable to inventing fake persistence success.

B4 must not:

```text
write PostgreSQL Customer/registration records
perform duplicate lookup
write MongoDB application audit
persist attachments
report CREATED without B5/B6 success
create Appointment/ResourceReservation
introduce Agent/Hermes
```

B4 completes when a real Temporal runtime proves at least:

```text
CLI/adapter input starts one real RegisterNewCustomer Workflow
intent-only start enters WAITING_FOR_REQUIRED_DATA
GetRegistrationState returns missing fields + next action
ProvideCustomerData Update mutates same Workflow execution
multiple Updates can satisfy policy requirements
same Workflow ID + Run ID remains authoritative
Worker restart while waiting does not lose draft state
state reaches REQUIRED_DATA_COMPLETE without fake persistence success
CTA/client reconnect resolves the same durable state
Event History contains Update/restart evidence
```

## Non-negotiable Temporal rule

mk0 must not use:

- an in-process fake Workflow engine;
- a hand-written state-machine loop presented as Temporal;
- database flags as a substitute for Temporal Workflow state;
- a CTA process that must remain alive for Workflow progress;
- a reduced custom orchestrator that bypasses Task Queue/Worker semantics.

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

> **B0 = CERTIFIED. B1 = CERTIFIED. B2 = CERTIFIED. B3 = CERTIFIED. B4 = ACTIVE.**
