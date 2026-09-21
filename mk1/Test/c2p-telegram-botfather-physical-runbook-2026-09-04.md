# C2P Telegram BotFather + official Bot API — physical runbook

Date: 2026-09-04
Branch: `build/mk1-c2-telegram-bot-api-official`
Status: **READY FOR EDUARDO TEST**

## Provider setup

In Telegram, open the official `@BotFather` account and send:

```text
/newbot
```

Choose:

1. a display name;
2. a unique username ending in `bot`.

BotFather returns the bot authentication token.

**Secret rule:** do not paste the token into ChatGPT, GitHub, screenshots, documentation or shell history.

## Local repository

From WSL:

```bash
cd /mnt/c/Users/eduar/Desktop/VTKALL/Engines

git fetch origin --prune

git switch --track origin/build/mk1-c2-telegram-bot-api-official
```

If the local branch already exists:

```bash
git switch build/mk1-c2-telegram-bot-api-official
git pull
```

Verify:

```bash
git branch --show-current
git rev-parse HEAD
```

The branch name must be:

```text
build/mk1-c2-telegram-bot-api-official
```

Documentation commits may move HEAD beyond the certified deterministic runtime source. Runtime deterministic authority remains `a0a9b241aab5ffb4fc029179052cd4a80d764620`.

## Start Engines

```bash
cd mk1/runtime

docker compose down -v --remove-orphans

docker compose up --build -d postgres mongo temporal migrate worker

docker compose build telegram-bot

docker compose ps
```

Wait until PostgreSQL/Mongo/Temporal are healthy and the Worker is running/healthy.

## Load the token without shell history

```bash
read -s -p "Telegram bot token: " TELEGRAM_BOT_TOKEN
echo
export TELEGRAM_BOT_TOKEN
```

Optional explicit business scope:

```bash
export ENGINES_TELEGRAM_BUSINESS_SLUG=golden-business
```

Do not run `echo $TELEGRAM_BOT_TOKEN`.

## Start the official long-poll runner

```bash
docker compose --profile telegram run --rm --no-deps telegram-bot
```

Expected startup marker:

```text
TELEGRAM_BOT_API_READY {"botId":...,"username":"...","businessSlug":"golden-business","mode":"getUpdates","agent":false,"mcp":false}
```

The token must not appear in the output.

If the runner reports `TELEGRAM_WEBHOOK_ACTIVE`, stop and report it. Do not delete a webhook automatically.

## Real Telegram conversation

From the same Telegram user that owns/uses the test account:

```text
1. Open the newly-created bot's private chat.
2. Send /start.
3. Confirm that only the consent prompt appears before registration starts.
4. Press Registrarme.
5. Enter a name.
6. When phone is requested, first type `abc` intentionally.
7. Confirm the bot rejects the value and asks again while the same Workflow remains alive.
8. Press the native Compartir teléfono button.
9. Enter a valid test email.
10. Confirm the bot returns the registration-completed message.
```

Do not use a group for this gate. Native contact sharing for the current design is a private-chat proof.

## Evidence to return

Return to Jett:

- terminal output from `TELEGRAM_BOT_API_READY` through the end of the registration;
- the visible Telegram conversation result or screenshots if useful;
- redact/remove any token before sharing;
- personal phone/email will not be copied into the public repository receipt.

## Pass condition

```text
real Telegram Bot API update
→ TelegramAdapter
→ canonical channel core
→ PostgreSQL durable event/binding
→ real Temporal RegisterNewCustomer
→ invalid value rejected without second Workflow
→ native Telegram contact accepted
→ Customer CREATED
→ completion delivered through Telegram Bot API
```

Only after this human proof may the project claim:

```text
C2P TELEGRAM OFFICIAL BOT API ✅ PHYSICALLY VERIFIED
```
