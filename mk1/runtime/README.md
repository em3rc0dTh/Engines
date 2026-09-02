# MK1 Runtime

Executable Stage-2 laboratory for Engines. S0 promoted the certified MK0 runtime into this directory; later gates evolve `mk1/runtime` without rewriting the frozen `mk0/runtime` evidence base.

## Current status

```text
Inherited MK0 runtime             ✅ certified baseline
RegisterNewCustomer               ✅ regression protected
AttachmentStore/B7                ✅ regression protected
RegisterNewAppointment            ✅ regression protected
Services S1–S5                    ✅ certified
WebChat C0A workflow view         ✅ certified
WebChat C1A visible E2E flow      ✅ certified + human verified
WebChat C1B durable channel       ✅ certified
Services S6                       🔧 next Services gate
Telegram C2                       🔧 next channel gate
Scheduler Engine                  ❌ not certified
Agent / MCP                       ❌ intentionally absent
Production deployment             ❌ not certified
```

Canonical status: [`../README.md`](../README.md)

C1B gate/receipt:

- [`../Plan/03-c1b-durable-channel-gate.md`](../Plan/03-c1b-durable-channel-gate.md)
- [`../Build/evidence/c1b-durable-channel-certification-2026-09-02.md`](../Build/evidence/c1b-durable-channel-certification-2026-09-02.md)
- [`../Test/c1b-durable-channel-semantics-2026-09-02.md`](../Test/c1b-durable-channel-semantics-2026-09-02.md)

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
Channel Core       127.0.0.1:8788
WebChat            127.0.0.1:8790
Temporal gRPC      localhost:7233
Temporal UI        localhost:8233
```

Inherited package/task-queue names still contain `mk0` because S0 promoted the certified runtime exactly. Renaming remains a separate compatibility decision.

## Install and verify

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

Channel regression:

```bash
npm run test:channel:c0
npm run test:channel:c1b
```

## Start local laboratory

```bash
docker compose up --build -d
docker compose ps
curl -fsS http://127.0.0.1:8787/health
curl -fsS http://127.0.0.1:8788/health
```

For a destructive clean run:

```bash
docker compose down -v --remove-orphans
docker compose up --build -d
```

Current Compose dependency shape:

```text
PostgreSQL + MongoDB
        ↓
      migrate
        ↓
      Temporal
        ↓
       Worker
      ↙     ↘
    CTA    Channel Core
```

The migration service now applies the inherited Customer/Appointment/Services migrations plus:

```text
007_channel_adapter_durability.sql
```

## C1B channel architecture

```text
raw transport event
        ↓
ChannelAdapterRegistry
        ↓
provider adapter
        ↓
CanonicalChannelEnvelope
        ↓
ChannelExecutionCore
        ↓
PostgreSQL durable correlation
        ↓
existing Temporal operation identity
        ↓
RegisterNewAppointment Workflow
```

There is no Agent, MCP, LLM router or provider-specific Appointment Workflow.

### Canonical actions

C1B currently exposes the explicit Appointment actions needed for the proof:

```text
START_APPOINTMENT
PROVIDE_CUSTOMER
RESOLVE_CUSTOMER
SELECT_SERVICE
SELECT_OFFERING
SET_DATE
SELECT_SLOT
FINALIZE_APPOINTMENT
```

These are explicit operations, not inferred intents.

### Adapter composition

`ChannelAdapterRegistry` resolves adapters by transport type. `WebChatAdapter` is the first certified adapter. Telegram C2 must register another adapter against the same canonical envelope and execution core rather than adding business branches.

## Durable channel persistence

### `channel_conversation_bindings`

Operational authority for:

```text
business scope
channel
external conversation identity
workflowId
operation
ACTIVE / COMPLETED / FAILED binding status
```

The key property is restart-safe recovery:

```text
externalConversationId
→ PostgreSQL binding
→ same Temporal workflowId
```

### `channel_inbound_events`

Operational authority for:

```text
business scope
channel
external message identity
external conversation identity
canonical material hash
PROCESSING / APPLIED / REJECTED
terminal response
error code
```

These tables are transport/correlation truth only. They do not duplicate canonical Appointment business state.

## Replay and conflict semantics

Canonical fingerprinting uses deterministic sorted-object JSON plus SHA-256.

```text
same business + channel + externalMessageId
+ same canonical material
→ exact replay
→ durable stored terminal result when available

