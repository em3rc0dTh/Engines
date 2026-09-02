# MK1 Design Index

## Current architecture design focus

```text
1 CTA / Channels
  C1A WebChat visibility                 ✅ CERTIFIED
  C1B durable channel semantics          ✅ CERTIFIED + HUMAN VERIFIED
  C2 Telegram                            DESIGN / BUILD PREPARATION

2 Temporal Orchestration                 ✅ FOUNDATION CERTIFIED

3 Services Engine
  S0–S5                                  ✅ CERTIFIED
  S6–S8                                  COMPLETION DESIGN
  Services→Scheduler handoff             DESIGN FROZEN CANDIDATE

4 Scheduler Engine                       ACTIVE DESIGN

5 Integration Engine                     BOUNDARY DESIGN

8 Agent / MCP / Intelligence             DEFERRED
```

## Canonical design documents

### Foundation

- `00-foundation-contract.md`

### Step 3 — Services

- `01-services-engine-contract.md`
- `05-services-scheduler-boundary.md`
- `09-services-engine-completion-contract.md`

The Services Engine answers what a business offers and freezes immutable Offering semantics for running Workflows. It does not own concrete availability/resources. The S6–S8 completion addendum now defines multi-business proof, canonical Appointment consumption and the abstract scheduling requirement carried inside the selected Offering snapshot.

### Step 4 — Scheduler

- `06-scheduler-engine-contract.md`

Scheduler owns generic resources, capabilities, schedules/overrides, capacity, candidate availability, holds, reservations, assignments and conflict lifecycle.

Frozen invariant:

```text
availability shown != reservation persisted
```

### Step 5 — Integration

- `07-integration-engine-boundary.md`

Integration owns provider adapters/delivery mechanics, not Customer/Services/Scheduler/Appointment truth.

### CTA / Channels

- `02-cta-channel-adapter-contract.md`
- `03-workflow-visibility-contract.md`
- `04-c1b-durable-channel-contract.md`
- `08-c2-telegram-adapter-contract.md`

Interactive Telegram remains Step 1 CTA. It is not moved into Step 5 merely because Telegram is an external API.

## Target deterministic architecture

```text
WebChat / Telegram / future channels
              ↓
       Channel Adapter
              ↓
   CanonicalChannelEnvelope
              ↓
      ChannelExecutionCore
              ↓
          Temporal
      ┌───────┼────────┐
      ↓       ↓        ↓
 Services  Scheduler  Integration Ports
      ↓       ↓        ↓
      └──── PostgreSQL ┘
            canonical truths by domain
```

Mongo remains semantic/audit evidence and AttachmentStore remains binary/document truth.

## Current design branch

```text
design/mk1-services-scheduler-integration
```

This branch is documentation/design work only. It does not alter the certified runtime source SHAs for Services S0–S5 or WebChat C1A/C1B.

## Next design/build transition

```text
Services      continue S6–S8 on Services certification line
Scheduler     open G2-S0 build branch after design review
Telegram      implement synthetic C2 proof on channel line; physical Bot API test deferred
Integration   retain boundary design until first concrete provider gate
```
