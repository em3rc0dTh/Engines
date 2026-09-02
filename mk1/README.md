# MK1 — Stage 2 Certification Program

## Status

**G0 CLOSED — G1 SERVICES S0–S6 CERTIFIED — WEBCHAT C1A+C1B CERTIFIED — S7 NEXT**

MK1 starts from the frozen MK0 architecture laboratory and must not weaken or silently reinterpret MK0 invariants. `mk0/runtime` remains untouched.

```text
main / developer
9c0fab032461e889f3d9d297b2d2b375288afda3
```

`developer` is still the stable MK0 integration line; active MK1 work remains on explicit bounded branches.

## Current architecture lines

```text
STEP 1 / CTA CHANNELS
CLI / HTTP-Postman historical milestones
WebChat C1A + durable C1B certified
Telegram design prepared, physical proof deferred

STEP 3 / SERVICES
S0–S6 certified
S7 Appointment integration next
S8 full clean G1 closure after S7

STEP 4 / SCHEDULER
design frozen enough to begin after Services boundary is closed

STEP 5 / INTEGRATION
boundary designed only; no provider runtime certified

AGENT / MCP
intentionally absent from this phase
```

Branch policy and current narrative: [`../BRANCHES.md`](../BRANCHES.md).

## G0 — foundation ✅ CLOSED

```text
CTA / adapter boundary                 ✅ certified foundation
Temporal durable orchestration         ✅ certified foundation
PostgreSQL business authority          ✅ certified foundation
Mongo semantic/execution audit         ✅ certified foundation
AttachmentStore integrity boundary     ✅ certified foundation
```

Foundation references:

- [`Design/00-foundation-contract.md`](Design/00-foundation-contract.md)
- [`Plan/00-core-126-completeness-audit.md`](Plan/00-core-126-completeness-audit.md)
- [`Test/g0-core-126-audit.md`](Test/g0-core-126-audit.md)

## G1 — Services Engine

```text
S0 Runtime promotion                   ✅ CERTIFIED
S1 Contracts + persistence             ✅ CERTIFIED
S2 Deterministic reads                 ✅ CERTIFIED
S3 Eligibility + recommendation        ✅ CERTIFIED
S4 Versioned management                ✅ CERTIFIED
S5 Durable Workflow snapshots          ✅ CERTIFIED
S6 Multi-business generality           ✅ CERTIFIED
S7 Appointment integration             🔧 NEXT
S8 Final clean G1 certification        ⏭ QUEUED

G1 SERVICES ENGINE                     ❌ NOT YET FULLY CERTIFIED
```

### S5 authority

```text
Source SHA       7568618062f4192b34caf6e916b58534f304ad3f
Run              33539683548
Job              99962550022
Artifact         9813129778
SHA256           22f823b50babf13691c12d6c5783619568d2198d1123f2fa7c9c22fcf218a708
```

S5 proves a running Temporal consumer retains the selected Service/Offering revision snapshot across catalog publication and Worker restart while a new Workflow sees the newer revision.

### S6 authority

```text
Branch           build/mk1-s6-services-multibusiness
Source SHA       3eed68b45036154bcf1776564f479cd02e30d0d4
Run              33666790884
Job              100370414068
Result           SUCCESS
Artifact         9860927146
SHA256           543feab917c80dfd3a9cecbff7db15170d82cc66a621b837616d73a798b57564
```

S6 proves the same Services implementation across materially different automotive and veterinary specimens. Both use the same Service code and Offering code inside independent business scopes, independent idempotency identities, isolated reads, isolated dependency references and deterministic eligibility.

Direct marker:

```text
SERVICES_S6_MULTIBUSINESS_PASS
```

S6 also re-ran dynamic S4 management/rejection safety and the full inherited Appointment regression including exact replay and atomic same-slot conflict.

References:

