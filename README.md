# Engines

`Engines` is a reusable operational orchestration architecture built around durable workflows rather than channel-specific business logic.

## Program status

```text
MK0 — ARCHITECTURE FOUNDATION
OBJECTIVE COMPLETE / LOCAL LABORATORY CERTIFIED

MK1 — STAGE 2
ACTIVE
Services S0–S5 certified
WebChat C1A workflow visibility certified + human verified
WebChat C1B durable channel semantics certified
Telegram C2 next channel proof
```

MK0 remains the frozen evidence base. MK1 evolves from that foundation without rewriting `mk0/runtime`.

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

Canonical MK0 index: [`mk0/README.md`](mk0/README.md).

## MK1 — Services Engine progress

```text
G0 Foundation completeness audit           ✅ CLOSED

G1 Services Engine
S0 Runtime promotion                       ✅ CERTIFIED
S1 Contracts + persistence                 ✅ CERTIFIED
S2 Deterministic read engine               ✅ CERTIFIED
S3 Eligibility + recommendation            ✅ CERTIFIED
S4 Versioned management mutations          ✅ CERTIFIED
S5 Running-Workflow snapshots              ✅ CERTIFIED
S6 Multi-business generality               🔧 NEXT
S7 Appointment integration                 ⏭ QUEUED
S8 Final clean certification               ⏭ QUEUED

G1 SERVICES ENGINE                         ❌ NOT YET FULLY CERTIFIED
G2 SCHEDULER ENGINE                        ⏭ AFTER G1
```

S4 certifies versioned/idempotent Service/Offering management through Temporal. S5 certifies revision-specific running Workflow snapshots across catalog change and Worker restart.

Canonical MK1 index: [`mk1/README.md`](mk1/README.md). Build/evidence index: [`mk1/Build/README.md`](mk1/Build/README.md).

## G3 — CTA channel proof

No Agent, MCP, LLM orchestration or semantic AI router is part of the current channel work.

The architecture continues the explicit CLI model:

```text
CLI / WebChat / Telegram / later transport
              │
              ▼
        Channel Adapter
              │
              ▼
   CanonicalChannelEnvelope
              │
              ▼
      ChannelExecutionCore
              │
       ┌──────┴─────────┐
       ▼                ▼
PostgreSQL           Temporal
channel binding      Workflow authority
+ event ledger           │
                         ▼
                  same Workflow Library
```

Provider differences stop at adapter/renderer boundaries. Customer, Services, Scheduler and Workflow policy remain provider-independent.

Current channel status:

```text
C0A Workflow-view projection               ✅ CERTIFIED
C1A workflow-visible HTML WebChat           ✅ CERTIFIED + HUMAN VERIFIED POST-FIX
C1B durable correlation/event semantics     ✅ CERTIFIED
C2 Telegram Bot / long polling              🔧 NEXT
C3 Telegram webhook parity                  ⏭ OPTIONAL
C4 WhatsApp                                 ⏭ LATER
```

## C1A — workflow-visible WebChat

The first WebChat proof deliberately uses a small HTML/CSS/JS surface:

```text
/webchat/
  conversational interaction

/webchat/workflow.html?workflowId=<id>
  live Temporal Workflow inspector
```

Both expose the real durable Workflow ID/status, Temporal phase, next action and a deterministic 12-step execution map. C1A was automated-certified, then human tested; a prompt-render timing defect was fixed and human verified post-fix.

Original C1A authority:

```text
Source SHA       860629e9ada498e225ae803a9fe6f077949ec320
Run              33542468975
Artifact         9814172765
```

Human/renderer hardening authority:

```text
Source SHA       ed207f8c82ae9138f92fd505209c30c4eeba243b
Run              33560864234
Artifact         9821207955
```

## C1B — durable WebChat channel semantics

C1B removes `workflowId` browser/process memory as the authoritative conversation binding.

PostgreSQL now owns:

```text
channel_conversation_bindings
channel_inbound_events
```

The certified semantics are:

```text
same event identity + same canonical material
→ exact replay
→ one logical Temporal operation

same event identity + different canonical material
→ CHANNEL_EVENT_IDENTITY_CONFLICT
→ no conflicting Workflow mutation

WebChat adapter process restart
→ recover external conversation binding from PostgreSQL
→ continue the same Temporal Workflow
```

Final authority:

```text
Source SHA       2008fce4f863fdabf8e8f323eee1d7cda05cb454
Run              33647842017
Job              100307008849
Result           SUCCESS
Artifact         9853555059
Artifact SHA256  efa65255fdc4c8569f55cefd38202145d2feb5a275d1c897f4b58dbb10a023bf
```

The run physically restarted the WebChat adapter (`PID 7982 → 8190`), recovered the same Workflow through the durable binding, completed the Appointment at `COMPLETED / CREATED`, replayed the terminal event from the durable event ledger, and retained the full C1A 12-step visibility proof.

Receipt: [`mk1/Build/evidence/c1b-durable-channel-certification-2026-09-02.md`](mk1/Build/evidence/c1b-durable-channel-certification-2026-09-02.md).

Verification ledger: [`mk1/Test/c1b-durable-channel-semantics-2026-09-02.md`](mk1/Test/c1b-durable-channel-semantics-2026-09-02.md).

## C2 — Telegram next

Telegram is now the second transport proof and must reuse the certified C1B core:

```text
Telegram Bot API / long polling
        ↓
TelegramAdapter
        ↓
CanonicalChannelEnvelope
        ↓
existing ChannelExecutionCore
        ↓
existing PostgreSQL binding/event semantics
        ↓
existing Temporal Workflow Library
```

No separate Telegram Appointment Workflow, no provider-specific Services/Scheduler rules, no Agent, and no MCP.

## Authority model

```text
Temporal
  durable orchestration / Event History / Workflow state

PostgreSQL
  canonical transactional business truth
  durable channel conversation/event correlation truth

MongoDB
  semantic/execution audit, not shadow business truth

AttachmentStore
  binary/document integrity and lifecycle

Channel adapters
  replaceable transport normalization/rendering only
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

## Evidence discipline

```text
UNKNOWN != PASS
documented != verified
CI green != a broader claim unless that CI proved it
runtime source SHA != later documentation SHA
browser memory != durable channel authority
provider identity != business policy
```

## Current next work

```text
Services track  S6 multi-business generality
Channel track   C2 Telegram Bot / long polling
```

## What is not yet claimed

Engines does not yet certify full G1 Services closure, Scheduler, Telegram, WhatsApp, full cross-channel equivalence, Agent/MCP, a complete production Integration Engine, or production deployment/security hardening.
