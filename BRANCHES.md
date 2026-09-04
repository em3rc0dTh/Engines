# Engines — Branch Lineage & Housekeeping

## Status

**HOUSEKEEPING APPLIED BY USER — CURRENT NARRATIVE SET**

Snapshot date: 2026-09-04.

No branch is deleted by this document. The user performs deletions only after an explicit recommendation.

## Branch rule

Every new bounded architecture step/gate gets its own branch.

```text
release/<milestone>
design/<mk>-<architecture-scope>
build/<mk>-<gate>-<bounded-scope>
audit/<bounded-scope>
```

Historical proof lives in commits, CI runs, artifacts and evidence receipts. Permanent `copy`, `scratch` or generic feature branches are not part of the intended narrative.

## Current narrative map

```text
main
│
├── developer
│
├── MK0
│   ├── build/mk0-b3-cli-cta-adapter
│   ├── build/mk0-http-postman-proof
│   └── release/mk0-complete
│
└── MK1
    ├── build/mk1-s5-services-snapshots
    ├── build/mk1-s6-services-multibusiness
    ├── build/mk1-s7-appointment-services-integration
    │
    ├── build/mk1-c0-c1-webchat
    ├── build/mk1-c1b-durable-channel
    │
    ├── design/mk1-services-scheduler-integration
    │
    ├── design/mk1-telegram-whatsapp-official-channels
    │       engine-first + official-provider channel design
    │
    └── messaging Customer-registration stack
         build/mk1-customer-registration-policy-v2
              ↓
         build/mk1-customer-registration-channel-core
              ↓
         build/mk1-c2-telegram-register-customer
              ↓
         build/mk1-c4-whatsapp-register-customer
              ↓
         build/mk1-c2-c4-local-interactive-e2e
              ↓
         build/mk1-b2-customer-soft-duplicate-resolution
              ↓
         build/mk1-c2-telegram-bot-api-official
              CURRENT — DETERMINISTIC PASS / PHYSICAL TELEGRAM TEST NOW
```

## Canonical / meaningful branches

| Meaning | Branch | Policy |
|---|---|---|
| Stable integrated base | `main` | KEEP |
| Integration/staging line | `developer` | KEEP; never use as feature branch |
| Frozen complete MK0 | `release/mk0-complete` | KEEP |
| Historical CLI CTA surface | `build/mk0-b3-cli-cta-adapter` | KEEP |
| Historical HTTP/Postman CTA surface | `build/mk0-http-postman-proof` | KEEP |
| Services S0–S5 terminal milestone | `build/mk1-s5-services-snapshots` | KEEP |
| Services S6 multi-business gate | `build/mk1-s6-services-multibusiness` | KEEP UNTIL S8 HOUSEKEEPING |
| Services S7 Appointment integration | `build/mk1-s7-appointment-services-integration` | KEEP / CERTIFIED MILESTONE |
| WebChat C1A | `build/mk1-c0-c1-webchat` | KEEP |
| Durable WebChat/channel C1B | `build/mk1-c1b-durable-channel` | KEEP |
| Steps 3–4–5 architecture | `design/mk1-services-scheduler-integration` | KEEP |
| Telegram/WhatsApp engine-first design | `design/mk1-telegram-whatsapp-official-channels` | KEEP WHILE CHANNEL BUILD ACTIVE |
| Customer policy V2 | `build/mk1-customer-registration-policy-v2` | STACKED PR #14; keep until stack consolidation |
| Durable Customer channel core | `build/mk1-customer-registration-channel-core` | STACKED PR #15; keep until stack consolidation |
| Telegram RegisterNewCustomer transport | `build/mk1-c2-telegram-register-customer` | STACKED PR #16; keep until stack consolidation |
| WhatsApp RegisterNewCustomer transport | `build/mk1-c4-whatsapp-register-customer` | STACKED PR #17; keep until stack consolidation |
| Local real-Temporal Telegram/WhatsApp E2E | `build/mk1-c2-c4-local-interactive-e2e` | STACKED PR #18; automated + human verified milestone |
| Customer soft-duplicate resolution | `build/mk1-b2-customer-soft-duplicate-resolution` | STACKED DRAFT PR #19 / CERTIFIED |
| Official Telegram Bot API physical gate | `build/mk1-c2-telegram-bot-api-official` | ACTIVE / DRAFT PR #20 / deterministic PASS / physical pending |

## Current messaging stack

```text
PR #14 Customer Registration Policy V2
        ↓
PR #15 Customer Registration Channel Core
        ↓
PR #16 Telegram transport
        ↓
PR #17 WhatsApp transport
        ↓
PR #18 Local interactive real-Temporal E2E
        ↓
PR #19 B2 Customer soft-duplicate resolution
        ↓
PR #20 Telegram official Bot API physical transport
```

Do not merge or delete an intermediate branch casually while the PRs are stacked. Consolidation/housekeeping happens only after the stack's intended merge strategy is explicitly chosen.

## Current channel proof state

```text
adapter harness human test                    ✅ 10 / 10 PASS
local real-Temporal E2E automated              ✅ PASS
local real-Temporal E2E human                  ✅ HUMAN VERIFIED
B2 Customer soft-duplicate resolution          ✅ CERTIFIED
C2P official Telegram runner                   ✅ BUILT / DETERMINISTIC PASS
C2P real Telegram Bot API                      🧪 PHYSICAL TEST NOW
real Meta Cloud API / Kapso                    ⚪ NOT CERTIFIED
```

C2P deterministic authority:

```text
Source     a0a9b241aab5ffb4fc029179052cd4a80d764620
Run        33906116526
Job        101131331563
Artifact   9949550064
SHA256     6e8606c4ab6082691e8f5699b2d98635d2ad6b94f6dfddf52ba09158a1a1c9f2
```

## Telegram provider rule

C2P uses Telegram's official HTTP Bot API with `getUpdates` long polling. The provider is transport only.

```text
Telegram Bot API
  ↓
TelegramBotApiClient / long-poll runner
  ↓
TelegramAdapter
  ↓
canonical channel core
  ↓
Temporal / Customer Engine
```

Only the BotFather token is required for Telegram provider authentication. No MTProto `api_id` / `api_hash`, public webhook, domain or paid hosting is required for this local physical gate.

## WhatsApp provider rule

Only an official WhatsApp Business Platform route is acceptable.

```text
WhatsAppTransportPort
  ├── Meta Cloud API
  └── Kapso (optional provider implementation)
```

Kapso/Meta remain transport implementations and may not replace Temporal, Customer/Services/Scheduler ownership or persistence authority.

Explicitly rejected:

```text
WhatsApp Web automation
QR-session scraping
browser emulation
reverse-engineered private clients
```

## Current construction sequence

```text
C2/C4 local human interactive E2E       ✅ CLOSED
B2 Customer duplicate resolution        ✅ CERTIFIED
C2P Telegram official transport         ✅ DETERMINISTIC PASS
C2P real Telegram Bot API               ← PHYSICAL TEST NOW
real WhatsApp provider                   ← later
Services S8                              ← pending
Scheduler runtime                        ← later
Agent / MCP                              ← last
```

## Cleanup rule

When a bounded gate closes:

1. commit and index its evidence;
2. keep terminal branches that represent meaningful architecture/version/surface milestones;
3. verify ancestry, PR state and evidence before marking intermediates as deletion candidates;
4. never delete branches automatically;
5. tell the user exactly which refs may be removed before any deletion.
