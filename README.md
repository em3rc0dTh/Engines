# Engines

`Engines` is the design and implementation home for a reusable operational orchestration architecture that can support future agentic and non-agentic systems.

## Current version

**mk0 — full local laboratory system-certified**

The first executable specimen is `RegisterNewCustomer`.

Current truth:

```text
B0–B7                              ✅ CERTIFIED
Golden Dataset                    ✅ 18 / 18 PASS
WSL2 + Docker Compose laboratory  ✅ PHYSICALLY PROVEN
Postman manual collection         ✅ 37 / 37 PASS
Full mk0 laboratory               ✅ SYSTEM_CERTIFIED
Production deployment             ❌ NOT CERTIFIED
Broader Engines workflow library  ⏳ FUTURE WORK
```

Primary current receipt:

[`mk0/Build/evidence/mk0-full-local-laboratory-certification-2026-08-26.md`](mk0/Build/evidence/mk0-full-local-laboratory-certification-2026-08-26.md)

## Core architecture

```text
INPUT CHANNELS
CLI / Postman-compatible HTTP now
future channels through adapters
            ↓
        CTA Adapter
            ↓
   canonical operation
            ↓
┌────────────────────────────────────┐
│ TEMPORAL ORCHESTRATION ENGINE      │
│                                    │
│ durable Workflow Execution         │
│ Task Queue / Workers / Activities  │
│ Query / Update                     │
│ retries / replay / recovery        │
│ durable Event History              │
└─────────────────┬──────────────────┘
                  ↓
             Activities
      ┌───────────┼────────────┐
      ↓           ↓            ↓
 PostgreSQL    MongoDB   AttachmentStore
 business      audit/    binary/document
 truth         context   truth
```

The channel is replaceable. Temporal owns durable orchestration. PostgreSQL owns canonical Customer/session business truth. MongoDB owns mandatory application audit/context. AttachmentStore owns binary/document integrity and content-addressed storage.

## What mk0 has physically proven

The complete first specimen has runtime evidence for:

- CLI and Postman-compatible HTTP CTA entry through the same canonical adapter contract;
- structurally invalid start rejection before business execution;
- legal intent-only start into `WAITING_FOR_REQUIRED_DATA`;
- multi-round `ProvideCustomerData` Updates on the same Workflow;
- real Temporal Service, Task Queue, Worker, Activities, Query, Update and Event History;
- CTA process loss without loss of accepted Workflow state;
- completed-session exact replay to the same Workflow/Run;
- typed `SESSION_IDEMPOTENCY_CONFLICT` for materially different reuse of the same business-scoped session;
- PostgreSQL Customer/session persistence and retry safety;
- hard-duplicate resolution without a second Customer;
- soft-duplicate waiting without silently becoming a hard rule;
- mandatory MongoDB audit before terminal success;
- typed failure instead of false success when mandatory audit exhausts retries;
- Worker loss after PostgreSQL Customer creation followed by recovery of the same Workflow/Run without duplicate Customer;
- AttachmentStore stage / resolve / commit;
- SHA-256 integrity verification;
- retry-safe logical attachment identity with content-addressed binary blobs;
- PostgreSQL attachment references without storing binary payloads in business tables;
- mandatory `ATTACHMENT_COMMITTED` evidence before attachment-bearing terminal success;
- post-stage corruption detection with no false successful registration;
- zero Appointment / ResourceReservation / Availability side effects.

## Golden Dataset

```text
GD-001 PASS
GD-002 PASS
GD-003 PASS
GD-004 PASS
GD-005 PASS
GD-006 PASS
GD-007 PASS
GD-008 PASS
GD-009 PASS
GD-010 PASS
GD-011 PASS
GD-012 PASS
GD-013 PASS
GD-014 PASS
GD-015 PASS
GD-016 PASS
GD-017 PASS
GD-018 PASS

18 / 18 PASS
```

The B7 attachment runtime was certified in successful GitHub Actions run:

```text
32896780937
```

against source:

```text
80a95d0b9715f91879a9e0cbd7230828098ba997
```

The core 14 actual Golden case steps were also re-exercised on B7-capable code. The old core job's only failure was its deliberately obsolete pre-B7 assertion that attachments must remain gated.

