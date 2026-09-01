# Engines

`Engines` is a reusable operational orchestration architecture built around durable workflows rather than channel-specific business logic.

## Program status

Two truth boundaries are intentionally visible at the same time:

```text
MK0 — ARCHITECTURE FOUNDATION
OBJECTIVE COMPLETE / LOCAL LABORATORY CERTIFIED

MK1 — STAGE 2
ACTIVE / G1 SERVICES ENGINE IN CERTIFICATION
```

MK0 remains the frozen evidence base. MK1 evolves from that certified foundation without rewriting it.

### MK0 — certified foundation

```text
CTA / Channel Adapter core                 ✅ CERTIFIED FOUNDATION
Temporal orchestration core                ✅ CERTIFIED FOUNDATION
Persistence authority model                ✅ CERTIFIED FOUNDATION
RegisterNewCustomer                        ✅ CERTIFIED
RegisterNewAppointment                     ✅ CERTIFIED
Golden Customer dataset                    ✅ 18 / 18 PASS
Postman Customer collection                ✅ 37 / 37 PASS
WSL2 + Docker Compose laboratory            ✅ PHYSICALLY PROVEN
Observability + Lab Console                ✅ CERTIFIED
Customer Child Workflow reuse              ✅ PROVEN
Service / Product catalog seed              ✅ PROVEN
Date / slot conversation                    ✅ PROVEN
Atomic appointment slot conflict            ✅ PROVEN
Production deployment                       ❌ NOT CERTIFIED
Public/internet exposure                    ❌ NOT CERTIFIED
```

The canonical MK0 closure index is [`mk0/README.md`](mk0/README.md). MK0 certification receipts are indexed in [`mk0/Build/evidence/README.md`](mk0/Build/evidence/README.md).

### MK1 — current Services Engine program

```text
G0 — Foundation completeness audit          ✅ CLOSED

G1 — Services Engine
S0 — Runtime promotion                     ✅ CERTIFIED
S1 — Contracts + persistence               ✅ CERTIFIED
S2 — Deterministic read engine             ✅ CERTIFIED
S3 — Eligibility + recommendation          ✅ CERTIFIED
S4 — Versioned management mutations        🔧 NEXT
S5 — Running-Workflow snapshots            ⏭ QUEUED
S6 — Multi-business generality             ⏭ QUEUED
S7 — Appointment integration               ⏭ QUEUED
S8 — Final clean certification             ⏭ QUEUED

G1 SERVICES ENGINE                         ❌ NOT YET FULLY CERTIFIED
G2 SCHEDULER ENGINE                        ⏭ AFTER G1
NEW CTA CHANNEL PROOF                      ⏭ AFTER G2
```

The canonical MK1 index is [`mk1/README.md`](mk1/README.md). The current Services execution plan is [`mk1/Plan/01-services-engine-gates.md`](mk1/Plan/01-services-engine-gates.md), the consolidated test ledger is [`mk1/Test/g1-services-engine-s0-s3.md`](mk1/Test/g1-services-engine-s0-s3.md), and build/evidence provenance is indexed in [`mk1/Build/README.md`](mk1/Build/README.md).

## Architecture foundation

```text
CHANNELS / CLIENTS
CLI · HTTP/Postman · Lab Consoles · future adapters
                ↓
          CTA ADAPTER
 transport parsing / canonicalization
                ↓
       TEMPORAL / ENGINES
 durable Workflow Executions
 Query / Update / Child Workflow
 retry / replay / recovery
                ↓
          ACTIVITIES / PORTS
       ┌────────┼──────────┐
       ↓        ↓          ↓
 PostgreSQL   MongoDB   AttachmentStore
 business    execution    binary/document
 truth       audit        truth
```

Authority remains separated:

- **Temporal** — durable orchestration and Event History.
- **PostgreSQL** — canonical transactional/business truth.
- **MongoDB** — application execution/audit context; not shadow business truth.
- **AttachmentStore** — binary/document integrity and lifecycle.
- **CTA/channel** — replaceable transport boundary; not business authority.

MK1 adds Services capabilities above this foundation; it does not transfer authority away from these boundaries.

## MK0 specimen 01 — `RegisterNewCustomer`

The first specimen proved:

- legal intent-only starts;
- durable multi-round Customer input;
- pragmatic contact validation at the CTA boundary;
- explicit finalization for interactive laboratory sessions;
- business-scoped idempotency and exact completed-session replay;
- hard/soft duplicate semantics;
- PostgreSQL Customer persistence;
- mandatory MongoDB audit before terminal success;
- Worker/CTA process-loss recovery;
- AttachmentStore stage/resolve/commit with SHA-256 integrity;
- stable multiple-phone ordering while fingerprinting remains order-independent;
- read-only unified execution trace and Lab Console.

## MK0 specimen 02 — `RegisterNewAppointment`

The second specimen proved reuse of the Engines spine rather than a one-off Customer application:

```text
RegisterNewAppointment
        ↓
resolve existing Customer
        │
        └─ new Customer → Child Workflow: RegisterNewCustomer
        ↓
load Services from PostgreSQL
        ↓
select Service
        ↓
load Products from PostgreSQL
        ↓
select Product
        ↓
normalize/select date
        ↓
load available slots through Activity
        ↓
select slot
        ↓
READY_TO_FINALIZE
        ↓
finish
        ↓
atomic PostgreSQL booking
        ↓
Mongo appointment audit
        ↓
CREATED
```

