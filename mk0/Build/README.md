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
B1  canonical contracts + versioned RegistrationPolicy ← ACTIVE
B2  real Temporal runtime/topology + visibility proof
B3  first CLI CTA Adapter
B4  Worker + Task Queue + interactive RegisterNewCustomer
B5  PostgreSQL duplicate/customer/registration Activities
B6  MongoDB mandatory interaction/audit Activities
B7  AttachmentStore                                    🔒 GATED
```

B0 certification evidence:

```text
mk0/Build/evidence/B0-runtime-certification-2026-08-24.md
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

## B0 certified runtime

```text
Language/runtime:        TypeScript / Node.js 20+
Certified Node runtime:  v24.19.0
Temporal TypeScript SDK: 1.22.0
Temporal CLI:            1.8.1
Temporal Server observed:1.31.2
Temporal Web UI observed:2.50.1
Temporal endpoint:       localhost:7233
Temporal Web UI:         localhost:8233
Namespace:               default
Task Queue:              engines-mk0-registration
PostgreSQL observed:     17.8
MongoDB observed:        8.0.29
Web/application framework: none
```

Dependency resolution is frozen through the committed `mk0/runtime/package-lock.json`, and certification uses `npm ci`.

## B1 active target

B1 creates the executable **canonical interaction contracts** and **versioned RegistrationPolicy model** required by later Temporal Workflow code.

B1 may implement only pure/deterministic contract and policy logic such as:

```text
RegisterNewCustomer start envelope
canonical Customer draft shape used by mk0
GetRegistrationState projection contract
ProvideCustomerData input contract
RegistrationPolicy schema/version
required-field evaluation
normalization contract
HARD_UNIQUE / SOFT_MATCH / NON_UNIQUE duplicate-rule representation
start-session idempotency material / fingerprint contract
safe validation result / typed contract errors
Golden Dataset policy fixture mapping
```

B1 must **not** yet:

```text
start a production RegisterNewCustomer Temporal Workflow
write PostgreSQL Customer rows
write MongoDB audit events
implement AttachmentStore
implement Postman HTTP transport
create Appointment/ResourceReservation behavior
introduce an Agent/Hermes
```

B1 is complete only when its pure contract/policy tests pass against the frozen Test/Golden expectations relevant to the contract layer.

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

## B0 closure

B0 is no longer an open gate.

Certified evidence proves:

```text
locked dependency installation                 PASS
TypeScript type-check                          PASS
Compose model                                  PASS
PostgreSQL connectivity                        PASS
MongoDB connectivity                           PASS
real Temporal Service                          PASS
Temporal Web UI                                PASS
real Worker / Task Queue                       PASS
real smoke Workflow with Workflow ID / Run ID  PASS
structured evidence artifact                   PASS
no Customer/Appointment business schema        PASS
```

> **B0 = CERTIFIED. B1 = ACTIVE.**
