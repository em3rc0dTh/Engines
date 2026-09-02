# MK1 — Stage 2 Certification Program

## Status

**G0 CLOSED — G1 SERVICES S0–S5 CERTIFIED — WEBCHAT C1A CERTIFIED + HUMAN VERIFIED POST-FIX — S6/C1B NEXT**

MK1 starts from the frozen MK0 architecture laboratory and must not weaken or silently reinterpret any MK0 invariant.

Canonical stable base:

```text
main
9c0fab032461e889f3d9d297b2d2b375288afda3
```

`main` carries the stable MK0 closure. MK1 work preserves exact ancestry and does not rewrite `mk0/runtime`.

## Current Stage-2 lines

Services line:

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

Channel proof line currently starts from the documented S5 head:

```text
build/mk1-c0-c1-webchat
```

No channel work rewrites the frozen MK0 runtime evidence.

## G0 — foundation boundary ✅ CLOSED

```text
1 — CTA / Channel Adapter core             ✅ CERTIFIED FOUNDATION
2 — Temporal orchestration core            ✅ CERTIFIED FOUNDATION
6 — Persistence authority model            ✅ CERTIFIED FOUNDATION

full omnichannel breadth                    ❌ OPEN
natural-language/general intent router      ❌ OPEN
full target Workflow Library                ❌ OPEN
production S3/MinIO storage                 ❌ OPEN
```

Foundation artifacts:

- [`Design/00-foundation-contract.md`](Design/00-foundation-contract.md)
- [`Plan/00-core-126-completeness-audit.md`](Plan/00-core-126-completeness-audit.md)
- [`Test/g0-core-126-audit.md`](Test/g0-core-126-audit.md)
- [`golden-dataset/g0-foundation-closure-manifest-v0.json`](golden-dataset/g0-foundation-closure-manifest-v0.json)
- [`Build/evidence/g0-core-126-audit-closure-2026-08-31.md`](Build/evidence/g0-core-126-audit-closure-2026-08-31.md)

## G1 — Services Engine

Canonical references:

- [`Brainstorming/02-services-engine.md`](Brainstorming/02-services-engine.md)
- [`mining-site/quarries/quarry-01-mk0-services-seed.md`](mining-site/quarries/quarry-01-mk0-services-seed.md)
- [`Design/01-services-engine-contract.md`](Design/01-services-engine-contract.md)
- [`Plan/01-services-engine-gates.md`](Plan/01-services-engine-gates.md)
- [`golden-dataset/services-engine-v0.json`](golden-dataset/services-engine-v0.json)
- [`Test/g1-services-engine-s0-s5.md`](Test/g1-services-engine-s0-s5.md)
- [`Build/README.md`](Build/README.md)

### Services certification ledger

```text
S0 Runtime promotion              ✅ CERTIFIED
S1 Contracts + persistence        ✅ CERTIFIED
S2 Deterministic reads            ✅ CERTIFIED
S3 Eligibility + recommendation   ✅ CERTIFIED
S4 Versioned management           ✅ CERTIFIED
S5 Durable Workflow snapshots     ✅ CERTIFIED
S6 Multi-business generality      🔧 NEXT
S7 Appointment integration        ⏭ QUEUED
S8 Final clean G1 certification   ⏭ QUEUED
```

S4 final authority:

```text
Source SHA       f3e54b853af5f01fb2e9ed7d032f784e3cffb81e
Run              33538554471
Job              99959020329
Artifact         9812703293
Artifact SHA256  275dd054247a89f0f4f8fe6c9244685d06cdd72117408c5282acbf6139b67a9c
```

Receipt: [`Build/evidence/s4-services-management-certification-2026-09-01.md`](Build/evidence/s4-services-management-certification-2026-09-01.md)

S5 final authority:

```text
Source SHA       7568618062f4192b34caf6e916b58534f304ad3f
Run              33539683548
Job              99962550022
Artifact         9813129778
Artifact SHA256  22f823b50babf13691c12d6c5783619568d2198d1123f2fa7c9c22fcf218a708
```

S5 proved revision-N snapshot stability across publication of N+1 and a real Worker restart, while a new Workflow observed N+1.

Receipt: [`Build/evidence/s5-services-snapshot-certification-2026-09-01.md`](Build/evidence/s5-services-snapshot-certification-2026-09-01.md)

G1 is not closed until S6–S8 pass.

## G3 — CTA channel proof

### Non-negotiable phase boundary

Current channel work is intentionally:

```text
NO Agent
NO MCP
NO LLM orchestration
NO semantic AI router
```

The execution model is the same explicit model already proven by the CLI:

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

Provider differences terminate at adapter/renderer boundaries. Customer, Services, Scheduler, and Workflow logic remain provider-independent.

Channel references:

- [`Brainstorming/03-cta-telegram-whatsapp-webchat-poc.md`](Brainstorming/03-cta-telegram-whatsapp-webchat-poc.md)
- [`Design/02-cta-channel-adapter-contract.md`](Design/02-cta-channel-adapter-contract.md)
- [`Design/03-workflow-visibility-contract.md`](Design/03-workflow-visibility-contract.md)
- [`Plan/02-cta-multichannel-poc-gates.md`](Plan/02-cta-multichannel-poc-gates.md)

