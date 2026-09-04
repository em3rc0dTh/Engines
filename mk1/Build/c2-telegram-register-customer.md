# C2 Telegram → RegisterNewCustomer

## Brainstorming / Quarry

Telegram supplies updates, chat/user identity, callback data, text and shared contacts. It does not supply Customer completeness or Workflow order.

## Design / Plan

`TelegramAdapter` creates canonical identities from `update_id`, `chat.id` and `from.id`. Consent NO yields no operation. Consent YES is the only start. Text mapping requires a render intent previously projected from Temporal `missingFields`; shared contact is a phone patch. The renderer produces provider-shaped presentation only.

## Golden dataset / Evidence

- TG-RNC-001 text: PASS
- TG-RNC-002 callback + consent: PASS
- TG-RNC-003 shared contact: PASS
- exact replay/conflict identity material: inherited and regression-tested in C1B
- typecheck and WebChat C1B regression: PASS
- Agent=false; MCP=false

READY FOR deterministic harness testing. Real Telegram Bot API remains **NOT CERTIFIED**.
