# MK1 Runtime

Executable Stage-2 laboratory for Engines. S0 promoted the exact certified MK0 runtime tree into this directory; later gates evolve `mk1/runtime` without rewriting the frozen `mk0/runtime` evidence base.

## Current status

```text
Inherited MK0 runtime             ✅ certified baseline
RegisterNewCustomer               ✅ regression protected
AttachmentStore/B7                ✅ regression protected
RegisterNewAppointment            ✅ regression protected
Services S1 contracts             ✅ certified
Services S2 deterministic reads   ✅ certified
Services S3 recommendation        ✅ certified
Services S4 management mutations  ✅ certified
Services S5 durable snapshots     ✅ certified
WebChat C0A workflow view         ✅ certified
WebChat C1A visible E2E flow      ✅ certified
Services S6                       🔧 next Services gate
WebChat C1B durable binding       🔧 next channel hardening
Scheduler Engine                  ❌ not certified
Telegram                          ❌ not implemented yet
Agent / MCP                       ❌ intentionally absent
Production deployment             ❌ not certified
```

Canonical status: [`../README.md`](../README.md)

Services plan: [`../Plan/01-services-engine-gates.md`](../Plan/01-services-engine-gates.md)

Channel plan: [`../Plan/02-cta-multichannel-poc-gates.md`](../Plan/02-cta-multichannel-poc-gates.md)

Workflow visibility contract: [`../Design/03-workflow-visibility-contract.md`](../Design/03-workflow-visibility-contract.md)

## Runtime profile

```text
Node.js            >= 20
Certified CI Node  24.19.0
TypeScript         7.0.2
Temporal TS SDK    1.22.0
Temporal CLI       1.8.1 in Compose image
Task Queue         engines-mk0-registration
PostgreSQL         17.8
MongoDB            8.0.29
CTA HTTP           127.0.0.1:8787
WebChat PoC        127.0.0.1:8790
Temporal gRPC      localhost:7233
Temporal UI        localhost:8233
```

Inherited package/task-queue names still contain `mk0` because S0 promoted the certified runtime exactly. Renaming is a separate compatibility decision.

## Install and typecheck

```bash
cd mk1/runtime
npm ci
npm run check
```

Inherited regression:

```bash
npm run test:b1
npm run test:b3
npm run test:b7
npm run test:lab-console
npm run test:appointment
```

Services regression:

```bash
npm run test:services:s1
npm run test:services:s2
npm run test:services:s3
npm run test:services:s4
```

Channel/view regression:

```bash
npm run test:channel:c0
```

## Start the local Temporal laboratory

```bash
docker compose up --build -d
docker compose ps
curl -fsS http://127.0.0.1:8787/health
```

For a destructive clean certification run:

```bash
docker compose down -v --remove-orphans
docker compose up --build -d
```

Compose dependency chain:

```text
PostgreSQL + MongoDB
        ↓
      migrate
        ↓
      Temporal
        ↓
       Worker
        ↓
        CTA
```

## WebChat C1A — minimal visual proof

No framework is required. The C1A server serves static HTML/CSS/JS and forwards explicit Appointment operations to the already-existing CTA HTTP boundary.

Start it after the Compose laboratory is healthy:

```bash
npm run webchat:server
```

Open:

```text
http://127.0.0.1:8790/webchat/
```

The chat page shows continuously:

```text
workflowId
workflowStatus
Temporal phase
nextAction
human-readable workflow steps
raw durable state
```

From the active chat, open the separate inspector or use:

```text
http://127.0.0.1:8790/webchat/workflow.html?workflowId=<workflowId>
```

The inspector shows:

```text
Workflow ID
Run ID
Workflow status
Temporal phase
next action
last refresh
all visible steps
Customer projection
selected Service
selected Offering/Product
Appointment date
available slots
selected slot
issues
terminal result
raw Workflow response
```

Both pages poll the same real durable Workflow state. The browser does not own a parallel phase machine.