same logical identity
+ different canonical material
→ CHANNEL_EVENT_IDENTITY_CONFLICT
→ no conflicting Workflow mutation
```

The event identity also derives the existing Temporal logical-operation identity:

```text
channel:<channel>:<externalMessageId>
```

For Workflow start it becomes the Appointment idempotency key. For Workflow Updates it becomes the Appointment `inputId`.

This is important for the crash window:

```text
Temporal effect succeeds
→ adapter dies before event row is finalized
→ transport retries same event
→ same Temporal logical identity
→ no second logical business effect
```

## Channel Core HTTP surface

Default port `8788`:

```text
GET  /health
POST /channel/events
GET  /channel/conversations/:externalConversationId?businessSlug=<slug>&channel=<kind>
```

Health explicitly reports:

```text
persistence=postgresql
orchestration=temporal
agent=false
mcp=false
```

## Hardened WebChat

Start after Compose is healthy:

```bash
npm run webchat:server
```

Open:

```text
http://127.0.0.1:8790/webchat/
```

C1B WebChat uses a durable external conversation identity. The browser may store that identity for convenience, but it no longer needs to own the `workflowId` binding.

State recovery path:

```text
browser conversationId
→ /api/channel/conversations/<conversationId>/view
→ Channel Core
→ PostgreSQL binding
→ Temporal Workflow query
→ C1A Workflow view
```

The same separate inspector remains available:

```text
http://127.0.0.1:8790/webchat/workflow.html?workflowId=<workflowId>
```

It follows Temporal, not the transport provider.

## Visible Appointment map retained

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

Human data-capture checkpoints do not invent Temporal phases. `phase` and `nextAction` remain separately visible.

## C1B certification probes

Automated full probe:

```bash
npm run probe:webchat:c1b
```

CI splits it around a real WebChat process restart:

```bash
C1B_PHASE=prepare npm run probe:webchat:c1b
# stop/start WebChat adapter process
C1B_PHASE=complete npm run probe:webchat:c1b
```

Successful certification authority:

```text
Source SHA       2008fce4f863fdabf8e8f323eee1d7cda05cb454
Run              33647842017
Job              100307008849
Artifact         9853555059
Artifact SHA256  efa65255fdc4c8569f55cefd38202145d2feb5a275d1c897f4b58dbb10a023bf
```

Observed restart:

```text
WebChat PID before  7982
WebChat PID after   8190
```

Direct markers:

```text
WEBCHAT_C1B_PRE_RESTART_PASS
WEBCHAT_C1B_DURABLE_CHANNEL_PASS
WEBCHAT_C1_WORKFLOW_VISIBILITY_PASS
```

Final C1B evidence reported:

```text
finalPhase=CREATED
workflowStatus=COMPLETED
allVisibleStepsComplete=true
bindingRecoveredAfterAdapterRestart=true
exactStartReplay=true
exactUpdateReplay=true
materialConflictRejected=true
conflictMutationFree=true
terminalReplayFromDurableLedger=true
agent=false
mcp=false
```

## C1B failure provenance

First run `33647731151` failed strict TypeScript typecheck before runtime because the replay fallback violated `exactOptionalPropertyTypes`. The strict response construction was corrected in source `2008fce4...`; no business/channel invariant was weakened.

## Services through S5

Services currently include generic Service/Offering contracts, deterministic read/recommendation, Temporal-managed versioned mutation commands, PostgreSQL canonical truth, Mongo semantic audit, optimistic revision control, and durable revision-specific Workflow snapshots.

S6 remains the next Services gate; G1 is not complete.

## Persistence authority

```text
Temporal
  durable orchestration / Event History / Workflow state

PostgreSQL
  Customer/Appointment/Services canonical transactional truth
  channel conversation/event operational correlation truth

MongoDB
  semantic/execution audit, not shadow business/channel binding truth

AttachmentStore
  binary/document integrity boundary
```

## Next channel gate — C2 Telegram

Telegram must reuse:

```text
CanonicalChannelEnvelope
ChannelAdapterRegistry
ChannelExecutionCore
channel_conversation_bindings
channel_inbound_events
same Temporal Workflow Library
same C1A Workflow projection
```

Initial delivery mechanism remains Telegram Bot API long polling. Transport identity such as Telegram `update_id` must map into the existing event identity semantics; Telegram must not redefine Appointment behavior.

## Stop vs reset

Preserve data/history:

```bash
docker compose down
```

Destructive reset:

```bash
docker compose down -v --remove-orphans
```

## Scope boundary

This remains a Stage-2 architecture laboratory. C1B does not certify Telegram, WhatsApp, full G3, full G1 Services closure, Scheduler, Agent, MCP, production security or production deployment.