- [`Design/01-services-engine-contract.md`](Design/01-services-engine-contract.md)
- [`Design/09-services-engine-completion-contract.md`](Design/09-services-engine-completion-contract.md)
- [`Plan/01-services-engine-gates.md`](Plan/01-services-engine-gates.md)
- [`golden-dataset/services-engine-v0.json`](golden-dataset/services-engine-v0.json)
- [`golden-dataset/services-s6-multibusiness-v0.json`](golden-dataset/services-s6-multibusiness-v0.json)
- [`Test/g1-services-engine-s0-s6.md`](Test/g1-services-engine-s0-s6.md)
- [`Build/evidence/s6-services-multibusiness-certification-2026-09-02.md`](Build/evidence/s6-services-multibusiness-certification-2026-09-02.md)

## S7 — current Services gate

S7 must make `RegisterNewAppointment` consume canonical Services reads and freeze a revision-aware Service/Offering snapshot in Workflow state while preserving the existing Appointment behavior.

```text
Customer
  ↓
Services catalog reads
  ↓
Service + Offering snapshot N
  ↓
Date / slot compatibility boundary
  ↓
explicit finalize
  ↓
atomic inherited booking
```

S7 must **not** redesign Scheduler. Availability/capacity/reservation authority remains a separate Step-4 responsibility.

## Step 4 — Scheduler design

The Services/Scheduler boundary is frozen in design:

```text
Services
  what is offered?
  duration / price / requirements / abstract scheduling demand

Scheduler
  when can it happen?
  with which concrete resource/capacity?
  availability / hold / reservation / conflict
```

Design references:

- [`Design/05-services-scheduler-boundary.md`](Design/05-services-scheduler-boundary.md)
- [`Design/06-scheduler-engine-contract.md`](Design/06-scheduler-engine-contract.md)
- [`Plan/04-platform-steps-3-4-5-roadmap.md`](Plan/04-platform-steps-3-4-5-roadmap.md)

No Scheduler build is certified yet.

## G3 — CTA multi-channel proof

Current phase explicitly excludes Agent/MCP/LLM routing.

```text
CLI / WebChat / later Telegram / later WhatsApp
              ↓
         ChannelAdapter
              ↓
   CanonicalChannelEnvelope
              ↓
      ChannelExecutionCore
              ↓
      PostgreSQL correlation
              ↓
           Temporal
              ↓
     same Workflow Library
```

Provider differences terminate at adapter/renderer boundaries.

### C1A — visible WebChat ✅

- minimal HTML/CSS/JS WebChat;
- live Workflow inspector;
- deterministic 12-step engineering view;
- real Temporal `phase` and `nextAction` remain separately visible;
- human post-fix verification complete.

### C1B — durable WebChat ✅

```text
Source SHA       2008fce4f863fdabf8e8f323eee1d7cda05cb454
Run              33647842017
Job              100307008849
Artifact         9853555059
SHA256           efa65255fdc4c8569f55cefd38202145d2feb5a275d1c897f4b58dbb10a023bf
```

C1B proves durable conversation/event correlation, replay/conflict semantics and physical WebChat process restart/recovery to the same Temporal Workflow. The user manually repeated the process-restart recovery successfully.

### C2 — Telegram

Telegram adapter design exists at [`Design/08-c2-telegram-adapter-contract.md`](Design/08-c2-telegram-adapter-contract.md), but physical Bot API testing is intentionally deferred while Steps 3–4 advance.

## Carry-forward invariants

```text
UNKNOWN != PASS
documented != verified
CI green != broader certification
runtime source SHA != later documentation SHA
channel != business authority
provider identity != business policy
availability shown != reservation persisted
mutable catalog head != selected Workflow snapshot
same idempotency identity + different material != overwrite
stale revision != silent last-write-wins
Services != Scheduler
Agent/MCP != current phase
```

## Current sequence

```text
G0 Foundation                      ✅ CLOSED
G1 Services S0–S6                  ✅ CERTIFIED
G1 S7 Appointment integration      🔧 CURRENT NEXT BUILD
G1 S8 clean closure                ⏭
G2 Scheduler                       ⏭ AFTER SERVICES BOUNDARY
Telegram physical proof            ⏭ DEFERRED
Agent / MCP                        ⏭ LAST
```

Build/evidence index: [`Build/README.md`](Build/README.md).