## Visible Appointment execution map

The provider-independent CTA view projects the current durable Appointment state into:

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

The current `RegisterNewAppointment` domain contract has one Customer `name` field plus contact email/phones. The UI does not fabricate a separate surname domain field.

Customer name/email/phone rows are human data-capture checkpoints, not new Temporal phases. The actual phase remains one of the canonical Appointment phases and is always displayed separately.

## WebChat execution boundary

```text
HTML WebChat
   ↓
WebChat transport server
   ↓
existing CTA HTTP routes
   ↓
Temporal
   ↓
RegisterNewAppointment
```

Explicitly absent:

```text
Agent
MCP
LLM orchestration
semantic intent router
AI tool selection
```

The interaction is deterministic like the CLI: the UI renders legal choices and submits explicit Workflow updates.

## WebChat certification probe

```bash
npm run probe:webchat:c1
```

The successful certification executed the full path through the WebChat transport:

```text
Start
→ Customer name
→ Customer email
→ Customer phone
→ Resolve Customer
→ Service
→ Offering
→ Date
→ Slots
→ Slot
→ Finalize
→ CREATED
```

Final C1A authority:

```text
Source SHA       860629e9ada498e225ae803a9fe6f077949ec320
Run              33542468975
Job              99971830150
Artifact         9814172765
Artifact SHA256  a12fa1b0283524948d5fa0d253953c5588ba2692a5cc0bbee93ded65265656f3
Marker           WEBCHAT_C1_WORKFLOW_VISIBILITY_PASS
```

All twelve visible steps reached `COMPLETE`, final phase was `CREATED`, and the health/proof surface reported `agent=false` and `mcp=false`.

Receipt: [`../Build/evidence/c1a-webchat-workflow-visibility-certification-2026-09-01.md`](../Build/evidence/c1a-webchat-workflow-visibility-certification-2026-09-01.md)

## C1A versus C1B

C1A is ready for visual/manual testing, but it is not the complete durable channel gate.

Current C1A resume behavior can use a known `workflowId` from URL/local browser storage. This is not canonical server-side transport correlation.

C1B still must add and certify:

```text
server-side durable ChannelConversationBinding
server-side ChannelInboundEvent identity/fingerprint
same-event replay protection
same-identity/different-material conflict
adapter-process restart/recovery
duplicate browser-submit transport semantics
```

These belong to the CTA/channel boundary, not to Customer/Services/Scheduler business logic.

## Services through S5

Services currently include generic Service/Offering contracts, deterministic read/recommendation, Temporal-managed versioned mutation commands, PostgreSQL canonical truth, Mongo semantic audit, optimistic revision control, and durable revision-specific Workflow snapshots.

S4 final certification:

```text
Source SHA       f3e54b853af5f01fb2e9ed7d032f784e3cffb81e
Run              33538554471
Artifact         9812703293
```

S5 final certification:

```text
Source SHA       7568618062f4192b34caf6e916b58534f304ad3f
Run              33539683548
Artifact         9813129778
```

S5 proved a Workflow kept revision `N` while S4 published `N+1`, survived Worker restart, completed using `N`, and a new Workflow observed `N+1`.

## Persistence authority

### PostgreSQL

Canonical business truth includes inherited Customer/Appointment data plus Services catalog and management command truth.

### MongoDB

Semantic audit contains inherited execution/appointment evidence plus Services mutation audit. Mongo is not canonical Customer/Appointment/Services truth.

### AttachmentStore

Local laboratory filesystem provider remains the certified binary boundary. Channel binary/media work must converge on this boundary rather than place blobs into business tables.

## Stop vs reset

Preserve data/history:

```bash
docker compose down
```

Destructive laboratory reset:

```bash
docker compose down -v --remove-orphans
```

## Scope boundary

This remains a Stage-2 architecture laboratory. Current certification does not claim full G1 closure, Scheduler, Telegram, WhatsApp, full durable multi-channel correlation, Agent, MCP, or production deployment.
