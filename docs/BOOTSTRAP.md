# Engines — Bootstrap / Local Bring-Up

Date: 2026-09-07

This runbook is the central operator index for raising the stable core and the current MK1 integration surfaces from a clean clone.

## Prerequisites

```text
Git
Docker Desktop / Docker Engine + Compose
Node.js >= 20
npm
WSL2 recommended on Windows
cloudflared only for external webhook physical tests
```

Never commit provider tokens, API keys, webhook signing secrets or app secrets.

## 1. Stable MK0 laboratory — main

```bash
git clone https://github.com/em3rc0dTh/Engines.git
cd Engines/mk0/runtime
npm ci
npm run check
docker compose up --build -d
docker compose ps
curl -fsS http://127.0.0.1:8787/health
```

Expected CTA health is a successful JSON response. Temporal UI is available at:

```text
http://localhost:8233
```

Clean reset:

```bash
docker compose down -v --remove-orphans
docker compose up --build -d
```

## 2. MK1 consolidated Customer/channel laboratory

Use the consolidated anchor rather than reconstructing old stacked branches:

```bash
cd Engines
git fetch origin --prune
git switch build/mk1-customer-channels-integrated
git pull
cd mk1/runtime
npm ci
npm run check
```

Start provider-neutral infrastructure and channel core:

```bash
docker compose down -v --remove-orphans
docker compose up --build -d postgres mongo temporal migrate worker cta channel-core
docker compose ps
curl -fsS http://127.0.0.1:8787/health
curl -fsS http://127.0.0.1:8788/health
```

Current base topology:

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

## 3. Local Telegram/WhatsApp provider-shaped messaging lab

No external credentials are required:

```bash
docker compose --profile manual run --rm --no-deps messaging-lab
```

This exercises real PostgreSQL + Temporal + `RegisterNewCustomer` through provider-shaped Telegram/WhatsApp adapters without contacting Telegram or WhatsApp.

## 4. Telegram — official Bot API

Source branch / historical certification line:

```text
build/mk1-c2-telegram-bot-api-official
```

The implementation is also consolidated into `build/mk1-customer-channels-integrated`.

Environment:

```bash
read -s -p "Telegram bot token: " TELEGRAM_BOT_TOKEN; echo
export TELEGRAM_BOT_TOKEN
export ENGINES_TELEGRAM_BUSINESS_SLUG=golden-business
```

Start core dependencies if not already running:

```bash
docker compose up --build -d postgres mongo temporal migrate worker
```

Run bot transport:

```bash
docker compose --profile telegram run --rm --no-deps telegram-bot
```

The runner uses the official Telegram Bot API long-polling path. A configured webhook causes fail-closed startup rather than silent deletion.

Never print or commit `TELEGRAM_BOT_TOKEN`.

## 5. WhatsApp — Kapso Sandbox

The physically verified implementation is now consolidated into:

```text
build/mk1-customer-channels-integrated
```

Historical provider branch:

```text
build/mk1-c4p-kapso-official
```

Required environment:

```bash
read -s -p "Kapso API key: " KAPSO_API_KEY; echo
export KAPSO_API_KEY

read -s -p "Kapso webhook signing secret: " KAPSO_WEBHOOK_SECRET; echo
export KAPSO_WEBHOOK_SECRET

read -p "Kapso Phone Number ID: " KAPSO_PHONE_NUMBER_ID
export KAPSO_PHONE_NUMBER_ID

export KAPSO_GRAPH_API_VERSION=v24.0
export ENGINES_WHATSAPP_BUSINESS_SLUG=golden-business
```

Start:

```bash
docker compose down -v --remove-orphans
docker compose up --build -d postgres mongo temporal migrate worker
docker compose --profile kapso up --build -d whatsapp-kapso
curl -fsS http://localhost:8791/health
```

Expected health:

```json
{"ok":true,"provider":"KAPSO","agent":false,"mcp":false}
```

For a physical inbound webhook test, expose the local runner:

```bash
cloudflared tunnel --url http://localhost:8791
```

Configure the Kapso number/sandbox webhook with:

```text
Webhook type    Kapso (events)
Endpoint        https://<quick-tunnel>.trycloudflare.com/webhooks/kapso
Payload         v2
Signing secret  exact value of KAPSO_WEBHOOK_SECRET
Event           Message received
```

The Quick Tunnel is test infrastructure only. Keep the `cloudflared` process alive during the physical test.

## 6. WhatsApp — direct Meta Cloud API

This implementation is intentionally isolated on:

```text
build/mk1-c4p-whatsapp-cloud-api-official
```

It has deterministic CI evidence but the direct Meta physical gate remains pending.

Switch explicitly:

```bash
cd Engines
git fetch origin --prune
git switch build/mk1-c4p-whatsapp-cloud-api-official
git pull
cd mk1/runtime
npm ci
npm run check
```

Required environment:

```text
WHATSAPP_APP_SECRET
WHATSAPP_ACCESS_TOKEN
WHATSAPP_PHONE_NUMBER_ID
WHATSAPP_WEBHOOK_VERIFY_TOKEN
WHATSAPP_GRAPH_API_VERSION
ENGINES_WHATSAPP_BUSINESS_SLUG
```

Start:

```bash
docker compose down -v --remove-orphans
docker compose up --build -d postgres mongo temporal migrate worker
docker compose --profile whatsapp up --build -d whatsapp-cloud-api
curl -fsS http://localhost:8790/health
```

Expose for Meta webhook verification/delivery:

```bash
cloudflared tunnel --url http://localhost:8790
```

The callback path is defined by the Meta runner branch/runbook. Do not mark direct Meta physical certification until a real WhatsApp conversation crosses that path and a receipt is recorded.

## 7. WebChat

WebChat is provider-neutral and lives on the MK1 channel runtime. For the latest consolidated customer/channel base:

```bash
cd Engines
git switch build/mk1-customer-channels-integrated
cd mk1/runtime
npm ci
docker compose up --build -d
curl -fsS http://127.0.0.1:8788/health
```

Historical certification branches:

```text
build/mk1-c0-c1-webchat
build/mk1-c1b-durable-channel
```

Do not run an old branch merely to obtain the latest Engine state; use it only when reproducing historical source-bound evidence.

## 8. Services S7 / S8 preparation

Latest certified Services milestone:

```text
build/mk1-s7-appointment-services-integration
```

To inspect/reproduce S7:

```bash
cd Engines
git fetch origin --prune
git switch build/mk1-s7-appointment-services-integration
git pull
cd mk1/runtime
npm ci
npm run check
docker compose down -v --remove-orphans
docker compose up --build -d
```

S8 is the next bounded Services gate. Do not pull Scheduler runtime or Agent/MCP into S8.

## 9. Logs and diagnostics

Common commands:

```bash
docker compose ps
docker compose logs --tail=100 worker
docker compose logs --tail=100 temporal
docker compose logs --tail=100 channel-core
docker compose logs --tail=100 telegram-bot
docker compose logs --tail=100 whatsapp-kapso
docker compose logs --tail=100 whatsapp-cloud-api
```

Only request logs for services that exist on the currently checked-out branch.

## 10. Shutdown

Non-destructive stop:

```bash
docker compose stop
```

Destructive clean laboratory reset:

```bash
docker compose down -v --remove-orphans
```

Do not use the destructive reset against any environment containing business data that must be preserved.

## 11. Truth boundary

A successful local boot means only that the local runtime is healthy. It does not certify:

```text
external provider delivery
production hosting
secret lifecycle
rate-limit behavior
outbound campaign/template policy
Scheduler runtime
Agent / MCP / LLM routing
production readiness
```
