# G3 — CTA Multi-Channel Proof Plan

## Status

**DESIGN/PLAN ONLY — EXECUTION DEFERRED UNTIL ENGINE PREREQUISITES ARE STABLE**

Target proof channels:

```text
WebChat
Telegram
WhatsApp
```

This plan is intentionally developed in parallel with G1/G2 so the CTA contract does not become an afterthought. It does **not** authorize mixing channel runtime code into Services or Scheduler branches.

## Goal

Prove that materially different channels can drive one canonical Engines orchestration surface with equivalent business semantics.

The proof must distinguish:

```text
transport correctness
from
business workflow correctness
```

A channel PASS means the adapter safely transports/correlates canonical operations. It does not mean the channel owns Customer, Services, Scheduler or persistence rules.

## Proposed gates

### C0 — Canonical channel contract freeze

Freeze:

- `CanonicalChannelEnvelope`;
- canonical outbound response;
- durable conversation binding model;
- provider-event duplicate identity;
- attachment staging contract;
- transport conflict semantics;
- business-routing trust boundary;
- secret/redaction policy.

Required evidence:

- contract tests independent of provider;
- duplicate event same material → replay/no second effect;
- duplicate identity different material → transport conflict;
- no business policy fields that force channel-specific Workflow logic.

### C1 — WebChat controlled PoC

Build the smallest useful local browser surface.

Preferred shape:

```text
static browser UI
→ WebChat CTA adapter
→ canonical envelope
→ existing orchestration port
→ Temporal
```

Required proof:

- start and continue one real durable Workflow;
- adapter/browser restart does not lose durable correlation;
- choices/buttons map to canonical updates;
- no frontend-owned Workflow state machine;
- duplicate HTTP submit does not duplicate business effects;
- AttachmentStore path for one file if the selected Golden scenario includes media.

### C2 — Telegram polling PoC

Use Bot API long polling first so external conversational behavior can be proven without requiring public webhook infrastructure.

Required proof:

- `update_id`/message identity dedupe;
- chat → durable Workflow correlation;
- text mapping;
- callback button mapping;
- one attachment/media path;
- adapter restart/recovery;
- same canonical Workflow scenario as WebChat.

### C3 — Telegram webhook parity

Replace only ingress transport:

```text
polling → webhook
```

Required proof:

- same canonical envelope produced for equivalent Telegram events;
- no Workflow/Services/Scheduler code change required for transport switch;
- webhook authenticity/security boundary documented and exercised;
- retry/duplicate provider events remain safe.

### C4 — WhatsApp external PoC

Target official WhatsApp Business/Cloud-API style integration rather than browser automation.

Required proof:

- webhook verification/authenticity;
- inbound text normalization;
- supported interactive response normalization;
- media retrieval → AttachmentStore staging;
- delivery/read receipts separated from user business input;
- provider retry safety;
- outbound failure does not replay a committed business mutation;
- same canonical Workflow scenario as WebChat/Telegram.

### C5 — Cross-channel Golden certification

Freeze one scenario and execute equivalent canonical input through all three channels.

Candidate scenario after G2:

```text
RegisterNewAppointment
→ Customer Recognition/resolution
→ Services read/recommendation
→ Offering selection
→ Scheduler availability
→ Slot selection
→ explicit finalize
→ Appointment persisted
```

Compare evidence, not screenshots:

```text
Temporal Workflow phases/results
PostgreSQL business truth
Mongo semantic audit
AttachmentStore refs if used
transport correlation ledger
```

Required verdict:

```text
same canonical input semantics
→ equivalent business outcome
→ no channel-specific business branching
```

## Channel order

```text
C0 canonical contract
→ C1 WebChat
→ C2 Telegram polling
→ C3 Telegram webhook
→ C4 WhatsApp
→ C5 cross-channel certification
```

WebChat is first because it gives a controlled debugging surface. Telegram is second because it gives a low-friction real external channel. WhatsApp follows after the adapter contract has already been proven against two transports.

## Persistence decisions still to freeze

The most likely durable correlation model is PostgreSQL-backed because these values need uniqueness and restart-safe idempotency:

```text
ChannelConversationBinding
ChannelInboundEvent
```

Mongo can retain raw/semantic evidence but should not be the only authority for active Workflow binding.

These tables/contracts must be designed before C1 execution; they are not added inside G1 Services.

## Golden cases to define before build

Future case families:

```text
CHN-IDM-*  inbound duplicate/idempotency
CHN-COR-*  conversation correlation/recovery
CHN-TXT-*  text normalization
CHN-CHO-*  canonical choices/buttons
CHN-ATT-*  media/AttachmentStore
CHN-OUT-*  outbound delivery failure/retry
CHN-SEC-*  provider authenticity / routing trust
CHN-EQV-*  cross-channel semantic equivalence
```

## Stop conditions

Stop and redesign if:

- Telegram/WhatsApp/WebChat require different business Workflow implementations;
- adapter code directly writes Customer/Services/Scheduler/Appointment business rows;
- provider delivery status is treated as user intent;
- external media URL is persisted as durable document truth;
- in-memory conversation maps are the only correlation authority;
- a duplicate provider event can cause a second Temporal Update/business effect;
- WebChat becomes a second workflow state machine.

## Relationship to current build

```text
G1 Services Engine     active
G2 Scheduler Engine    after G1
G3 CTA multi-channel   runtime execution after required engine semantics exist
```

The channel contract/design may evolve in parallel. Runtime certification remains isolated into its own future branches.
