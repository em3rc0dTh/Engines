# Design 13 — C2P Telegram official Bot API runtime

Date: 2026-09-04
Status: DESIGN FROZEN FOR BUILD

## Invariant

**Engines remains first. Telegram is a transport/CTA.**

```text
Telegram Bot API
  ↓
TelegramBotApiClient
  ↓
Telegram long-poll runner
  ↓
TelegramAdapter
  ↓
CanonicalChannelEnvelope
  ↓
CustomerRegistrationChannelExecutionCore
  ↓
Temporal + PostgreSQL
```

## Transport mode

C2P uses official `getUpdates` long polling.

Reasons:

- official Telegram API;
- no public ingress required;
- no webhook secret/domain required;
- directly testable from WSL/Docker on the developer machine;
- update identity remains the existing canonical `telegram:update:<update_id>`.

If `getWebhookInfo` reports an active webhook, the runner fails closed instead of silently deleting another deployment's webhook.

## Trusted business scope

```text
ENGINES_TELEGRAM_BUSINESS_SLUG
```

is deployment configuration. Telegram payloads may not select or change `businessSlug`.

Default laboratory value remains `golden-business`.

## Inbound contract

Supported physical material:

- private-chat text;
- callback query data;
- shared contact.

Unsupported group-chat registration is rejected at the runner/presentation boundary because the native `request_contact` behavior is private-chat-only and C2P is a direct customer conversation proof.

## First contact

An unbound private-chat `/start` or first message does not create a Workflow. It only renders the existing consent prompt.

Only the affirmative callback creates:

```text
START_CUSTOMER_REGISTRATION
consentAccepted = true
```

Negative consent creates no canonical operation.

## Live Workflow-driven routing

For an already-bound conversation the runner obtains the current `RegisterNewCustomer` state from Temporal and projects the same provider-independent render intent already used by the local lab.

That render intent is trusted route context for the adapter:

```text
ASK_CUSTOMER_NAME
ASK_CUSTOMER_PHONE
ASK_CUSTOMER_EMAIL
RESOLVE_CUSTOMER_DUPLICATE
REGISTRATION_COMPLETE
...
```

The runner does not infer Customer completeness from conversation text.

## Outbound contract

`renderTelegramRegistration(...)` remains the presentation authority. The Bot API client sends its text and `reply_markup` through official `sendMessage`.

Callback queries are acknowledged through official `answerCallbackQuery`.

When phone is requested, the renderer uses:

```text
request_contact = true
```

After phone acceptance, the next email/completion render removes the reply keyboard.

## Long-poll durability boundary

Telegram `update_id` remains the canonical provider event identity.

```text
same update_id + same normalized material
→ durable channel replay

same update_id + different material
→ CHANNEL_EVENT_IDENTITY_CONFLICT
```

The process advances its next `getUpdates` offset only after an update has been processed. If the process crashes after the business effect but before Telegram confirms the higher offset, the update may be delivered again; C1B durable event semantics are responsible for replay safety.

Exact-once **outbound Telegram message presentation** across a crash boundary is not certified by C2P; transport delivery is treated as at-least-once presentation until a future outbound ledger gate exists.

## Secrets

Only:

```text
TELEGRAM_BOT_TOKEN
```

is required for Telegram authentication.

Rules:

- never commit it;
- never paste it into repository docs/issues/PRs;
- never print it in logs;
- expose it to the local process/container through environment only;
- revoke/regenerate it in BotFather if leaked.

## Non-goals

C2P does not add Agent/MCP/LLM routing, Appointment, Scheduler, outbound campaigns, webhooks, production deployment, or Telegram Business mode.
