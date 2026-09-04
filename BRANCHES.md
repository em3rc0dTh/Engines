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
    ├── design/mk1-telegram-whatsapp-official-channels
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
              CURRENT — REAL PROVIDER E2E + INVALID-INPUT RECOVERY HUMAN VERIFIED
                        NATIVE request_contact RETEST PENDING
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
| Customer soft-duplicate resolution + local human closure | `build/mk1-b2-customer-soft-duplicate-resolution` | DRAFT PR #19 / CERTIFIED |
| Telegram official Bot API physical transport | `build/mk1-c2-telegram-bot-api-official` | DRAFT PR #20 / REAL PROVIDER E2E + INVALID INPUT HUMAN VERIFIED / NATIVE CONTACT RETEST PENDING |

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

## Current C2P truth

```text
official Bot API client + long-poll runner            ✅ DETERMINISTIC PASS
real BotFather bot / getUpdates / sendMessage         ✅ HUMAN VERIFIED
real Telegram → Temporal → Customer completion        ✅ HUMAN VERIFIED
physical invalid phone recovery                       ✅ HUMAN VERIFIED
physical invalid email recovery                       ✅ HUMAN VERIFIED
native Compartir teléfono / request_contact           🧪 PATCHED / RETEST PENDING
final C2P physical seal                                ⏳ AFTER NATIVE CONTACT RETEST
```

The observed missing contact button is retained as real test evidence, not erased. The C2P renderer now requests a persistent ReplyKeyboardMarkup and preserves typed-phone fallback.

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
C2P native Telegram contact retest       ← now
C2P physical seal                        ← after retest
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
