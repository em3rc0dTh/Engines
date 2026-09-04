# Engines — Branch Lineage & Housekeeping

## Status

**HOUSEKEEPING APPLIED BY USER — CURRENT NARRATIVE SET**

Snapshot date: 2026-09-04.

No branch is deleted by this document. The user performs deletions after an explicit recommendation.

## Branch rule

Every new bounded architecture step/gate gets its own branch. Branch names must identify both the generation/part and the bounded work.

```text
release/<milestone>
design/<mk>-<architecture-scope>
build/<mk>-<gate>-<bounded-scope>
audit/<bounded-scope>
```

Do not retain permanent `copy`, `scratch`, or generic `feat` branches once the same history is represented by a canonical milestone. Historical proof lives in commits, CI runs, artifacts and evidence receipts; a branch does not need to exist forever only to preserve history.

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
    │      S0–S5 Services terminal certified milestone
    │
    ├── build/mk1-c0-c1-webchat
    │      C0A workflow projection + C1A visible WebChat
    │
    ├── build/mk1-c1b-durable-channel
    │      durable channel binding/event semantics
    │
    ├── design/mk1-services-scheduler-integration
    │      Steps 3–4–5 architecture design
    │
    ├── build/mk1-s6-services-multibusiness
    │      Services S6 certified
    │
    ├── build/mk1-s7-appointment-services-integration
    │      Services S7 certified; Appointment consumes canonical Services
    │
    └── design/mk1-telegram-whatsapp-official-channels
           CURRENT — official Telegram + WhatsApp channel architecture
```

## Canonical branches

| Meaning | Branch | Policy |
|---|---|---|
| Stable integrated base | `main` | KEEP |
| Integration/staging line | `developer` | KEEP; never use as a feature branch |
| Frozen complete MK0 | `release/mk0-complete` | KEEP |
| Historical CLI surface | `build/mk0-b3-cli-cta-adapter` | KEEP |
| Historical HTTP/Postman surface | `build/mk0-http-postman-proof` | KEEP |
| Services S0–S5 terminal milestone | `build/mk1-s5-services-snapshots` | KEEP |
| WebChat C1A milestone | `build/mk1-c0-c1-webchat` | KEEP |
| Durable channel C1B milestone | `build/mk1-c1b-durable-channel` | KEEP |
| Steps 3–4–5 architecture design | `design/mk1-services-scheduler-integration` | KEEP |
| Services S6 multi-business gate | `build/mk1-s6-services-multibusiness` | KEEP UNTIL S8 HOUSEKEEPING |
| Services S7 Appointment integration gate | `build/mk1-s7-appointment-services-integration` | KEEP / CERTIFIED MILESTONE |
| Telegram + WhatsApp official channel design | `design/mk1-telegram-whatsapp-official-channels` | ACTIVE |

## Postman naming resolution

The clean historical Postman milestone is:

```text
build/mk0-http-postman-proof
5e36064936a4621191412d8676b957bc0998ad5e
```

The former `cert/mk0-core-golden-release` name is no longer required for the canonical narrative once the user removes it.

## Current construction sequence

```text
STEP 1 / CTA CHANNELS
CLI                historical milestone
HTTP/Postman       historical milestone
WebChat C1A        certified + human verified
Durable C1B        certified + human restart/recovery verified
Telegram C2        official Bot API design ACTIVE
Telegram C3        optional webhook parity later
WhatsApp C4        official Business Platform design ACTIVE

STEP 3 / SERVICES
S0–S5              certified
S6                  certified — multi-business generality
S7                  certified — Appointment consumes canonical Services
S8                  pending — final clean G1 closure

STEP 4 / SCHEDULER
Design              prepared
Runtime             not certified

STEP 5 / INTEGRATION
Design boundary only; no provider business logic may bypass Temporal/domain ownership.
```

## Current messaging branch decision

```text
design/mk1-telegram-whatsapp-official-channels
```

This branch begins from the documented S7 head so it records the current whole-platform truth while changing only the messaging-channel architecture.

Build branches reserved next:

```text
build/mk1-c2-telegram
build/mk1-c4-whatsapp-cloud-api
```

`C3` remains reserved for optional Telegram webhook parity.

## WhatsApp provider rule

The project only accepts an official WhatsApp Business Platform route.

Default architectural target:

```text
Meta WhatsApp Cloud API
```

Optional provider implementation:

```text
Kapso
```

Kapso, if selected, must remain behind the same WhatsApp provider port and may not become the canonical business Workflow or persistence layer.

Explicitly rejected:

```text
WhatsApp Web automation
QR-session scraping
browser emulation
reverse-engineered private clients
```

## Future branch names already reserved conceptually

```text
build/mk1-c2-telegram
build/mk1-c4-whatsapp-cloud-api
build/mk1-s8-services-final-certification
build/mk1-g2-s0-scheduler-contracts
build/mk1-g2-s1-resource-schedules
...
```

## Cleanup rule for future gates

When a bounded gate closes:

1. commit and index its evidence;
2. keep the terminal branch only when it is a meaningful architecture/version/surface milestone;
3. mark intermediate branches as deletion candidates after ancestry and open-PR checks;
4. never delete branches automatically;
5. tell the user exactly which branch refs may be removed before they remove them.