### C0A — provider-independent Workflow view ✅ CERTIFIED

The channel-core projects a durable Appointment Workflow into a visible engineering checklist without inventing new Temporal phases.

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

The real `phase` and `nextAction` remain visible and authoritative.

### C1A — minimal workflow-visible WebChat ✅ CERTIFIED + HUMAN VERIFIED POST-FIX

Implemented on:

```text
build/mk1-c0-c1-webchat
```

Surfaces:

```text
/webchat/
/webchat/workflow.html?workflowId=<id>
```

The first is the simple conversational HTML surface. The second is a separate live Workflow inspector showing Workflow ID, Run ID, status, Temporal phase, next action, all execution steps, business projection, issues/result, and raw Workflow response.

Certified path:

```text
Start Workflow
→ Customer name
→ Customer email
→ Customer phone
→ Resolve Customer
→ Select Service
→ Select Offering
→ Set Date
→ Load/Select Slot
→ Finalize
→ CREATED
```

Original certification:

```text
Source SHA       860629e9ada498e225ae803a9fe6f077949ec320
Run              33542468975
Job              99971830150
Result           SUCCESS
Artifact         9814172765
Artifact SHA256  a12fa1b0283524948d5fa0d253953c5588ba2692a5cc0bbee93ded65265656f3
Marker           WEBCHAT_C1_WORKFLOW_VISIBILITY_PASS
```

The proof ended with all twelve visible steps `COMPLETE`, `finalPhase=CREATED`, `agent=false`, and `mcp=false`.

Receipt: [`Build/evidence/c1a-webchat-workflow-visibility-certification-2026-09-01.md`](Build/evidence/c1a-webchat-workflow-visibility-certification-2026-09-01.md)

Human verification then exposed duplicate presentation prompts around the date and finalize transitions. The durable business result was not duplicated. The renderer was corrected in:

```text
ed207f8c82ae9138f92fd505209c30c4eeba243b
fix(c1a): prevent duplicate prompts while Temporal advances
```

Post-fix regression:

```text
Run              33560864234
Job              100032737031
Result           SUCCESS
Artifact         9821207955
Artifact SHA256  4f7fc1ddea852a9501f20078d0df8ecc84dc3c645e8b1362424c6d6f11ae37ff
```

A second complete human run on 2026-09-02 confirmed that the Step 08 and Step 11 duplicate prompts were no longer observed, all twelve visible steps reached `COMPLETE`, the WebChat reached `COMPLETED / CREATED / next=NONE`, and the separate Workflow Inspector showed the same final durable state. That run also exercised a newly-created Customer path and Spanish `viernes` date normalization.

Human verification record: [`Test/c1a-webchat-human-verification-2026-09-01.md`](Test/c1a-webchat-human-verification-2026-09-01.md)

### C1B — durable channel semantics 🔧 OPEN

C1A is visually and functionally verified, but the complete WebChat channel gate is not yet closed. Still required:

```text
server-side durable conversation binding
durable inbound-event identity/fingerprint
same-event replay protection
same-identity/different-material conflict
adapter process restart/recovery through durable binding
duplicate browser submit transport proof
```

The current HTML can resume a known `workflowId`; URL/local browser storage is not claimed as canonical server-side conversation authority.

### C2 — Telegram ⏭ AFTER C1B

Telegram will reuse the same CTA/channel contracts and the same visible Workflow projection. Initial transport remains Bot API long polling. A Telegram Workflow can be observed through the same HTML inspector by `workflowId`; the inspector follows Temporal, not the provider.

WhatsApp remains later and its provider mechanism is intentionally not frozen yet.

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
Agent/MCP != current phase
human execution checkpoint != synthetic Temporal phase
known workflowId in browser != durable channel binding
```

Every new capability must receive a contract, executable test evidence, evidence artifact, bounded receipt, and explicit non-claims before it is called certified.

## Current sequence

```text
G0 Foundation                                 ✅ CLOSED

G1 Services Engine
  S0–S5                                       ✅ CERTIFIED
  S6 Multi-business                           🔧 NEXT
  S7 Appointment integration                  ⏭
  S8 Final G1 certification                   ⏭

G2 Scheduler Engine                           ⏭ AFTER G1

G3 CTA channel proof
  C0A Workflow-view projection                ✅ CERTIFIED
  C1A minimal workflow-visible WebChat         ✅ CERTIFIED + HUMAN VERIFIED POST-FIX
  C0B/C1B durable correlation/dedupe           🔧 NEXT CHANNEL HARDENING
  C2 Telegram bot                              ⏭ SECOND CHANNEL
  C3 Telegram webhook parity                   ⏭ OPTIONAL
  C4 WhatsApp                                  ⏭ LATER
```

The Agent/Intelligence layer remains outside this phase until the deterministic Engines platform works correctly through explicit CTA/Temporal contracts.
