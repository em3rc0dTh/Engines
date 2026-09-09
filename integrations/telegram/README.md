# Integration Registry — Telegram

## Identity

```text
Integration       Telegram
Provider          official Telegram Bot API
Repository target Engines-Integration-Telegram
Primary MK        MK1
Status            ✅ PHYSICALLY VERIFIED / SEALED
```

## Current source lineage

```text
Historical provider branch      build/mk1-c2-telegram-bot-api-official
Consolidated current anchor      build/mk1-customer-channels-integrated
```

## Canonical provider IDs

```text
externalConversationId = telegram:<chat.id>
externalMessageId      = telegram:update:<update_id>
externalSenderId       = telegram:user:<from.id>
```

`businessSlug` is trusted server configuration, not user/provider-supplied business authority.

## Architecture

```text
real Telegram
→ official Telegram Bot API
→ getUpdates long polling
→ TelegramAdapter
→ CanonicalChannelEnvelope
→ ChannelExecutionCore
→ PostgreSQL durable channel ledger
→ Temporal RegisterNewCustomer
→ Customer
→ sendMessage
```

The current physical gate uses official Bot API long polling. Webhook mode is not part of the sealed claim.

## Brainstorming

The chosen path rejected unofficial Telegram clients and lower-level MTProto complexity. The provider gate needed a free, official, locally runnable transport without public webhook hosting. Bot API long polling satisfied that boundary.

## Mining Site / Quarries

Provider research covered official Bot API methods, `getUpdates`/webhook exclusivity, `update_id`, reply keyboards, `request_contact`, BotFather tokens and Telegram Web client behavior.

Important observed client note: Telegram Web did not visibly render the native `request_contact` keyboard in the physical runs. Typed phone remained the supported fallback and the real provider flow still completed.

## Architecture decisions

```text
Bot API token              environment only
provider chat/user IDs     transport identity only
Telegram user/chat ID      never a phone number
contact.user_id mismatch   reject sender-owned-contact proof
update_id                  canonical inbound event identity
same event + same material replay
same event + changed material conflict
```

## Design

First unbound private text or `/start` is consent flow, not silent Workflow creation. After consent, live Temporal state drives the next render action. Telegram never implements a parallel Customer state machine.

## Plan / gates

```text
official-source review                 ✅
Bot API HTTP client                    ✅
long-poll runner                       ✅
deterministic CI                       ✅
BotFather physical connection          ✅
real registration E2E                  ✅
invalid phone/email recovery           ✅
physical evidence + seal               ✅
Telegram Web native request_contact UI ⚪ client-compatibility note only
```

## Build authority

Physically observed source-bound authority:

```text
Source SHA  28dd5c9f2dd2352d3e11b83cc6602cea1b568760
Run         33927626629
Job         101199465863
Artifact    9957384230
SHA-256     46bbd55f0b2c061ec9b7e61d55323dca0f5488d410120a3ac5b4510b90bdd79c
```

Post-seal client-aware copy hardening also passed deterministic CI:

```text
Source SHA  12cdd31f90261fc1b89d02c7569b02c60e10a499
Run         33928701201
Job         101202679780
Artifact    9957765591
SHA-256     e21c19fd6fa9bf31eaea0dae7885e8a3dc1432462d747ec29a05729b1234d35a
```

## Test / physical evidence

Observed with a real BotFather-created bot and real Telegram account:

```text
/start
→ consent
→ name
→ typed phone
→ email
→ Customer CREATED
→ registration completion
```

Physical invalid phone and invalid email rejection/recovery were also observed. Personal values/tokens remain excluded from public evidence.

Canonical receipt in the consolidated anchor:

```text
mk1/Build/evidence/c2p-telegram-official-bot-api-physical-seal-2026-09-04.md
```

## Golden expectations

Provider-specific deterministic tests cover Bot API contracts plus Telegram adapter/render behavior. Customer validation and duplicate semantics remain shared Engine expectations.

## Bootstrap

From the consolidated anchor:

```bash
git fetch origin --prune
git switch build/mk1-customer-channels-integrated
cd mk1/runtime
npm ci
npm run check

docker compose up --build -d postgres mongo temporal migrate worker

read -s -p "Telegram bot token: " TELEGRAM_BOT_TOKEN; echo
export TELEGRAM_BOT_TOKEN
export ENGINES_TELEGRAM_BUSINESS_SLUG=golden-business

docker compose --profile telegram run --rm --no-deps telegram-bot
```

## Secrets

```text
TELEGRAM_BOT_TOKEN
```

Never commit, echo into logs or place the token in fixtures.

## Non-claims

```text
Telegram webhook mode
production hosting
broadcast/campaign product behavior
Appointment over Telegram
Scheduler runtime
Agent / MCP / LLM routing
universal Telegram client UI parity
production readiness
```

## Extraction checklist

Extract Bot API client, runner, adapter/renderer provider package, fixtures, provider CI and physical runbook into `Engines-Integration-Telegram`. Keep canonical channel/core/domain contracts in Engines and re-run deterministic + one physical provider gate after packaging changes.
