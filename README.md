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

### MK1 — Services Engine progress

```text
G0 — Foundation completeness audit          ✅ CLOSED

G1 — Services Engine
S0 — Runtime promotion                     ✅ CERTIFIED
S1 — Contracts + persistence               ✅ CERTIFIED
S2 — Deterministic read engine             ✅ CERTIFIED
S3 — Eligibility + recommendation          ✅ CERTIFIED
S4 — Versioned management mutations        ✅ CERTIFIED
S5 — Running-Workflow snapshots            🔧 NEXT
S6 — Multi-business generality             ⏭ QUEUED
S7 — Appointment integration               ⏭ QUEUED
S8 — Final clean certification             ⏭ QUEUED

G1 SERVICES ENGINE                         ❌ NOT YET FULLY CERTIFIED
G2 SCHEDULER ENGINE                        ⏭ AFTER G1
G3 MULTI-CHANNEL CTA PROOF                 ⏭ AFTER ENGINE PREREQUISITES
```

S4 now certifies Temporal-orchestrated Service/Offering management with business-scoped idempotency, exact replay, material-conflict protection, optimistic revision control, explicit lifecycle changes and semantic audit before terminal Workflow return.

Canonical MK1 index: [`mk1/README.md`](mk1/README.md). Services plan: [`mk1/Plan/01-services-engine-gates.md`](mk1/Plan/01-services-engine-gates.md). Test ledger: [`mk1/Test/g1-services-engine-s0-s4.md`](mk1/Test/g1-services-engine-s0-s4.md). Build/evidence index: [`mk1/Build/README.md`](mk1/Build/README.md).

## Parallel CTA proof design

The future CTA proof is being designed around three materially different presentation/transport surfaces that must call the same Engines orchestration boundary:

```text
WebChat
Telegram
WhatsApp
    ↓
canonical CTA envelope / correlation
    ↓
Temporal
    ↓
same Workflow Library
```

The preferred PoC path is WebChat locally first, Telegram next, then WhatsApp, ending with a frozen cross-channel Golden comparison. These adapters are **designed but not implemented/certified yet**.

Design references:

- [`mk1/Brainstorming/03-cta-telegram-whatsapp-webchat-poc.md`](mk1/Brainstorming/03-cta-telegram-whatsapp-webchat-poc.md)
- [`mk1/Design/02-cta-channel-adapter-contract.md`](mk1/Design/02-cta-channel-adapter-contract.md)

## Architecture authority model

```text
CHANNELS / CLIENTS
CLI · HTTP/Postman · Lab Consoles · future WebChat/Telegram/WhatsApp
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
- **MongoDB** — semantic/execution audit, not shadow business truth.
- **AttachmentStore** — binary/document integrity and lifecycle.
- **CTA/channel** — replaceable transport/presentation boundary, not business authority.

## MK1 Services capability through S4

```text
S1
ServiceDefinition / ServiceOffering
pricing / requirements / dependencies / eligibility data
revision + lifecycle persistence

S2
ListServices / GetService
ListOfferings / GetOffering

S3
evaluateOfferingEligibility
recommendOfferings

S4
CreateService / UpdateService / SetServiceStatus
CreateOffering / UpdateOffering / SetOfferingStatus
```

S4 management path:

```text
management caller
      ↓
Temporal servicesManagementWorkflow
      ↓
validation + reference preflight
      ↓
PostgreSQL mutation Activity
      ↓
canonical catalog + idempotency command ledger
      ↓
Mongo mutation audit
      ↓
terminal result
```

The final S4 certification source is `f3e54b853af5f01fb2e9ed7d032f784e3cffb81e`, run `33538554471`, job `99959020329`, artifact `9812703293`, SHA-256 `275dd054247a89f0f4f8fe6c9244685d06cdd72117408c5282acbf6139b67a9c`.

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

## Evidence discipline

```text
UNKNOWN != PASS
documented != verified
CI green != a broader claim unless that CI proved it
observed != supported
runtime source SHA != later documentation SHA
```

A runtime claim must point to an identified executed source revision and receipt.

## Current next question

S5 asks whether a running Temporal Workflow that selected Offering revision `N` remains bound to that snapshot after S4 publishes revision `N+1`, while a newly started Workflow sees `N+1`.

## What is not yet claimed

Engines does not yet certify production deployment/security hardening, the finished Scheduler Engine, the complete multi-channel CTA suite, a complete Integration Engine, Agent/Hermes, or the final product/control-room UI.