## Physical local proof

On 2026-08-26 the complete Postman manual-certification collection was executed against the local Windows + WSL2 + Docker Compose laboratory.

```text
Tests               37
Errors              0
Failed assertions   0
Verdict             37 / 37 PASS
```

That proof exercised health, interactive Workflow behavior, multi-round Updates, exact replay, session conflict, AttachmentStore stage/resolve, attachment-bearing Customer registration and negative HTTP contracts.

## First Workflow

> **RegisterNewCustomer**

`RegisterNewCustomer` is the first architecture specimen, not the permanent definition of Engines.

Its certified path is conceptually:

```text
CTA
→ Temporal start
→ RegistrationPolicy
→ wait/update when required
→ duplicate check
→ PostgreSQL Customer or existing-Customer resolution
→ AttachmentStore commit when applicable
→ PostgreSQL attachment linkage when applicable
→ mandatory MongoDB audit
→ PostgreSQL audited finalization
→ CREATED | ALREADY_EXISTS
```

A soft duplicate remains at `WAITING_FOR_DUPLICATE_DECISION`.

## Session identity

Registration session idempotency is business-scoped:

```text
(operation, businessSlug, idempotencyKeyHash)
```

The normalized material initial start is fingerprinted.

```text
same identity + same initial fingerprint
→ same logical Workflow/session
→ same completed Workflow/Run on replay

same identity + different initial fingerprint
→ SESSION_IDEMPOTENCY_CONFLICT
```

Later `ProvideCustomerData` Updates evolve durable Workflow state without rewriting the original fingerprint.

## Current proof surfaces

### CLI

The first command-oriented CTA proof surface.

### Postman-compatible HTTP

A framework-free `node:http` adapter proves a second replaceable transport. Importable Postman material lives under:

```text
mk0/runtime/postman/
```

The HTTP process is not required to stay alive after Temporal accepts the Workflow.

## Persistence authority

- **PostgreSQL** — canonical Customer + registration/idempotency + immutable attachment-reference business truth.
- **MongoDB** — mandatory application execution/audit/context evidence.
- **Temporal** — orchestration authority and durable Event History.
- **AttachmentStore** — binary/document truth with SHA-256 integrity and content-addressed storage.

Temporal's own internal persistence is separate from Engines application business databases.

## Local laboratory profile

```text
Host                  Windows + WSL2
Runtime               Linux WSL
Deployment            Docker Compose
CTA                    localhost:8787
Temporal UI            localhost:8233
Temporal gRPC          localhost:7233
PostgreSQL             private Compose network
MongoDB                private Compose network
AttachmentStore       shared filesystem volume
Public tunnel          none
Cloud dependency       none
```

Production deployment and public exposure are intentionally not inferred from this laboratory proof.

## Repository navigation

- [`mk0/README.md`](mk0/README.md) — architecture/specimen overview.
- [`mk0/Design/`](mk0/Design/) — design decisions and closure decisions.
- [`mk0/Plan/`](mk0/Plan/) — authorization and gate records.
- [`mk0/Test/`](mk0/Test/) — runtime test contract.
- [`mk0/golden-dataset/`](mk0/golden-dataset/) — machine-readable Golden expectations and synthetic fixtures.
- [`mk0/runtime/`](mk0/runtime/) — executable mk0 runtime and local Compose laboratory.
- [`mk0/Build/evidence/`](mk0/Build/evidence/) — stage, Golden and local certification receipts.

## Current gate

B7 is no longer the project gate.

The first specimen is complete as a laboratory proof. The next deliberate step is to select a **second Engines specimen** and prove the architecture is reusable rather than merely successful once.

```text
MK0 / RegisterNewCustomer
       ✅ SYSTEM_CERTIFIED LABORATORY
                    ↓
          SELECT NEXT SPECIMEN
                    ↓
        freeze contract / authority
        Golden Dataset / quarry
                    ↓
        reuse Engines spine
                    ↓
        Build + certify again
```

No future Workflow is implicitly authorized by mk0 completion.

> **Full mk0 local laboratory = certified. Engines as the broader platform = still under construction.**