The 30-minute slot size and simplified `default` resource remain MK0 laboratory fixtures, not a claim that Scheduler Engine is complete.

## MK1 Services Engine — certified boundary through S3

The Services build now has an executable generic domain rather than only the MK0 Appointment catalog seed.

### S1 domain/persistence foundation

The Services model currently represents:

```text
Business
  └─ Service
       └─ Offering
            ├─ revision / lifecycle
            ├─ duration
            ├─ pricing
            ├─ requirements
            ├─ dependencies
            ├─ eligibility rules
            ├─ priority
            └─ tags
```

PostgreSQL remains canonical catalog truth.

### S2 deterministic reads

Certified read operations:

```text
ListServices
GetService
ListOfferings
GetOffering
```

The S2 certification proved deterministic ordering, business isolation, inactive-list filtering, explicit historical lookup, complete Offering hydration, revision visibility, Appointment compatibility and vertical-neutral repository behavior.

### S3 deterministic recommendation

Certified pure operations:

```text
evaluateOfferingEligibility
ecommendOfferings
```

Correction: the executable API name is:

```text
recommendOfferings
```

S3 proves same-input deterministic decisions, stable ranking, explicit failure reasons, fail-closed malformed rules, requirement/dependency participation, persisted catalog hydration and no Agent/LLM dependency.

S3 certification authority:

```text
Source SHA       a6974cdbb669b66a07b8780d5e20c960d6a0cd64
Run              33531884206
Job              99936776923
Artifact         9810084527
Artifact SHA256  fa6a9efaa67309a4255dbce62fe362402ff453643e90f63c82c1457099e9de60
```

The first S3 run failed strict test typechecking and is retained as provenance; the passing run above is the only S3 certification authority.

## What comes next

S4 must add catalog management through orchestration authority:

```text
CreateService
UpdateService
SetServiceStatus
CreateOffering
UpdateOffering
SetOfferingStatus
```

It must prove business-scoped idempotency, exact replay, material conflict, optimistic revision protection, retry safety and audit semantics without allowing channel code or Workflow code to mutate PostgreSQL directly.

S5 will then prove the critical temporal boundary: a running Workflow that selected revision `N` must keep revision `N` even if the live catalog advances to `N+1`, unless an explicit refresh is part of the contract.

## Repository map

```text
.
├── README.md
├── .github/workflows/
│   ├── mk0-*                         # current MK0 regression/certification workflows
│   └── mk1-s0 ... mk1-s3-*           # Stage-2 Services certification workflows
├── mk0/
│   ├── README.md                     # frozen MK0 closure/index
│   ├── Brainstorming/
│   ├── Design/
│   ├── Plan/
│   ├── Build/
│   ├── Test/
│   ├── mining-site/quarries/
│   ├── golden-dataset/
│   └── runtime/                      # frozen certified local laboratory
└── mk1/
    ├── README.md                     # active Stage-2 index
    ├── Brainstorming/
    ├── Design/
    ├── Plan/
    ├── Build/                        # build history + evidence index
    ├── Test/                         # consolidated gate verification
    ├── mining-site/quarries/
    ├── golden-dataset/
    └── runtime/                      # active MK1 executable laboratory
```

Canonical documentation progression:

```text
Brainstorming
→ Mining Site / Quarries
→ Design
→ Plan
→ Golden expectations
→ Build
→ Test / Evidence
→ Certification
```

## Current active CI

MK0 active workflows continue to protect the frozen architecture surface. MK1 currently has dedicated certification workflows for:

- S0 runtime promotion;
- S1 Services contracts/persistence;
- S2 deterministic Services reads;
- S3 Services eligibility/recommendation.

Each gate records source revision, workflow run, job and artifact provenance in `mk1/Build/evidence/`.

## Local laboratories

### Frozen MK0 laboratory

From `mk0/runtime`:

```bash
npm ci
npm run check
docker compose up --build -d
curl -fsS http://127.0.0.1:8787/health
```

### Active MK1 laboratory

`mk1/runtime` is the Stage-2 executable laboratory. It began from the exact certified MK0 runtime tree at S0 and now contains the Services Engine work certified through S3.

The same authority topology remains:

```text
Temporal gRPC    localhost:7233
Temporal UI      http://localhost:8233
CTA              http://127.0.0.1:8787
PostgreSQL       private Compose network
MongoDB          private Compose network
AttachmentStore shared Docker filesystem volume
```

## Evidence discipline

The repository preserves these rules across milestones:

```text
UNKNOWN != PASS
documented != verified
CI green != product-ready unless the gate proves the product claim
observed != supported
failed attempt != erased provenance
runtime source SHA != later documentation-only head
```

A runtime claim must point to an identified source revision and receipt.

## Explicit non-claims

The repository does **not** currently certify:

- G1 Services Engine as fully complete;
- Scheduler Engine;
- Integration Engine;
- full omnichannel support;
- production deployment/security hardening;
- production S3/MinIO storage;
- natural-language/general intent classification;
- Agent/Intelligence layer;
- final Ground Control/product control-room UI.

> MK0 answered: **Can Engines durably orchestrate multiple business workflows while keeping channels replaceable and persistence authorities explicit? — Yes, locally certified.**
>
> MK1 G1 is now answering: **Can the same foundation expose a generic, version-aware, deterministic Services capability that works without an Agent? — S0–S3 are certified; S4–S8 remain.**
