# Engines

`Engines` is a reusable operational orchestration architecture built around durable workflows rather than channel-specific business logic.

## Program status

```text
MK0 — ARCHITECTURE FOUNDATION
OBJECTIVE COMPLETE / LOCAL LABORATORY CERTIFIED

MK1 — STAGE 2
ACTIVE / G1 SERVICES ENGINE IN CERTIFICATION
```

MK0 remains the frozen evidence base. MK1 evolves from that certified foundation without rewriting `mk0/runtime`.

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

Canonical MK0 index: [`mk0/README.md`](mk0/README.md). Evidence index: [`mk0/Build/evidence/README.md`](mk0/Build/evidence/README.md).

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

Canonical MK1 index: [`mk1/README.md`](mk1/README.md). Services plan: [`mk1/Plan/01-services-engine-gates.md`](mk1/Plan/01-services-engine-gates.md). Consolidated test ledger: [`mk1/Test/g1-services-engine-s0-s3.md`](mk1/Test/g1-services-engine-s0-s3.md). Build/evidence provenance: [`mk1/Build/README.md`](mk1/Build/README.md).

## Architecture authority model

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
- **MongoDB** — execution/audit context; not shadow business truth.
- **AttachmentStore** — binary/document integrity and lifecycle.
- **CTA/channel** — replaceable transport boundary; not business authority.

## MK0 specimens

`RegisterNewCustomer` proved durable multi-round input, explicit finalization, business-scoped idempotency, duplicate semantics, PostgreSQL persistence, mandatory MongoDB audit, Worker/CTA recovery, AttachmentStore integrity and unified trace/Lab Console.

`RegisterNewAppointment` proved reuse of that orchestration spine:

```text
Customer resolution
→ optional RegisterNewCustomer Child Workflow
→ Service
→ Product
→ date
→ slot
→ explicit finalize
→ atomic PostgreSQL booking
→ Mongo audit
→ CREATED
```

The 30-minute slot size and simplified `default` resource remain MK0 laboratory fixtures, not a finished Scheduler Engine.

## MK1 Services Engine — certified boundary through S3

The generic Services domain now represents:

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

Certified operations:

```text
ListServices
GetService
ListOfferings
GetOffering
```

S2 proved deterministic ordering, business isolation, active-list filtering, explicit historical lookup, complete Offering hydration, revision visibility, Appointment compatibility and a vertical-neutral repository implementation.

### S3 deterministic eligibility/recommendation

Certified pure operations:

```text
evaluateOfferingEligibility
recommendOfferings
```

S3 proves same-input deterministic decisions, stable ranking (`priority DESC → name ASC → offeringId ASC`), explicit reason codes, fail-closed malformed rules, requirement/dependency participation, persisted catalog hydration and no Agent/LLM dependency.

Certification authority:

```text
Source SHA       a6974cdbb669b66a07b8780d5e20c960d6a0cd64
Run              33531884206
Job              99936776923
Artifact         9810084527
Artifact SHA256  fa6a9efaa67309a4255dbce62fe362402ff453643e90f63c82c1457099e9de60
```

The earlier S3 run `33531803288` failed strict test typechecking and remains documented as failure provenance. Only the successful run above is certification authority.

## Next gate — S4

S4 must add management through orchestration authority:

```text
CreateService
UpdateService
SetServiceStatus
CreateOffering
UpdateOffering
SetOfferingStatus
```

It must prove business-scoped idempotency, exact replay, material conflict, optimistic revision protection, retry safety and audit semantics without allowing channel code or Workflow code to mutate PostgreSQL directly.

S5 will then prove that a running Workflow which selected catalog revision `N` keeps revision `N` even if live catalog state advances to `N+1`, unless an explicit refresh is part of the contract.

## Repository map

```text
.
├── README.md
├── .github/workflows/
│   ├── mk0-*                       # frozen-foundation regressions
│   └── mk1-s0 ... mk1-s3-*         # current Services certifications
├── mk0/
│   ├── README.md
│   ├── Brainstorming/ Design/ Plan/ Build/ Test/
│   ├── mining-site/quarries/
│   ├── golden-dataset/
│   └── runtime/                    # frozen certified lab
└── mk1/
    ├── README.md
    ├── Brainstorming/ Design/ Plan/ Build/ Test/
    ├── mining-site/quarries/
    ├── golden-dataset/
    └── runtime/                    # active Stage-2 lab
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

## Laboratories

Frozen MK0:

```bash
cd mk0/runtime
npm ci
npm run check
docker compose up --build -d
```

Active MK1:

```bash
cd mk1/runtime
npm ci
npm run check
docker compose up --build -d
```

Current local topology remains Temporal `localhost:7233`, Temporal UI `localhost:8233`, CTA `127.0.0.1:8787`, with PostgreSQL/MongoDB private to Compose and AttachmentStore on the shared filesystem volume.

## Evidence discipline

```text
UNKNOWN != PASS
documented != verified
CI green != product-ready unless the gate proves the claim
observed != supported
failed attempt != erased provenance
runtime source SHA != later documentation-only head
```

## Explicit non-claims

The repository does **not** currently certify G1 as fully complete, Scheduler Engine, Integration Engine, omnichannel support, production deployment/security hardening, production S3/MinIO, general natural-language intent classification, Agent/Intelligence layer, or the final Ground Control/control-room UI.

> MK0 answered: **Can Engines durably orchestrate multiple business workflows while keeping channels replaceable and persistence authorities explicit? — Yes, locally certified.**
>
> MK1 G1 is answering: **Can that foundation expose a generic, version-aware, deterministic Services capability without an Agent? — S0–S3 are certified; S4–S8 remain.**
