# C1B — Durable Channel Gate Plan

## Status

**BUILD ACTIVE**

Parent proof:

```text
C0A Workflow view               ✅ CERTIFIED
C1A WebChat workflow visibility ✅ CERTIFIED + HUMAN VERIFIED POST-FIX
C1B durable channel semantics   🔧 THIS GATE
C2 Telegram                     ⏭ AFTER C1B
```

## Build order

### B1 — contract and migration

- canonical channel types;
- canonical material fingerprint;
- PostgreSQL `channel_conversation_bindings`;
- PostgreSQL `channel_inbound_events`;
- migration runner and Compose integration.

### B2 — repository semantics

Implement transactional repository operations for:

```text
claimInboundEvent
completeInboundEvent
rejectInboundEvent
getConversationBinding
bindConversation
updateBindingStatus
```

Required unit/integration proofs: exact replay, conflict, business isolation, restart-safe reads.

### B3 — adapter + registry

Implement:

```text
WebChatAdapter
ChannelAdapterRegistry
CanonicalActionRegistry
```

No provider-specific branch is allowed in Appointment/Services/Scheduler/Workflow code.

### B4 — hardened WebChat channel endpoint

Introduce generic WebChat channel API that:

- receives raw WebChat event;
- resolves adapter by registry;
- claims durable event;
- resolves/creates durable binding;
- invokes existing CTA/Temporal operation using stable event-derived idempotency identity;
- persists terminal response;
- returns Workflow projection.

### B5 — browser migration

C1A browser switches from direct CTA proxy routes to the hardened channel endpoint while keeping the same visible 12-step Workflow map.

The browser keeps `externalConversationId` only as transport identity. It no longer treats `workflowId` local storage as binding authority.

### B6 — certification probe

Clean Compose proof must execute:

```text
new conversation
start event
exact start replay
customer data event
exact customer replay
material-conflict attempt
assert no state change
continue workflow
restart WebChat adapter process
recover binding by conversation id
continue same workflow
finalize
assert CREATED
```

Capture PostgreSQL rows and Workflow projection.

## Golden requirements

- one binding for one `(business,channel,externalConversationId)`;
- one event row for one `(business,channel,externalMessageId)`;
- exact replay is response-stable;
- conflict is typed and mutation-free;
- same event identity can be independent across business scopes;
- process restart does not change workflow identity;
- final Appointment business result remains singular;
- visibility still shows all real Temporal phases/checkpoints.

## CI gate

New workflow:

```text
.github/workflows/mk1-c1b-durable-channel.yml
```

Minimum steps:

```text
npm ci
npm run check
C0 view tests
C1B channel-core tests
inherited Customer/CTA/Appointment regressions
clean docker compose up
wait CTA + Worker
start WebChat server
run C1B probe
restart WebChat server
complete C1B probe
capture postgres/channel/worker/webchat evidence
upload artifact
cleanup
```

## Stop conditions

Stop and redesign if any of these appear:

```text
browser/localStorage is required to recover workflowId
same event id can produce a second Workflow update
same event id + different payload reaches Temporal
WebChat server memory is required for conversation recovery
provider name appears in Appointment Workflow policy
channel repository stores duplicate Appointment business truth
Agent/MCP/LLM is introduced
```

## Claim boundary

Passing C1B permits only:

> The WebChat channel can durably correlate one external conversation to one Temporal Workflow and safely process at-least-once inbound events across exact replay, material conflict, and adapter restart.

It does not certify Telegram, WhatsApp, production security, Scheduler, full G3, Agent, or MCP.
