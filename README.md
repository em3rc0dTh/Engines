# Engines

`Engines` is a reusable operational orchestration architecture built around durable workflows rather than channel-specific business logic.

## Program status

```text
MK0 — ARCHITECTURE FOUNDATION
OBJECTIVE COMPLETE / LOCAL LABORATORY CERTIFIED

MK1 — STAGE 2
ACTIVE
Services S0–S7 certified; S8 final G1 closure pending
WebChat C1A visible flow certified + human verified
WebChat C1B durable channel certified + human restart verified
Customer B2 soft-duplicate resolution certified
Telegram + WhatsApp local real-Temporal E2E automated + human verified
Real Telegram Bot API not yet certified
Real Meta Cloud API / Kapso not yet certified
Scheduler Step 4 designed, runtime not yet certified
Agent / MCP intentionally absent
```

MK0 remains the frozen evidence base. MK1 evolves from that foundation without rewriting `mk0/runtime`.

## Branch narrative

Repository branch policy is documented in [`BRANCHES.md`](BRANCHES.md).

Current messaging stack:

```text
design/mk1-telegram-whatsapp-official-channels
        ↓
build/mk1-customer-registration-policy-v2       PR #14
        ↓
build/mk1-customer-registration-channel-core     PR #15
        ↓
build/mk1-c2-telegram-register-customer          PR #16
        ↓
build/mk1-c4-whatsapp-register-customer          PR #17
        ↓
build/mk1-c2-c4-local-interactive-e2e            PR #18
        ↓
build/mk1-b2-customer-soft-duplicate-resolution  PR #19
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
S7 Appointment integration                 ✅ CERTIFIED
S8 Final clean certification               ⏭ PENDING

G1 SERVICES ENGINE                         ❌ NOT YET FULLY CERTIFIED
```

S7 runtime authority:

```text
Branch           build/mk1-s7-appointment-services-integration
Source SHA       6fc8814830038b5600c4c6376cd9b4ed7ef34b7a
Run              33668593216
Job              100376325350
Artifact         9861631780
Artifact SHA256  e700cfcdc43e753cbc894abd30211e322097fd010d0ec86dcae01d7d3290dd6a
```

S7 proves Appointment consumes canonical Services reads and freezes revision-aware Service/Offering selection state. Scheduler authority remains separate.

Canonical MK1 index: [`mk1/README.md`](mk1/README.md). Build/evidence index: [`mk1/Build/README.md`](mk1/Build/README.md).

## CTA / Customer channel proof

No Agent, MCP, LLM orchestration or semantic AI router is part of current channel execution.

```text
CLI / WebChat / Telegram / WhatsApp
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
Telegram local RegisterNewCustomer          ✅ AUTOMATED + HUMAN VERIFIED
WhatsApp local RegisterNewCustomer          ✅ AUTOMATED + HUMAN VERIFIED
C2/C4 combined local interactive E2E        ✅ HUMAN VERIFIED
B2 Customer soft-duplicate resolution       ✅ CERTIFIED
Real Telegram Bot API                       ⚪ NOT CERTIFIED
Real Meta Cloud API / Kapso                 ⚪ NOT CERTIFIED
```

C2/C4 automated authority:

```text
Source SHA       bfccd4a795400d2311201a880453b61b08d0b56a
Run              33896424897
Job              101100019937
Artifact         9945929946
Artifact SHA256  92b883ba035987274fbd7cc84f33b574118239eb19fa13990c4ec32a72e59c1e
```

Human evidence proves Telegram normal registration, invalid-phone rejection with recovery on the same Workflow, WhatsApp verified sender-phone prefill with no redundant phone prompt, and real Temporal completion to `CREATED`.

B2 authority:

```text
Source SHA       36afff68af3237bd6431fd643d7d969e5452a296
Run              33899907141
Job              101111281727
Artifact         9947248334
Artifact SHA256  2c02680d9e268957924303ab1113d71f0d872319b611a6ede3faca0a01ed678a
```

B2 certifies deterministic `USE_EXISTING` / `CREATE_NEW`, invalid-candidate rejection, exact decision replay, and a real cross-channel Telegram→WhatsApp soft-match flow without moving duplicate policy into provider code.

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

No Scheduler runtime is certified yet.

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
CHANNEL  Real Telegram Bot API proof
SERVICES S8 final clean G1 certification
THEN     Step 4 / Scheduler build gates
LATER    Real WhatsApp provider proof
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

Engines does not yet certify full G1 Services closure, Scheduler runtime, real Telegram Bot API transport, real Meta/Kapso transport, Integration Engine runtime, Agent/MCP, production deployment or production security hardening.
