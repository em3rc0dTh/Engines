# Engines

`Engines` is a reusable operational orchestration architecture built around durable workflows rather than channel-specific business logic.

## Current milestone

**MK0 — OBJECTIVE COMPLETE / LOCAL LABORATORY CERTIFIED**

MK0 proved that the same orchestration spine can support more than one business workflow without moving authority into the CTA/channel layer.

```text
MK0 foundation / RegisterNewCustomer       ✅ CERTIFIED
Golden Customer dataset                   ✅ 18 / 18 PASS
WSL2 + Docker Compose laboratory           ✅ PHYSICALLY PROVEN
Postman Customer collection                ✅ 37 / 37 PASS
Observability + Lab Console                ✅ CERTIFIED
Second specimen / RegisterNewAppointment   ✅ CERTIFIED
Customer Child Workflow reuse              ✅ PROVEN
Service / Product catalog reads            ✅ PROVEN
Date / slot conversation                    ✅ PROVEN
Atomic appointment slot conflict            ✅ PROVEN
Production deployment                       ❌ NOT CERTIFIED
Public/internet exposure                    ❌ NOT CERTIFIED
```

The primary MK0 closure index is [`mk0/README.md`](mk0/README.md). Certification receipts are indexed in [`mk0/Build/evidence/README.md`](mk0/Build/evidence/README.md).

## Proven architecture

```text
CHANNELS / LAB CLIENTS
CLI · Postman-compatible HTTP · Lab Consoles
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
 business    semantic    binary/document
 truth       audit       truth
```

Authority remains separated:

- **Temporal** — durable orchestration and Event History.
- **PostgreSQL** — canonical transactional/business truth.
- **MongoDB** — application execution/audit context; not shadow business truth.
- **AttachmentStore** — binary/document integrity and lifecycle.
- **CTA/channel** — replaceable transport boundary; not business authority.

## Specimen 01 — `RegisterNewCustomer`

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

The Customer Golden Dataset contains 18 certified cases.

## Specimen 02 — `RegisterNewAppointment`

The second specimen proves reuse of the Engines spine rather than a one-off Customer application.

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

The clean Compose certification proved:

- new Customer creation through the existing Child Workflow;
- Car Wash Service and three Product fixtures loaded from PostgreSQL;
- `ayer` / `yesterday` past-date rejection;
- English/Spanish weekday normalization (`Friday` / `viernes`);
- deterministic 30-minute laboratory slots;
- no Appointment before explicit `finish`;
- persisted Appointment creation;
- exact idempotency replay;
- two Workflows selecting the same slot while only one may persist it;
- losing slot-race Workflow returns to durable slot selection with refreshed availability.

The 30-minute slot size and the simplified `default` resource are **MK0 laboratory fixtures**, not a claim that the future Scheduler Engine is complete.

## Repository map

```text
.
├── README.md
├── .github/workflows/          # current active certification workflows only
└── mk0/
    ├── README.md               # canonical MK0 closure/index
    ├── Brainstorming/          # problem framing
    ├── Design/                 # architecture + specimen contracts
    ├── Plan/                   # gates, decisions, closure ledger
    ├── Build/                  # build history + evidence + archived historical CI
    ├── Test/                   # test contracts / specimen certification notes
    ├── mining-site/
    │   └── quarries/           # extracted evidence packages
    ├── golden-dataset/         # Golden / expectation manifests + synthetic fixtures
    └── runtime/                # executable TypeScript/Temporal local laboratory
```

The canonical documentation progression remains:

```text
Brainstorming
→ Mining Site / Quarries
→ Design
→ Plan
→ Golden expectations
→ Build
→ Test / Evidence
```

## Current active CI

Historical B0–B6 stage workflows and the obsolete attachment-free core workflow are preserved under [`mk0/Build/ci-archive/`](mk0/Build/ci-archive/) rather than running on every new PR.

Current active workflows focus on the latest laboratory surface:

- B7/AttachmentStore regression;
- B7 clean Compose certification;
- Lab Console / trace certification;
- `RegisterNewAppointment` certification;
- MK0 release/closure certification.

Historical GitHub Actions runs and their receipts remain part of the evidence chain.

## Local laboratory

```text
Host             Windows + WSL2
Runtime          Linux / Node / TypeScript
Deployment       Docker Compose
CTA              http://127.0.0.1:8787
Temporal gRPC    localhost:7233
Temporal UI      http://localhost:8233
PostgreSQL       private Compose network
MongoDB          private Compose network
AttachmentStore shared Docker filesystem volume
Cloud dependency none
```

From `mk0/runtime`:

```bash
npm ci
npm run check
docker compose up --build -d
curl -fsS http://127.0.0.1:8787/health
```

Interactive Customer laboratory:

```bash
npm run lab:console
```

Interactive Appointment laboratory:

```bash
npm run lab:appointment
```

## Evidence discipline

MK0 preserves these rules:

```text
UNKNOWN != PASS
documented != verified
CI green != product-ready unless the gate proves the product claim
observed != supported
```

A runtime claim must point to an identified source revision and receipt. Documentation-only heads must not be presented as if the runtime was executed against them.

## What MK0 does not claim

MK0 does **not** certify:

- production deployment;
- public exposure/security hardening;
- every channel;
- a finished Scheduler Engine;
- final ResourceReservation/WorkTeam capacity semantics;
- Agent/Hermes;
- a complete Services or Integration Engine;
- the final Engines product/control-room UI.

> MK0 answered the architecture question: **Engines can durably orchestrate and compose multiple business workflows while keeping channels replaceable and persistence authorities explicit.**
