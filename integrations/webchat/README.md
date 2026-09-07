# Integration Registry — WebChat

## Identity

```text
Integration       WebChat
Repository target Engines-Integration-WebChat
Primary MK        MK1
Provider          native web transport
Current status    ✅ C1A + C1B CERTIFIED / HUMAN VERIFIED
```

## Current source lineage

```text
build/mk1-c0-c1-webchat        C1A visible Workflow-driven WebChat
build/mk1-c1b-durable-channel  C1B durable conversation/event semantics
build/mk1-customer-channels-integrated  consolidated current customer/channel anchor
```

## Architecture

```text
Browser WebChat
→ WebChat adapter
→ CanonicalChannelEnvelope
→ ChannelExecutionCore
→ PostgreSQL durable channel ledger
→ Temporal
→ RegisterNewCustomer / same Workflow Library
```

WebChat does not own the Customer state machine. The UI renders the current live Workflow projection (`knownFields`, `missingFields`, `nextAction`, phase/status) and sends canonical operations back through the channel core.

## Brainstorming

WebChat was the first visual proof that the provider/channel surface can remain replaceable while the conversation state survives outside browser memory.

Key question answered:

> Can the browser disappear/restart without becoming the authority for the business conversation?

C1B proved yes.

## Mining Site / Quarries

Relevant evidence is preserved in MK1 WebChat Build/Test history. The C1B restart/recovery human observation is especially important because it separates durable channel authority from process/browser memory.

## Architecture decisions

```text
same externalMessageId + same normalized material      replay
same externalMessageId + different normalized material conflict
conversation binding                                   PostgreSQL durable truth
Workflow state                                         Temporal truth
browser/session memory                                  non-authoritative
```

## Design

The visible UI is a projection of canonical Workflow state. WebChat cannot hard-code a parallel question sequence that diverges from Temporal.

## Plan / gates

```text
C1A visible E2E                    ✅ closed
C1B durable replay/conflict        ✅ closed
C1B process/browser restart        ✅ human verified
provider-specific extraction       ⚪ repository administration step
```

## Build authority

C1B certified source:

```text
Source SHA  2008fce4f863fdabf8e8f323eee1d7cda05cb454
Run         33647842017
Job         100307008849
Artifact    9853555059
SHA-256     efa65255fdc4c8569f55cefd38202145d2feb5a275d1c897f4b58dbb10a023bf
```

## Test / Evidence

Human restart/recovery was observed against the same durable Workflow. Do not upgrade this to production web hosting/security certification.

## Golden expectations

Core channel replay/conflict behavior is shared with later Telegram/WhatsApp adapters and should remain provider-neutral when WebChat is extracted.

## Bootstrap

```bash
git fetch origin --prune
git switch build/mk1-customer-channels-integrated
cd mk1/runtime
npm ci
npm run check
docker compose up --build -d
curl -fsS http://127.0.0.1:8788/health
```

For historical source reproduction only, use the exact C1A/C1B branch and receipt source SHA.

## Non-claims

```text
production web hosting
public auth/security hardening
CDN/browser compatibility matrix
Scheduler runtime
Agent/MCP/LLM routing
```

## Extraction checklist

Move only WebChat-specific transport/UI code into `Engines-Integration-WebChat`. Keep `ChannelExecutionCore`, Customer rules and Temporal Workflow contracts owned by Engines.
