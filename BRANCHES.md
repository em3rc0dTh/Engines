# Engines — Branch Lineage & Housekeeping

## Status

**MESSAGING STACK CONSOLIDATED — TELEGRAM SEALED — KAPSO SANDBOX PHYSICALLY VERIFIED**

Snapshot date: 2026-09-07.

No branch is deleted by this document. Historical proof remains in commits, merged PRs, CI runs, artifacts and evidence receipts.

## Branch rule

Every bounded architecture/build/certification gate gets its own branch.

```text
release/<milestone>
design/<mk>-<architecture-scope>
build/<mk>-<gate>-<bounded-scope>
audit/<bounded-scope>
```

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
    ├── build/mk1-c0-c1-webchat
    ├── build/mk1-c1b-durable-channel
    ├── design/mk1-services-scheduler-integration
    ├── design/mk1-telegram-whatsapp-official-channels
    │
    └── build/mk1-customer-channels-integrated
          ├── Customer Registration Policy V2
          ├── durable Customer channel core
          ├── Telegram adapter
          ├── WhatsApp adapter/transport port
          ├── local Telegram/WhatsApp real-Temporal E2E
          ├── B2 Customer soft-duplicate resolution
          └── C2P Telegram official Bot API physical seal
                ✅ CONSOLIDATED INTEGRATION ANCHOR
                │
                ├── build/mk1-c4p-whatsapp-cloud-api-official
                │     Meta direct transport ✅ deterministic; physical open
                │
                └── build/mk1-c4p-kapso-official
                      Kapso transport ✅ deterministic
                      Kapso Sandbox   ✅ physically verified
```

## Consolidation result

The former stacked PR chain was retargeted in order to `build/mk1-customer-channels-integrated` and merged with merge commits so certified source SHAs remain in history:

```text
PR #14 Customer Registration Policy V2                 ✅ MERGED
PR #15 Durable Customer Registration Channel Core       ✅ MERGED
PR #16 Telegram Customer Registration Transport         ✅ MERGED
PR #17 WhatsApp Customer Registration Transport         ✅ MERGED
PR #18 Local Interactive Customer Registration E2E      ✅ MERGED
PR #19 Customer Soft-Duplicate Resolution               ✅ MERGED
PR #20 Telegram Official Bot API Physical Transport     ✅ MERGED
```

Terminal consolidation merge for PR #20:

```text
94f342d731e2272c025c28b007635eccfe5f7f8a
```

`main`, `developer`, `release/mk0-complete` and `mk0/runtime` were not moved or modified by this consolidation.

## Canonical / meaningful branches

| Meaning | Branch | Policy |
|---|---|---|
| Stable integrated base | `main` | KEEP |
| Integration/staging line | `developer` | KEEP; never use as feature branch |
| Frozen complete MK0 | `release/mk0-complete` | KEEP |
| Historical CLI CTA surface | `build/mk0-b3-cli-cta-adapter` | KEEP |
| Historical HTTP/Postman CTA surface | `build/mk0-http-postman-proof` | KEEP |
| Services S0–S5 milestone | `build/mk1-s5-services-snapshots` | KEEP |
| Services S6 multi-business gate | `build/mk1-s6-services-multibusiness` | KEEP UNTIL S8 HOUSEKEEPING |
| Services S7 Appointment integration | `build/mk1-s7-appointment-services-integration` | KEEP / CERTIFIED MILESTONE |
| WebChat C1A | `build/mk1-c0-c1-webchat` | KEEP |
| Durable WebChat/channel C1B | `build/mk1-c1b-durable-channel` | KEEP |
| Services/Scheduler architecture | `design/mk1-services-scheduler-integration` | KEEP |
| Messaging architecture | `design/mk1-telegram-whatsapp-official-channels` | KEEP AS DESIGN RECORD |
| Customer messaging integrated anchor | `build/mk1-customer-channels-integrated` | KEEP / CURRENT BASE |
| Direct Meta Cloud API provider | `build/mk1-c4p-whatsapp-cloud-api-official` | KEEP / ALTERNATE PROVIDER; PHYSICAL OPEN |
| Kapso official WhatsApp provider | `build/mk1-c4p-kapso-official` | KEEP / PHYSICALLY VERIFIED MILESTONE |

Former stack branches #14–#20 are cleanup candidates only because their PRs are merged into the integrated anchor. They are not deleted automatically.

## Current channel truth

```text
C1A WebChat                                  ✅ CERTIFIED + HUMAN VERIFIED
C1B durable WebChat                          ✅ CERTIFIED + HUMAN RESTART VERIFIED
C2/C4 local real-Temporal messaging E2E      ✅ AUTOMATED + HUMAN VERIFIED
B2 Customer soft-duplicate resolution        ✅ CERTIFIED
C2P Telegram official Bot API                ✅ PHYSICALLY VERIFIED / SEALED
Telegram Web native request_contact UI       ⚪ CLIENT-COMPATIBILITY NOTE ONLY
C4P Meta Cloud API transport                 ✅ DETERMINISTIC PASS / PHYSICAL OPEN
C4P Kapso transport                          ✅ DETERMINISTIC PASS
C4P Kapso Sandbox real WhatsApp E2E          ✅ PHYSICALLY VERIFIED
```

## WhatsApp provider rule

Only official WhatsApp Business Platform routes are acceptable.

```text
WhatsAppTransportPort
  ├── Meta Cloud API      ← direct official transport, deterministic proof complete
  └── Kapso               ← official BSP transport, Sandbox physically verified
```

Provider code may handle webhook verification, provider identity, payload normalization and outbound rendering. It may not own Customer, Services, Scheduler, Temporal business logic or canonical persistence.

Explicitly rejected:

```text
WhatsApp Web automation
QR-session scraping
browser emulation
reverse-engineered private clients
```

## C4P physical evidence boundary

Kapso Sandbox now proves one real WhatsApp provider path end-to-end through the same Engine. The observed physical run included interactive registration consent, Customer name/email capture, verified sender-phone prefill with no redundant phone prompt, and terminal registration completion returned to WhatsApp.

Certification receipt:

`mk1/Build/evidence/c4p-kapso-sandbox-physical-certification-2026-09-07.md`

This does **not** certify a Kapso dedicated production number or the direct Meta Cloud API physical route.

## Current construction sequence

```text
C2P Telegram official Bot API                ✅ CLOSED / SEALED
messaging stack consolidation                ✅ CLOSED
C4P Kapso Sandbox real WhatsApp provider      ✅ CLOSED / PHYSICALLY VERIFIED
C4P direct Meta Cloud API physical proof      ⚪ OPTIONAL ALTERNATE PROVIDER PATH
Services S8                                   ← NEXT PENDING PLATFORM GATE
Scheduler runtime                             ← later
Agent / MCP                                   ← last
```

## Cleanup rule

When a bounded gate closes:

1. commit and index its evidence;
2. keep terminal branches that represent meaningful architecture/version/surface milestones;
3. verify ancestry, PR state and evidence before marking intermediates as deletion candidates;
4. never delete branches automatically;
5. tell the user exactly which refs may be removed before any deletion.
