# MK1 — Stage 2 Certification Program

## Status

**G0 CLOSED — G1 SERVICES S0–S5 CERTIFIED — WEBCHAT C1A+C1B CERTIFIED — C2 TELEGRAM NEXT**

MK1 starts from the frozen MK0 architecture laboratory and must not weaken or silently reinterpret any MK0 invariant. `mk0/runtime` remains untouched.

Canonical stable base:

```text
main / developer
9c0fab032461e889f3d9d297b2d2b375288afda3
```

## Current Stage-2 lines

Services lineage:

```text
main / developer
  ↓
audit/stage2-core-126-completeness
  ↓
design/mk1-services-engine
  ↓
build/mk1-s0-runtime-promotion
  ↓
build/mk1-s1-services-contracts
  ↓
build/mk1-s2-services-read-engine
  ↓
build/mk1-s3-services-eligibility
  ↓
build/mk1-s4-services-management
  ↓
build/mk1-s5-services-snapshots
```

Channel lineage:

```text
build/mk1-c0-c1-webchat
  ↓
build/mk1-c1b-durable-channel
```

The build branches contain the active MK1 work; `developer` has not yet been advanced from the stable MK0 base.

## G0 — foundation boundary ✅ CLOSED

```text
CTA / Channel Adapter core             ✅ CERTIFIED FOUNDATION
Temporal orchestration core            ✅ CERTIFIED FOUNDATION
Persistence authority model            ✅ CERTIFIED FOUNDATION

full omnichannel breadth                ❌ OPEN
natural-language/general intent router  ❌ OPEN
full Workflow Library                   ❌ OPEN
production S3/MinIO storage             ❌ OPEN
```

References:

- [`Design/00-foundation-contract.md`](Design/00-foundation-contract.md)
- [`Plan/00-core-126-completeness-audit.md`](Plan/00-core-126-completeness-audit.md)
- [`Test/g0-core-126-audit.md`](Test/g0-core-126-audit.md)
- [`Build/evidence/g0-core-126-audit-closure-2026-08-31.md`](Build/evidence/g0-core-126-audit-closure-2026-08-31.md)

## G1 — Services Engine

```text
S0 Runtime promotion              ✅ CERTIFIED
S1 Contracts + persistence        ✅ CERTIFIED
S2 Deterministic reads            ✅ CERTIFIED
S3 Eligibility + recommendation   ✅ CERTIFIED
S4 Versioned management           ✅ CERTIFIED
S5 Durable Workflow snapshots     ✅ CERTIFIED
S6 Multi-business generality      🔧 NEXT SERVICES GATE
S7 Appointment integration        ⏭ QUEUED
S8 Final clean G1 certification   ⏭ QUEUED

G1 SERVICES ENGINE                ❌ NOT YET FULLY CERTIFIED
```

S4 authority:

```text
Source SHA       f3e54b853af5f01fb2e9ed7d032f784e3cffb81e
Run              33538554471
Job              99959020329
Artifact         9812703293
Artifact SHA256  275dd054247a89f0f4f8fe6c9244685d06cdd72117408c5282acbf6139b67a9c
```

S5 authority:

```text
Source SHA       7568618062f4192b34caf6e916b58534f304ad3f
Run              33539683548
Job              99962550022
Artifact         9813129778
Artifact SHA256  22f823b50babf13691c12d6c5783619568d2198d1123f2fa7c9c22fcf218a708
```

Services references:

- [`Design/01-services-engine-contract.md`](Design/01-services-engine-contract.md)
- [`Plan/01-services-engine-gates.md`](Plan/01-services-engine-gates.md)
- [`golden-dataset/services-engine-v0.json`](golden-dataset/services-engine-v0.json)
- [`Test/g1-services-engine-s0-s5.md`](Test/g1-services-engine-s0-s5.md)
- [`Build/README.md`](Build/README.md)

## G3 — CTA multi-channel proof

### Phase boundary

Current channel work remains explicitly:

```text
NO Agent
NO MCP
NO LLM orchestration
NO semantic AI router
```

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
              ▼
           Temporal
              │
              ▼
     same Workflow Library
