# C1A — WebChat Workflow Visibility Certification Receipt

## Verdict

**✅ CERTIFIED — BOUNDED G3 / C1A CLAIM**

C1A certifies a minimal HTML/CSS/JS WebChat surface that drives the existing explicit CTA → Temporal `RegisterNewAppointment` flow and exposes the durable Workflow state throughout the interaction.

This is deliberately a bounded WebChat proof. It does **not** yet certify durable cross-process channel-conversation binding, transport-event dedupe, Telegram, WhatsApp, Agent, MCP, Scheduler, or full G3 multi-channel closure.

## Executed source

```text
Branch        build/mk1-c0-c1-webchat
Source SHA    860629e9ada498e225ae803a9fe6f077949ec320
Run           33542468975
Job           99971830150
Result        SUCCESS
Artifact      9814172765
Artifact SHA  a12fa1b0283524948d5fa0d253953c5588ba2692a5cc0bbee93ded65265656f3
```

## Architectural boundary proved

```text
Browser WebChat
      ↓
minimal WebChat transport server
      ↓
existing canonical CTA HTTP surface
      ↓
Temporal
      ↓
RegisterNewAppointment Workflow
      ↓
existing persistence/audit boundaries
```

The WebChat does not add an Agent, MCP, LLM orchestration, semantic intent router, or a second durable workflow state machine.

The `/health` proof explicitly reports:

```text
agent=false
mcp=false
```

## Two HTML surfaces

C1A implements and executes against:

```text
/webchat/
  conversational interaction surface

/webchat/workflow.html?workflowId=<id>
  live engineering Workflow inspector
```

The chat page continuously exposes:

```text
workflowId
workflowStatus
Temporal phase
nextAction
human-readable execution steps
raw durable state
```

The inspector exposes:

```text
workflowId
runId
workflowStatus
Temporal phase
nextAction
last refresh time
all visible execution steps
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

Both surfaces read the same durable Workflow projection. The inspector follows `workflowId`, not a provider-specific conversation implementation.

## Human-visible execution map

The presentation layer deterministically projects the real Appointment state into this checklist:

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

Important distinction:

```text
Temporal phase
!=
human data-capture checkpoint
```

`Customer name`, `Customer email`, and `Customer phone` are presentation checkpoints derived from the durable Customer draft. They do not invent new Temporal phases.

The real Temporal phase and `nextAction` remain visible and authoritative throughout the flow.

## Direct runtime marker

The final run produced:

```text
WEBCHAT_C1_WORKFLOW_VISIBILITY_PASS
```

with terminal evidence:

```text
workflowId  register-appointment:golden-business:959838e7117266787758d40fcec08e03
runId       01a05e2f-445b-76a1-8efe-d40312bf6008
finalPhase  CREATED
agent       false
mcp         false
```

All twelve visible steps were reported `COMPLETE`:

```text
1:WORKFLOW_START:COMPLETE
2:CUSTOMER_NAME:COMPLETE
3:CUSTOMER_EMAIL:COMPLETE
4:CUSTOMER_PHONE:COMPLETE
5:CUSTOMER_RESOLUTION:COMPLETE
6:SERVICE_SELECTION:COMPLETE
7:OFFERING_SELECTION:COMPLETE
8:DATE_SELECTION:COMPLETE
9:SLOTS_LOADING:COMPLETE
10:SLOT_SELECTION:COMPLETE
11:FINALIZE_APPOINTMENT:COMPLETE
12:APPOINTMENT_CREATED:COMPLETE
```

## Executed interaction

The certification probe used the WebChat transport surface to execute the complete Appointment path:

```text
Start Workflow
→ WAITING_FOR_CUSTOMER
→ provide Customer name
→ provide Customer email
→ provide Customer phone
→ Resolve Customer
→ WAITING_FOR_SERVICE
→ select Service
→ WAITING_FOR_PRODUCT
→ select Offering/Product
→ WAITING_FOR_DATE
→ submit human date input: viernes
→ WAITING_FOR_SLOT
→ select an available slot
→ READY_TO_FINALIZE
→ Finalize Appointment
→ CREATED
```

The probe checked the human-visible execution projection after each major durable transition rather than merely checking for a final HTTP 200.

## C0 presentation projection evidence

The same successful run executed four provider-independent projection tests:

```text
C0 view exposes customer capture checkpoints without inventing Temporal phases
C0 view advances deterministic customer data checkpoints from durable draft state
C0 view marks provider-independent business selections from Workflow state
C0 view exposes terminal completion and failure explicitly
```

Result:

```text
4 tests
4 pass
0 fail
```

This projection lives under CTA channel-core code and is intended to be reusable by later renderers such as Telegram rather than duplicated inside each provider adapter.

## Regression evidence

Before starting the WebChat laboratory, the same successful run passed:

```text
strict TypeScript typecheck
RegisterNewCustomer contract regression
CLI CTA regression
RegisterNewAppointment date/contract regression
clean Compose laboratory startup
canonical CTA health
Worker readiness
```

The full WebChat Appointment execution then passed on top of those inherited boundaries.

## Evidence artifact

Artifact `9814172765` contains captured WebChat/CTA/Worker evidence including:

```text
git-sha.txt
webchat.log
webchat-c1-proof.txt
webchat-health.json
cta-health.json
compose-ps.txt
worker.log
cta.log
```

Digest:

```text
sha256:a12fa1b0283524948d5fa0d253953c5588ba2692a5cc0bbee93ded65265656f3
```

## Failure provenance

The first C1A run remains part of the evidence history:

```text
Run      33542360241
Result   FAILURE
Cause    strict TypeScript RequestInit/BodyInit incompatibility in WebChat proxy
Stage    typecheck, before Temporal/WebChat runtime execution
```

The fix converted the proxied JSON body to an explicit UTF-8 request body compatible with the strict `RequestInit` contract. No Workflow, persistence, idempotency, or business invariant was relaxed.

Successful run `33542468975` supersedes that attempt as C1A authority.

## What C1A certifies

C1A allows this bounded statement:

> Engines can expose the existing CLI-style explicit CTA → Temporal Appointment workflow through a minimal HTML WebChat while continuously showing the real durable Workflow phase, next action, captured business projection, and a deterministic human-readable execution checklist through terminal creation.

## What remains open before full C1 closure

The broader channel plan requires durable channel transport semantics that C1A intentionally does not yet claim:

```text
C1B — durable conversation binding
C1B — durable inbound event identity/dedupe
C1B — adapter process restart and conversation recovery
C1B — duplicate browser submission transport proof
C1B — canonical transport conflict semantics
```

The current browser can resume a known `workflowId` through URL/local browser storage, but this is not equivalent to a server-side durable `ChannelConversationBinding` authority.

Therefore:

```text
C1A workflow-visible WebChat PoC     ✅ CERTIFIED
C1B durable channel semantics        ❌ OPEN
full C1 channel gate                 ❌ NOT YET CLOSED
```

## Explicit non-claims

C1A does not certify:

```text
Agent
MCP
LLM orchestration
semantic intent inference
Telegram
WhatsApp
full multi-channel equivalence
server-side durable channel binding
provider-event dedupe
Scheduler Engine
full G1 Services Engine closure
production deployment
```
