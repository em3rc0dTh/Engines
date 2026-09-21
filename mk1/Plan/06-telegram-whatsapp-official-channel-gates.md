# Plan 06 — Telegram + WhatsApp official channel gates

Date: 2026-09-04
Status: DESIGN / BUILD PLAN

## Goal

Complete the official messaging-channel layer without changing business authority.

## Branch discipline

The design work lives on:

```text
design/mk1-telegram-whatsapp-official-channels
```

Build gates must use separate branches:

```text
build/mk1-c2-telegram
build/mk1-c4-whatsapp-cloud-api
```

If Kapso is selected for the first WhatsApp physical proof, keep the C4 domain contract unchanged and implement it as an alternate transport behind the same WhatsApp provider port rather than creating a parallel business architecture.

C3 remains reserved for optional Telegram webhook parity.

## C2 — Telegram long-polling gate

### C2-A Contract/adapter

Required:

- official Telegram Bot API transport boundary;
- `update_id` durable ingress identity;
- chat conversation identity;
- sender identity;
- text normalization;
- callback-query normalization;
- trusted configured `businessSlug`;
- registration in existing ChannelAdapterRegistry;
- no provider-specific business logic.

### C2-B Long-poll runner

Required:

- `getUpdates` long polling;
- deterministic offset handling;
- bounded retry/backoff;
- graceful shutdown;
- process restart recovery;
- no token committed to source.

### C2-C Renderer

Required:

- text replies;
- inline callback buttons for deterministic selections;
- callback data maps to canonical action + canonical id;
- no semantic/LLM router.

### C2-D Automated certification

Prove:

```text
synthetic update
→ TelegramAdapter
→ CanonicalChannelEnvelope
→ ChannelExecutionCore
→ PostgreSQL channel durability
→ Temporal Appointment
→ CREATED
```

Also prove:

- exact duplicate update is harmless;
- same event identity + different material conflicts;
- Telegram runner restart recovers same durable conversation/Workflow;
- C1B WebChat regression remains green;
- `agent=false` and `mcp=false`.

### C2-E Physical proof — deferred

Later, with a real BotFather token:

- receive real Telegram message;
- continue same Appointment using buttons/text;
- restart bot process;
- recover same Workflow;
- finish to CREATED;
- inspect same Workflow from HTML inspector.

Until this happens, use wording:

```text
C2 automated adapter/core certified
real Telegram transport not yet human-certified
```

## C3 — Telegram webhook parity (optional)

Only after C2 if useful.

Goal:

```text
long polling transport
≡ webhook transport
```

No business differences are permitted.

## C4 — WhatsApp official API gate

### Provider decision

Default build target:

```text
Meta WhatsApp Cloud API
```

Optional provider implementation:

```text
Kapso official-API transport layer
```

The provider decision must not change the canonical WhatsAppAdapter or ChannelExecutionCore contract.

### C4-A Transport/provider port

Required:

```text
WhatsAppTransportPort
├── MetaCloudApiTransport
└── KapsoTransport (optional)
```

Responsibilities:

- inbound authenticity/verification boundary;
- provider request/response handling;
- outbound message API;
- provider errors/status normalization;
- no business writes.

### C4-B WhatsApp adapter

Required:

- inbound text message mapping;
- interactive button reply mapping;
- list reply mapping;
- deterministic conversation identity;
- provider message identity;
- sender identity;
- trusted business scope;
- status events separated from canonical business actions.

### C4-C Renderer

Required:

- text responses;
- supported deterministic interactive choices;
- provider limitations must degrade presentation, not business truth.

### C4-D Automated certification

Using signed/deterministic fixtures or a local provider harness, prove:

- unverified webhook rejected before ChannelExecutionCore;
- valid inbound message maps to canonical event;
- exact duplicate provider message replays durably;
- same provider message identity with changed normalized material conflicts;
- WhatsApp process restart recovers same conversation binding;
- Appointment completes to CREATED;
- no direct domain repository writes from WhatsApp code;
- WebChat regression remains green;
- Telegram regression remains green if C2 already exists;
- Agent/MCP remain absent.

### C4-E Physical proof — deferred until account/number ready

We will not certify the real WhatsApp transport until an actual official account path is exercised.

Possible physical proof paths:

```text
A. Meta direct Cloud API
B. Kapso onboarding/proxy using official WhatsApp API
```

Required human proof later:

- user sends real WhatsApp message;
- webhook reaches Engines;
- same durable conversation continues after adapter restart;
- Appointment reaches CREATED;
- no duplicate business effect under webhook retry;
- provider/message status can be inspected separately from business result.

## WhatsApp safety rule

Do not build or test the product using unofficial WhatsApp Web automation as an interim shortcut.

An unofficial prototype cannot be promoted into the official provider branch.

## Sequence from current position

```text
CURRENT
S0–S7 Services certified
C1B WebChat durable + human restart verified

NOW
1. freeze Telegram + WhatsApp official contracts     ✅ design branch
2. build C2 Telegram adapter/runner                  NEXT
3. automated C2 certification                       NEXT
4. build C4 Meta Cloud API provider seam            AFTER C2 core proof
5. automated C4 certification                       AFTER C4 build
6. physical Telegram / WhatsApp tests               DEFERRED by user
7. return to S8 / Scheduler as prioritized
```

## Manual-test rule

When a real provider test becomes possible, the gate is not finally human-verified until the user has personally exercised it.

The assistant must explicitly mark:

```text
🧪 READY FOR YOUR TEST
```

and provide exact branch, commands, environment variables and provider setup steps without exposing secrets in repository documentation.
