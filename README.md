# Engines

`Engines` is a reusable operational orchestration architecture built around durable workflows rather than channel-specific business logic.

## Program status

```text
MK0 — ARCHITECTURE FOUNDATION
OBJECTIVE COMPLETE / LOCAL LABORATORY CERTIFIED

MK1 — STAGE 2
ACTIVE
Services S0–S6 certified
S7 Appointment→Services integration next
WebChat C1A visible flow certified + human verified
WebChat C1B durable channel certified + human restart verified
Scheduler Step 4 designed, not yet built/certified
Telegram adapter designed, physical proof deferred
Agent / MCP intentionally absent
```

MK0 remains the frozen evidence base. MK1 evolves from that foundation without rewriting `mk0/runtime`.

## Branch narrative

Repository branch policy is documented in [`BRANCHES.md`](BRANCHES.md).

Meaningful current milestones include:

```text
release/mk0-complete
build/mk0-b3-cli-cta-adapter
build/mk0-http-postman-proof
build/mk1-s5-services-snapshots
build/mk1-c0-c1-webchat
build/mk1-c1b-durable-channel
design/mk1-services-scheduler-integration
build/mk1-s6-services-multibusiness
```

Every new bounded architecture gate gets a new branch. Intermediate/scratch branches are not permanent evidence authorities.

## MK0 — certified foundation

```text
CTA / Channel Adapter core                 ✅ CERTIFIED FOUNDATION
Temporal orchestration core                ✅ CERTIFIED FOUNDATION
Persistence authority model                ✅ CERTIFIED FOUNDATION
RegisterNewCustomer                        ✅ CERTIFIED
RegisterNewAppointment                     ✅ CERTIFIED
Golden Customer accounting                 ✅ 18 / 18 PASS
Postman Customer collection                ✅ 37 / 37 PASS
WSL2 + Docker Compose laboratory            ✅ PHYSICALLY PROVEN
Observability + Lab Console                ✅ CERTIFIED
Customer Child Workflow reuse              ✅ PROVEN
Service/Product catalog seed                ✅ PROVEN
Date/slot conversation                      ✅ PROVEN
Atomic Appointment slot conflict            ✅ PROVEN
Production deployment                       ❌ NOT CERTIFIED
Public exposure/security hardening          ❌ NOT CERTIFIED
```

Canonical MK0 index: [`mk0/README.md`](mk0/README.md).

## MK1 — Step 3 Services Engine

```text
G0 Foundation completeness audit           ✅ CLOSED

G1 Services Engine
S0 Runtime promotion                       ✅ CERTIFIED
S1 Contracts + persistence                 ✅ CERTIFIED
S2 Deterministic read engine               ✅ CERTIFIED
S3 Eligibility + recommendation            ✅ CERTIFIED
S4 Versioned management mutations          ✅ CERTIFIED
S5 Running-Workflow snapshots              ✅ CERTIFIED
S6 Multi-business generality               ✅ CERTIFIED
S7 Appointment integration                 🔧 NEXT
S8 Final clean certification               ⏭ QUEUED

G1 SERVICES ENGINE                         ❌ NOT YET FULLY CERTIFIED
```

S6 authority:

```text
Branch           build/mk1-s6-services-multibusiness
Source SHA       3eed68b45036154bcf1776564f479cd02e30d0d4
Run              33666790884
Job              100370414068
Result           SUCCESS
Artifact         9860927146
Artifact SHA256  543feab917c80dfd3a9cecbff7db15170d82cc66a621b837616d73a798b57564
```

S6 proves the same Services implementation across materially different automotive and veterinary specimens with business-scoped reads, idempotency and dependency references, deterministic eligibility, and no fixture/vertical branching in implementation files.

Receipt: [`mk1/Build/evidence/s6-services-multibusiness-certification-2026-09-02.md`](mk1/Build/evidence/s6-services-multibusiness-certification-2026-09-02.md).

Canonical MK1 index: [`mk1/README.md`](mk1/README.md). Build/evidence index: [`mk1/Build/README.md`](mk1/Build/README.md).

## Step 4 — Scheduler boundary

The design separates commercial semantics from real capacity:

```text
SERVICES
What is being offered?
  Service / Offering
  price / duration
  requirements / dependencies
  eligibility / revision
  abstract scheduling demand

SCHEDULER
When and with what real capacity can it happen?
  Resource / capability
  schedules / overrides
  availability
  hold
  reservation / assignment
  conflict
```

Core invariant remains:

```text
availability shown != reservation persisted
```

No Scheduler runtime is certified yet. Design authority lives in:

- [`mk1/Design/05-services-scheduler-boundary.md`](mk1/Design/05-services-scheduler-boundary.md)
- [`mk1/Design/06-scheduler-engine-contract.md`](mk1/Design/06-scheduler-engine-contract.md)
- [`mk1/Plan/04-platform-steps-3-4-5-roadmap.md`](mk1/Plan/04-platform-steps-3-4-5-roadmap.md)

## CTA / channel proof

No Agent, MCP, LLM orchestration or semantic AI router is part of current channel execution.

```text
CLI / WebChat / later Telegram / later WhatsApp
              ↓
         ChannelAdapter
              ↓
   CanonicalChannelEnvelope
              ↓
      ChannelExecutionCore
              ↓
       ┌──────┴─────────┐
       ▼                ▼
PostgreSQL           Temporal
binding/event        Workflow authority
ledger                   │
                         ▼
                  same Workflow Library
```

Current channel status:

```text
C0A Workflow-view projection               ✅ CERTIFIED
C1A workflow-visible HTML WebChat           ✅ CERTIFIED + HUMAN VERIFIED
C1B durable correlation/event semantics     ✅ CERTIFIED + HUMAN RESTART VERIFIED
C2 Telegram adapter design                  ✅ DESIGNED
C2 Telegram physical proof                  ⏭ DEFERRED
WhatsApp                                    ⏭ LATER
```

C1B authority:

```text
Source SHA       2008fce4f863fdabf8e8f323eee1d7cda05cb454
Run              33647842017
Job              100307008849
Artifact         9853555059
Artifact SHA256  efa65255fdc4c8569f55cefd38202145d2feb5a275d1c897f4b58dbb10a023bf
```

## Step 5 — Integration boundary

The Integration Engine is designed as a provider boundary only:

```text
Temporal / domain operation
        ↓
Integration Port
        ↓
Provider Adapter
        ↓
external payment / ERP / notification / maps / webhook system
```

It does not own Customer, Services, Scheduler, Appointment or Workflow state. No Integration runtime is certified yet.

## Authority model

```text
Temporal
  durable orchestration / Event History / Workflow state

PostgreSQL
  canonical transactional business truth
  durable channel correlation/event truth

MongoDB
  semantic/execution audit, not shadow business truth

AttachmentStore
  binary/document integrity and lifecycle

Channel adapters
  transport normalization/rendering only
```

## Documentation progression

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

## Current next work

```text
CURRENT  Step 3 / S7 — Appointment consumes canonical Services snapshot
NEXT     Step 3 / S8 — final clean Services certification
THEN     Step 4 / Scheduler build gates
LATER    Telegram physical proof
LAST     Agent / MCP / Intelligence layer
```

## Evidence discipline

```text
UNKNOWN != PASS
documented != verified
CI green != broader claim unless CI proved it
runtime source SHA != later documentation SHA
channel != business authority
Services != Scheduler
availability shown != reservation persisted
provider identity != business policy
```

## What is not yet claimed

Engines does not yet certify full G1 Services closure, Scheduler, Telegram physical transport, WhatsApp, Integration Engine runtime, Agent/MCP, production deployment or production security hardening.