```

Provider differences stop at adapter/renderer boundaries. Customer, Services, Scheduler and Workflow policy remain provider-independent.

Channel references:

- [`Brainstorming/03-cta-telegram-whatsapp-webchat-poc.md`](Brainstorming/03-cta-telegram-whatsapp-webchat-poc.md)
- [`Brainstorming/04-c1b-durable-channel-semantics.md`](Brainstorming/04-c1b-durable-channel-semantics.md)
- [`mining-site/quarries/quarry-02-channel-idempotency-and-recovery.md`](mining-site/quarries/quarry-02-channel-idempotency-and-recovery.md)
- [`Design/02-cta-channel-adapter-contract.md`](Design/02-cta-channel-adapter-contract.md)
- [`Design/03-workflow-visibility-contract.md`](Design/03-workflow-visibility-contract.md)
- [`Design/04-c1b-durable-channel-contract.md`](Design/04-c1b-durable-channel-contract.md)
- [`Plan/02-cta-multichannel-poc-gates.md`](Plan/02-cta-multichannel-poc-gates.md)
- [`Plan/03-c1b-durable-channel-gate.md`](Plan/03-c1b-durable-channel-gate.md)
- [`golden-dataset/c1b-durable-channel-v0.json`](golden-dataset/c1b-durable-channel-v0.json)

### C0A — Workflow-view projection ✅ CERTIFIED

The channel core deterministically projects the real Appointment Workflow into the visible engineering map without inventing new Temporal phases:

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

The actual `phase` and `nextAction` remain separately visible and authoritative.

### C1A — workflow-visible WebChat ✅ CERTIFIED + HUMAN VERIFIED POST-FIX

C1A proved a minimal HTML/CSS/JS WebChat can execute the complete explicit Appointment flow and a second HTML inspector can show the same durable Temporal state.

Original authority:

```text
Source SHA       860629e9ada498e225ae803a9fe6f077949ec320
Run              33542468975
Job              99971830150
Artifact         9814172765
Artifact SHA256  a12fa1b0283524948d5fa0d253953c5588ba2692a5cc0bbee93ded65265656f3
```

Renderer hardening after human observation:

```text
Source SHA       ed207f8c82ae9138f92fd505209c30c4eeba243b
Run              33560864234
Job              100032737031
Artifact         9821207955
Artifact SHA256  4f7fc1ddea852a9501f20078d0df8ecc84dc3c645e8b1362424c6d6f11ae37ff
```

A second manual run confirmed the duplicate Step 08 / Step 11 presentation symptom was gone and the Workflow still reached `COMPLETED / CREATED / NONE`, 12/12 `COMPLETE`, with inspector parity.

References:

- [`Build/evidence/c1a-webchat-workflow-visibility-certification-2026-09-01.md`](Build/evidence/c1a-webchat-workflow-visibility-certification-2026-09-01.md)
- [`Test/c1a-webchat-human-verification-2026-09-01.md`](Test/c1a-webchat-human-verification-2026-09-01.md)

### C1B — durable WebChat channel semantics ✅ CERTIFIED

C1B replaces browser/process-memory correlation with a durable channel boundary:

```text
WebChatAdapter
      ↓
CanonicalChannelEnvelope
      ↓
PostgreSQL
  channel_conversation_bindings
  channel_inbound_events
      ↓
existing Temporal logical operation identity
      ↓
RegisterNewAppointment
```

Certified semantics:

```text
same inbound identity + same material
→ exact replay
→ one logical Workflow operation

same inbound identity + different material
→ CHANNEL_EVENT_IDENTITY_CONFLICT
→ zero conflicting Workflow mutation

WebChat adapter restart
→ externalConversationId resolves from PostgreSQL
→ same Temporal Workflow continues
```

Final C1B authority:

```text
Source SHA       2008fce4f863fdabf8e8f323eee1d7cda05cb454
Run              33647842017
Job              100307008849
Result           SUCCESS
Artifact         9853555059
Artifact SHA256  efa65255fdc4c8569f55cefd38202145d2feb5a275d1c897f4b58dbb10a023bf
```

The CI physically replaced the WebChat process (`PID 7982 → 8190`), recovered the same Workflow through the durable conversation binding, completed the Appointment at `CREATED`, replayed the terminal event from the durable event ledger, and then re-ran the full C1A visibility proof successfully.

Runtime markers:

```text
WEBCHAT_C1B_PRE_RESTART_PASS
WEBCHAT_C1B_DURABLE_CHANNEL_PASS
WEBCHAT_C1_WORKFLOW_VISIBILITY_PASS
```

First-run provenance is retained: run `33647731151` failed at strict TypeScript typecheck before runtime because of an `exactOptionalPropertyTypes` response-construction mismatch. It was corrected without weakening any domain invariant; run `33647842017` is the certification authority.

References:

- [`Build/evidence/c1b-durable-channel-certification-2026-09-02.md`](Build/evidence/c1b-durable-channel-certification-2026-09-02.md)
- [`Test/c1b-durable-channel-semantics-2026-09-02.md`](Test/c1b-durable-channel-semantics-2026-09-02.md)

### C2 — Telegram 🔧 NEXT CHANNEL GATE

Telegram must reuse the now-certified C1B core:

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

Telegram `update_id` / message identity becomes transport input to the existing durable event semantics. The provider must not introduce a separate Appointment Workflow or provider-specific business policy.

WhatsApp remains later; its transport mechanism is intentionally not frozen yet.

## Carry-forward invariants

```text
UNKNOWN != PASS
documented != verified
prototype != certified engine
channel behavior != business authority
availability shown != reservation persisted
running Workflow snapshot != mutable catalog head
same idempotency identity + different material != overwrite
stale revision != silent last-write-wins
human execution checkpoint != synthetic Temporal phase
browser memory != durable channel authority
provider identity != business policy
Agent/MCP != current phase
```

## Current sequence

```text
G0 Foundation                                 ✅ CLOSED

G1 Services Engine
  S0–S5                                       ✅ CERTIFIED
  S6 Multi-business                           🔧 NEXT SERVICES
  S7 Appointment integration                  ⏭
  S8 Final G1 certification                   ⏭

G2 Scheduler Engine                           ⏭ AFTER G1

G3 CTA channel proof
  C0A Workflow-view projection                ✅ CERTIFIED
  C1A minimal WebChat                          ✅ CERTIFIED + HUMAN VERIFIED POST-FIX
  C1B durable WebChat semantics                ✅ CERTIFIED
  C2 Telegram bot                              🔧 NEXT CHANNEL
  C3 Telegram webhook parity                   ⏭ OPTIONAL
  C4 WhatsApp                                  ⏭ LATER
```

The Agent/Intelligence layer remains outside this phase until the deterministic Engines platform works correctly through explicit CTA/Temporal contracts alone.
