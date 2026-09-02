# Engines — Branch Lineage & Housekeeping

## Status

**HOUSEKEEPING APPLIED BY USER — CURRENT NARRATIVE SET**

Snapshot date: 2026-09-02.

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
    └── build/mk1-s6-services-multibusiness
           current Step-3 build gate
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
| Services S6 multi-business gate | `build/mk1-s6-services-multibusiness` | ACTIVE |

## Postman naming resolution

The historical HTTP/Postman proof originally lived on:

```text
cert/mk0-core-golden-release
5e36064936a4621191412d8676b957bc0998ad5e
```

A clean milestone alias now exists at the exact same commit:

```text
build/mk0-http-postman-proof
5e36064936a4621191412d8676b957bc0998ad5e
```

Therefore `cert/mk0-core-golden-release` is now a **DELETE CANDIDATE** after user review. No Postman implementation or certification history is lost by removing that old branch ref.

## Current construction sequence

```text
STEP 1 / CTA CHANNELS
CLI                historical milestone
HTTP/Postman       historical milestone
WebChat C1A        certified + human verified
Durable C1B        certified + human restart/recovery verified
Telegram C2        later transport proof; same durable core
WhatsApp           later transport proof

STEP 3 / SERVICES
S0–S5              certified
S6                  ACTIVE — multi-business generality
S7                  next — Appointment consumes canonical Services
S8                  final clean G1 closure

STEP 4 / SCHEDULER
G2-S0               after Services closure — contracts + persistence
G2-S1               resources + schedules
G2-S2               availability
G2-S3               atomic conflict/reservation proof
...

STEP 5 / INTEGRATION
Design boundary only for now; no provider business logic is allowed to bypass Temporal/domain ownership.
```

## Future branch names already reserved conceptually

```text
build/mk1-c2-telegram
build/mk1-s7-appointment-services-integration
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
