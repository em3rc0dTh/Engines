# Engines

`Engines` is a reusable operational orchestration architecture built around durable workflows rather than channel-specific business logic.

## Program status

```text
MK0 — ARCHITECTURE FOUNDATION
OBJECTIVE COMPLETE / LOCAL LABORATORY CERTIFIED

MK1 — STAGE 2
ACTIVE
Services S0–S5 certified
Workflow-visible WebChat C1A certified
```

MK0 remains the frozen evidence base. MK1 evolves from that certified foundation without rewriting `mk0/runtime`.

## MK0 — certified foundation

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

## MK1 — Services Engine progress

```text
G0 — Foundation completeness audit          ✅ CLOSED

G1 — Services Engine
S0 — Runtime promotion                     ✅ CERTIFIED
S1 — Contracts + persistence               ✅ CERTIFIED
S2 — Deterministic read engine             ✅ CERTIFIED
S3 — Eligibility + recommendation          ✅ CERTIFIED
S4 — Versioned management mutations        ✅ CERTIFIED
S5 — Running-Workflow snapshots            ✅ CERTIFIED
S6 — Multi-business generality             🔧 NEXT
S7 — Appointment integration               ⏭ QUEUED
S8 — Final clean certification             ⏭ QUEUED

G1 SERVICES ENGINE                         ❌ NOT YET FULLY CERTIFIED
G2 SCHEDULER ENGINE                        ⏭ AFTER G1
```

S4 certifies Temporal-orchestrated Service/Offering management with business-scoped idempotency, exact replay, material-conflict protection, optimistic revision control, explicit lifecycle changes, reference safety, and semantic audit before terminal Workflow return.

S5 certifies that a running Temporal consumer can keep revision `N` while the mutable Services catalog advances to `N+1`, survive Worker restart, finish with `N`, and allow a newly started Workflow to observe `N+1`.

Canonical MK1 index: [`mk1/README.md`](mk1/README.md). Services plan: [`mk1/Plan/01-services-engine-gates.md`](mk1/Plan/01-services-engine-gates.md). Build/evidence index: [`mk1/Build/README.md`](mk1/Build/README.md).

## CTA channel proof — current boundary

No Agent, MCP, LLM orchestration, or semantic AI router is part of the current channel work.

The architecture remains the explicit CLI-style path:

```text
CLI / WebChat / Telegram / later transport
              │
              ▼
       Channel Adapter
              │
              ▼
    canonical CTA operation
              │
              ▼
           Temporal
              │
              ▼
     same Workflow Library
```

Provider differences stop at adapter/renderer boundaries. Customer, Services, Scheduler, and Workflow logic remain provider-independent.

Current channel status:

```text
C0A — provider-independent Workflow view    ✅ CERTIFIED
C1A — minimal workflow-visible WebChat       ✅ CERTIFIED
C1B — durable channel correlation/dedupe     🔧 OPEN
C2  — Telegram Bot                          ⏭ SECOND CHANNEL
C3  — Telegram webhook parity               ⏭ OPTIONAL
C4  — WhatsApp                              ⏭ LATER
```

## C1A — workflow-visible WebChat

The first WebChat proof deliberately uses only a small HTML/CSS/JS surface.

```text
/webchat/
  conversational interaction

/webchat/workflow.html?workflowId=<id>
  live Temporal Workflow inspector
```

The WebChat and inspector continuously expose the real durable `workflowId`, `workflowStatus`, Temporal `phase`, and `nextAction`.

The provider-independent visible execution map is:

```text
01 Start Workflow
02 Customer name
03 Customer email
04 Customer phone
05 Resolve Customer
06 Select Service
07 Select Offering / Product
08 Set Date
09 Load Available Slots
10 Select Slot
11 Finalize Appointment
12 Appointment Created
```

The Customer field rows are human interaction checkpoints projected from durable Workflow data. They do not replace or fabricate Temporal phases.

C1A certification executed the complete `RegisterNewAppointment` flow through the WebChat transport and ended with all twelve visible checkpoints `COMPLETE` and final Temporal phase `CREATED`.

```text
Source SHA       860629e9ada498e225ae803a9fe6f077949ec320
Run              33542468975
Job              99971830150
Artifact         9814172765
Artifact SHA256  a12fa1b0283524948d5fa0d253953c5588ba2692a5cc0bbee93ded65265656f3
Marker           WEBCHAT_C1_WORKFLOW_VISIBILITY_PASS
```

Receipt: [`mk1/Build/evidence/c1a-webchat-workflow-visibility-certification-2026-09-01.md`](mk1/Build/evidence/c1a-webchat-workflow-visibility-certification-2026-09-01.md)

C1A is ready for visual/manual proof. C1 itself is not fully closed because C1B still needs server-side durable conversation binding, inbound-event dedupe/conflict semantics, and adapter-restart recovery.

Channel references:

- [`mk1/Brainstorming/03-cta-telegram-whatsapp-webchat-poc.md`](mk1/Brainstorming/03-cta-telegram-whatsapp-webchat-poc.md)
- [`mk1/Design/02-cta-channel-adapter-contract.md`](mk1/Design/02-cta-channel-adapter-contract.md)
- [`mk1/Design/03-workflow-visibility-contract.md`](mk1/Design/03-workflow-visibility-contract.md)
- [`mk1/Plan/02-cta-multichannel-poc-gates.md`](mk1/Plan/02-cta-multichannel-poc-gates.md)

## Architecture authority model

```text
CHANNELS / CLIENTS
CLI · HTTP/Postman · Lab Consoles · WebChat · future Telegram/WhatsApp
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
known workflowId in browser != server-side durable channel binding
```

A runtime claim must point to an identified executed source revision and bounded receipt.

## Current next work

```text
Services: S6 multi-business generality
Channel:  C1B durable correlation + inbound-event idempotency
Then:    C2 Telegram Bot using the same CTA/Temporal architecture
```

## What is not yet claimed

Engines does not yet certify full G1 Services closure, the Scheduler Engine, complete durable multi-channel correlation, Telegram, WhatsApp, a complete Integration Engine, Agent/MCP, or production deployment/security hardening.
