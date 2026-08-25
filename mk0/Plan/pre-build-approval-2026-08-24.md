# mk0 — Pre-Build Approval Record

## Decision

**APPROVED — STAGED BUILD AUTHORIZATION**

Approval date: `2026-08-24`

Approved contract baseline commit:

```text
08b10db302e6d678851047cdac2a82f509fd96f9
```

Authority basis:

> The project authority explicitly instructed the work to continue after the formal pre-Build review and accepted the proposed mk0 construction direction in the active project session.

This record converts that decision into repository evidence.

---

## Authorized scope

The following Build stages are authorized:

```text
B0  runtime/repository skeleton
B1  canonical contracts + versioned RegistrationPolicy
B2  real Temporal runtime/topology + visibility proof
B3  first CLI CTA Adapter
B4  Temporal Worker + Task Queue + interactive RegisterNewCustomer Workflow
B5  PostgreSQL duplicate/customer/registration Activities
B6  MongoDB mandatory interaction/audit Activities
```

The following remains gated:

```text
B7  AttachmentStore implementation
```

B7 may begin only after the physical attachment technology and the synthetic binary fixtures / expected SHA-256 values are frozen.

---

## Approved architecture

```text
Postman / CLI
→ CTA Adapter
→ real Temporal Service
→ RegisterNewCustomer Workflow
→ Activities / ports
→ PostgreSQL + MongoDB + optional AttachmentStore
→ canonical state/result
```

Approved invariants include:

- CTA remains replaceable and does not own durable business process state;
- a structurally legal registration may start with incomplete Customer data;
- versioned RegistrationPolicy defines business completeness;
- Temporal owns durable orchestration, waiting, retry/recovery and progress;
- Workflow code performs no direct database/network/file side effects;
- PostgreSQL owns Customer + registration/idempotency business truth;
- MongoDB owns required application interaction/audit/context evidence;
- mandatory audit evidence gates successful CREATED / ALREADY_EXISTS completion;
- session idempotency is business-scoped;
- the normalized initial start snapshot is fingerprinted;
- later ProvideCustomerData Updates do not rewrite the initial-start fingerprint;
- RegisterNewCustomer produces zero scheduling side effects.

---

## B0 implementation choice

For the first mk0 executable runtime, the project will use:

```text
Language/runtime:        TypeScript on Node.js 20+
Temporal SDK:            @temporalio/* 1.22.0
Temporal local service:  official Temporal CLI development server
Temporal endpoint:       localhost:7233
Temporal Web UI:         localhost:8233
Namespace:               default for B0 laboratory proof
Task Queue:              engines-mk0-registration
PostgreSQL:              local Docker service
MongoDB:                 local Docker service
Web/application framework: none
```

Rationale:

- Temporal's current TypeScript guide supports Node.js 20+;
- the official CLI dev server is a real local Temporal Service with Web UI and default Namespace;
- this keeps B0 framework-neutral while giving us real Workflow/Worker/Task Queue semantics;
- PostgreSQL and MongoDB remain explicit application persistence planes independent from Temporal internal development persistence.

Version changes after this point require an explicit Build decision record rather than silent dependency drift.

---

## Deferred Build choices

Still intentionally deferred until the first stage that needs them:

```text
production Temporal deployment topology
production Temporal persistence
non-default namespace strategy
SDK-specific workflow deployment/versioning mechanism
numeric Activity retry/backoff values beyond B0 smoke proof
PostgreSQL ORM/query library
MongoDB ODM/query library
Postman transport implementation
AttachmentStore technology
attachment size/count/TTL profile
production secrets/encryption/backup profile
```

These choices may not redefine approved Design/Test/Golden behavior.

---

## First authorized ticket

> **B0 — Runtime / Repository Skeleton**

B0 must prove that the repository can reproducibly start the mk0 infrastructure and connect a real Temporal Worker/Client boundary before Customer business behavior is implemented.

B0 is complete only when runtime evidence is captured. Documentation or committed files alone are not sufficient proof.
