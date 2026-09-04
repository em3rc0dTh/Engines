# Quarry 05 — Telegram official Bot API provider facts

Date: 2026-09-04
Status: SOURCE REVIEW COMPLETE FOR C2P BUILD

## Sources

### Telegram Bot API

Official source: `https://core.telegram.org/bots/api`

Observed provider facts used by this build:

- Bot API is Telegram's HTTP-based interface for bots.
- Requests use `https://api.telegram.org/bot<token>/METHOD_NAME`.
- Bot authentication uses the unique token issued for the bot.
- `getUpdates` and webhooks are mutually exclusive ways to receive updates.
- incoming updates are retained by Telegram for no longer than 24 hours;
- `update_id` is the unique update identity and is useful for ordering/replay handling;
- `request_contact=true` on a keyboard button sends the user's phone number and is available in private chats only;
- `sendMessage` accepts reply markup for inline/reply keyboards.

### BotFather tutorial

Official source: `https://core.telegram.org/bots/tutorial`

Observed facts:

- create a bot by contacting `@BotFather` and issuing `/newbot`;
- BotFather returns the bot token;
- Telegram explicitly instructs developers to treat the token like a password and not share it;
- `getMe` is the simplest authenticated Bot API verification call.

### Telegram bot platform introduction

Official source: `https://core.telegram.org/bots`

Observed facts:

- Telegram states the Bot Platform is free for users and developers;
- bots cannot start conversations with users: the user must contact/add the bot first;
- a bot is created through BotFather and receives a token.

### Telegram APIs overview

Official source: `https://core.telegram.org/`

Observed fact:

- Telegram states its Bot API / developer APIs are available free of charge.

## Engineering consequences

```text
BotFather token only
+ local long-poll runner
+ outbound HTTPS
= no public webhook/domain required for C2P physical proof
```

No Telegram API ID/API hash is required for this **Bot API** path. Those belong to Telegram's lower-level client API/MTProto application path, which Engines is not using here.

## Cost boundary

The physical registration proof stays on Telegram's normal free Bot Platform path. Paid Broadcasts are outside scope. Local execution can therefore be performed without a paid provider or paid hosting service, assuming the developer already has internet access and a machine to run Engines.
