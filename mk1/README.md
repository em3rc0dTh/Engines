# MK1 — Stage 2 Certification Program

## Status

**G0 CLOSED — SERVICES S0–S7 CERTIFIED — WEBCHAT C1A+C1B CERTIFIED + HUMAN VERIFIED — TELEGRAM/WHATSAPP OFFICIAL CHANNEL DESIGN ACTIVE**

MK1 starts from the frozen MK0 architecture laboratory and must not weaken or silently reinterpret MK0 invariants. `mk0/runtime` remains untouched.

```text
main / developer
9c0fab032461e889f3d9d297b2d2b375288afda3
```

`developer` remains the stable MK0 integration line; bounded MK1 work stays on explicit branches.

Current snapshot: [`STATUS-2026-09-04.md`](STATUS-2026-09-04.md).
Branch policy: [`../BRANCHES.md`](../BRANCHES.md).

## Current architecture lines

```text
STEP 1 / CTA CHANNELS
CLI / HTTP-Postman historical milestones
WebChat C1A + durable C1B certified and human verified
Telegram C2 official Bot API design active
WhatsApp C4 official Business Platform design active

STEP 3 / SERVICES
S0–S7 certified
S8 final clean G1 closure pending

STEP 4 / SCHEDULER
design prepared; runtime not certified

STEP 5 / INTEGRATION
boundary designed only; provider runtime not certified

AGENT / MCP / LLM ROUTING
intentionally absent
```

## G0 — foundation ✅ CLOSED

```text
CTA / adapter boundary                 ✅ certified foundation
Temporal durable orchestration         ✅ certified foundation
PostgreSQL business authority          ✅ certified foundation
Mongo semantic/execution audit         ✅ certified foundation
AttachmentStore integrity boundary     ✅ certified foundation
```

## G1 — Services Engine

```text
S0 Runtime promotion                   ✅ CERTIFIED
S1 Contracts + persistence             ✅ CERTIFIED
S2 Deterministic reads                 ✅ CERTIFIED
S3 Eligibility + recommendation        ✅ CERTIFIED
S4 Versioned management                ✅ CERTIFIED
S5 Durable Workflow snapshots          ✅ CERTIFIED
S6 Multi-business generality           ✅ CERTIFIED
S7 Appointment integration             ✅ CERTIFIED
S8 Final clean G1 certification        ⏭ PENDING

G1 SERVICES ENGINE                     ❌ NOT YET FULLY CERTIFIED
```

### S7 authority

```text
Branch           build/mk1-s7-appointment-services-integration
Certified source 6fc8814830038b5600c4c6376cd9b4ed7ef34b7a
Run              33668593216
Job              100376325350
Result           SUCCESS
Artifact         9861631780
SHA256           e700cfcdc43e753cbc894abd30211e322097fd010d0ec86dcae01d7d3290dd6a
Docs head         375431ba1a16694ce4cce7d30f9e5b37bc4e3108
```

S7 proves Appointment consumes canonical Services reads, freezes revision-aware selected Service/Offering state, preserves a running selection across catalog N → N+1 publication, and lets a newly started Appointment see N+1.

S7 did not redesign Scheduler.

## Step 4 — Scheduler

The Services/Scheduler boundary remains:

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

No Scheduler runtime is certified yet.

## G3 / Step 1 — CTA multi-channel proof

Current deterministic channel architecture:

```text
Provider transport
      ↓
ChannelAdapter
      ↓
CanonicalChannelEnvelope
      ↓
ChannelExecutionCore
      ↓
PostgreSQL durable channel ledger
      ↓
Temporal
      ↓
same Workflow Library
```

Provider differences terminate at adapter/renderer boundaries.

### C1A — visible WebChat ✅

Minimal HTML/CSS/JS WebChat + live Workflow inspector + deterministic 12-step view. Human post-fix verification complete.

### C1B — durable WebChat ✅

```text
Source SHA       2008fce4f863fdabf8e8f323eee1d7cda05cb454
Run              33647842017
Job              100307008849
Artifact         9853555059
SHA256           efa65255fdc4c8569f55cefd38202145d2feb5a275d1c897f4b58dbb10a023bf
```

C1B proves durable conversation/event correlation, replay/conflict semantics and physical WebChat process restart/recovery to the same Temporal Workflow. The user manually repeated restart/recovery successfully.

### C2 — Telegram 🔧 DESIGN ACTIVE

Target: official Telegram Bot API.

Initial transport: `getUpdates` long polling; webhook parity remains optional C3.

```text
Telegram Bot API
      ↓
TelegramTransport
      ↓
TelegramAdapter
      ↓
CanonicalChannelEnvelope
      ↓
existing ChannelExecutionCore
```

Physical bot testing is intentionally deferred.

### C4 — WhatsApp 🔧 DESIGN ACTIVE

Official transport only.

Default provider target:

```text
Meta WhatsApp Cloud API
```

Optional provider/operations layer:

```text
Kapso
```

Kapso must remain behind a provider seam; it must not become Engines business authority.

```text
WhatsAppTransportPort
  ├── MetaCloudApiTransport      default
  └── KapsoTransport             optional
          ↓
    WhatsAppAdapter
          ↓
CanonicalChannelEnvelope
          ↓
existing ChannelExecutionCore
```

Unofficial WhatsApp Web automation, QR-session scraping, browser emulation and reverse-engineered clients are explicitly rejected.

References:

- [`Brainstorming/06-telegram-whatsapp-official-channels.md`](Brainstorming/06-telegram-whatsapp-official-channels.md)
- [`mining-site/quarries/quarry-04-official-messaging-channel-providers.md`](mining-site/quarries/quarry-04-official-messaging-channel-providers.md)
- [`Design/10-c2-c4-official-messaging-channel-contract.md`](Design/10-c2-c4-official-messaging-channel-contract.md)
- [`Plan/06-telegram-whatsapp-official-channel-gates.md`](Plan/06-telegram-whatsapp-official-channel-gates.md)

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
unofficial WhatsApp transport != acceptable proof
Agent/MCP != current phase
```

## Current sequence

```text
G0 Foundation                         ✅ CLOSED
C1A/C1B WebChat                       ✅ CERTIFIED + HUMAN VERIFIED
G1 Services S0–S7                     ✅ CERTIFIED
C2 Telegram official design           🔧 CURRENT
C4 WhatsApp official design           🔧 CURRENT
C2 automated build/proof              ⏭ NEXT
C4 automated build/proof              ⏭ AFTER PROVIDER SEAM
Physical Telegram/WhatsApp test       ⏭ DEFERRED
G1 S8 clean closure                   ⏭ PENDING
G2 Scheduler runtime                  ⏭ LATER
Agent / MCP                           ⏭ LAST
```
