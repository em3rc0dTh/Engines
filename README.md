# Engines

`Engines` is the design and implementation home for a reusable operational orchestration architecture that can support future agentic and non-agentic systems.

## Current version

**mk0 — attachment-free core system-certified**

The first executable specimen is `RegisterNewCustomer`.

Current truth:

```text
B0–B6                               ✅ CERTIFIED
attachment-free integrated Golden  ✅ 14 / 14 PASS
B7 AttachmentStore                 🔒 GATED
attachment Golden cases            ⏳ 4 DEFERRED_B7
full mk0                            ⏳ NOT YET COMPLETE
```

The current integrated certification receipt is:

```text
Golden Dataset:  mk0.golden.register-customer.v0
Source SHA:      f0896c58d918e8f3971c78867870243e16a8b604
GitHub run ID:   32873848134
Artifact:        mk0-core-golden-release-32873848134
Digest:          sha256:25fea20c892ea7cd758788ac63a53ba9048b8809599f2b972c5ef77942c2b4e8
Verdict:         ATTACHMENT_FREE_CORE_GOLDEN_PASS
```

See [`mk0/Build/evidence/mk0-core-golden-release-certification-2026-08-25.md`](mk0/Build/evidence/mk0-core-golden-release-certification-2026-08-25.md).

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
        ┌─────────┴─────────┐
        ↓                   ↓
   PostgreSQL             MongoDB
   business truth         audit/context
        │
        └──── future B7 ──→ AttachmentStore
```

The channel is replaceable. Temporal owns durable orchestration. PostgreSQL owns canonical Customer/session business truth. MongoDB owns required application audit/context. AttachmentStore will own binary/document truth only after B7 is separately authorized and implemented.

## What mk0 has physically proven

The attachment-free core has runtime evidence for:

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
- zero Appointment / ResourceReservation / Availability side effects.

## First Workflow

> **RegisterNewCustomer**

`RegisterNewCustomer` is the first architecture specimen, not the permanent definition of Engines.

Its certified attachment-free path is:

```text
CTA
→ Temporal start
→ RegistrationPolicy
→ wait/update when required
→ duplicate check
→ PostgreSQL Customer or existing-Customer resolution
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

A framework-free `node:http` adapter proves a second replaceable transport. An importable Postman collection is stored under:

```text
mk0/runtime/postman/
```

This HTTP process is not required to stay alive after Temporal accepts the Workflow.

## Persistence authority

- **PostgreSQL** — canonical Customer + registration/idempotency business truth.
- **MongoDB** — required application execution/audit/context evidence.
- **Temporal** — orchestration authority and durable Event History.
- **AttachmentStore** — future B7 binary/document authority; not yet runtime-certified.

Temporal's own internal persistence is separate from Engines application business databases.

## Attachment boundary

Attachment support is intentionally not being inferred from the successful core.

The following Golden cases remain explicitly deferred:

```text
GD-003 one attachment
GD-004 multiple attachments
GD-009 transient AttachmentStore failure
GD-010 permanent attachment integrity mismatch
```

B7 cannot enter Build until project authority freezes the physical AttachmentStore technology, synthetic fixtures, expected SHA-256 values and the required integrity/retry/TTL semantics.

## Repository navigation

- [`mk0/README.md`](mk0/README.md) — architecture/specimen overview.
- [`mk0/Design/`](mk0/Design/) — design decisions and closure decisions.
- [`mk0/Plan/`](mk0/Plan/) — authorization and gate records.
- [`mk0/Test/`](mk0/Test/) — frozen runtime test contract.
- [`mk0/golden-dataset/`](mk0/golden-dataset/) — machine-readable Golden expectations.
- [`mk0/runtime/`](mk0/runtime/) — executable mk0 runtime.
- [`mk0/Build/evidence/`](mk0/Build/evidence/) — stage and integrated certification receipts.

## Current gate

The next transition is not another attachment-free core feature.

```text
ATTACHMENT-FREE MK0 CORE
          ✅ SYSTEM CERTIFIED
                 ↓
       PROJECT AUTHORITY B7 DECISION
                 ↓
       AttachmentStore closure + Build
                 ↓
       GD-003/004/009/010
                 ↓
       FULL MK0 GOLDEN CERTIFICATION
```

Until B7 is explicitly authorized and certified, the correct statement is:

> **The attachment-free mk0 core is release-ready as a laboratory core; full mk0 is not yet complete.**
