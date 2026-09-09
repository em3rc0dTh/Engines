# Engines — Branch / Integration Ledger

Snapshot: 2026-09-07

This document is the `main`-branch index for version and integration lineage. It does not delete branches and it does not treat documentation-only movement as runtime certification.

## Stable refs

```text
main                         MK0 certified runtime + cross-version registry
developer                    integration/staging ref; not a feature branch
release/mk0-complete         frozen MK0 release authority
```

## MK1 integrated customer/channel anchor

```text
build/mk1-customer-channels-integrated
```

This anchor contains the consolidated Customer/CTA messaging line through:

```text
Customer Registration Policy V2
Durable ChannelExecutionCore
WebChat durable semantics
Telegram adapter
WhatsApp adapter/transport port
C2/C4 local real-Temporal E2E
B2 Customer soft-duplicate resolution
Telegram official Bot API physical certification
Kapso WhatsApp Sandbox physical certification
```

The Kapso PR was merged into this anchor on 2026-09-07 with merge commit:

```text
b4378d90216829549f739415ffff45aa41bef068
```

## Meaningful MK1 branches

| Scope | Branch | Status / policy |
|---|---|---|
| Services S5 | `build/mk1-s5-services-snapshots` | historical certified milestone |
| Services S6 | `build/mk1-s6-services-multibusiness` | certified milestone; keep through S8 closure |
| Services S7 | `build/mk1-s7-appointment-services-integration` | certified milestone |
| WebChat C1A | `build/mk1-c0-c1-webchat` | certified + human |
| WebChat C1B | `build/mk1-c1b-durable-channel` | certified + restart/human |
| Customer channels integrated | `build/mk1-customer-channels-integrated` | current consolidated messaging anchor |
| Telegram official Bot API | `build/mk1-c2-telegram-bot-api-official` | physically sealed history; extraction candidate |
| WhatsApp Kapso | `build/mk1-c4p-kapso-official` | physically verified history; merged into integrated anchor; extraction candidate |
| WhatsApp Meta Cloud API | `build/mk1-c4p-whatsapp-cloud-api-official` | deterministic pass; physical gate pending |
| Scheduler architecture | `design/mk1-services-scheduler-integration` | design authority only |
| Messaging architecture | `design/mk1-telegram-whatsapp-official-channels` | design authority only |

## Integration repository policy

Target topology:

```text
Engines
├── provider-neutral core/contracts
├── canonical version docs
└── integrations/ registry

Engines-Integration-WebChat
Engines-Integration-Telegram
Engines-Integration-WhatsApp-Kapso
Engines-Integration-WhatsApp-Meta
Engines-Integration-<future-provider>
```

One external provider integration should not become a permanent source-code subtree owned by the core repository. Until repository extraction occurs, bounded provider branches preserve the executable history; `main/integrations/<provider>` preserves the central registry, contracts, runbooks and evidence pointers.

## Current channel truth

```text
CLI / HTTP-Postman                         ✅ historical MK0 surfaces
WebChat C1A                                ✅ CERTIFIED + HUMAN VERIFIED
WebChat C1B                                ✅ CERTIFIED + HUMAN RESTART VERIFIED
Telegram official Bot API                  ✅ PHYSICALLY VERIFIED / SEALED
WhatsApp local adapter                     ✅ AUTOMATED + HUMAN VERIFIED
WhatsApp Kapso Sandbox                     ✅ PHYSICALLY VERIFIED
WhatsApp Meta Cloud API                    ✅ DETERMINISTIC PASS / PHYSICAL PENDING
```

## Current build sequence

```text
MK0                                         ✅ CLOSED
MK1 messaging/customer integrations          ✅ major provider gates closed except direct Meta physical path
MK1 Services S8                              ⏭ NEXT CORE GATE
Scheduler runtime                            ⏭ after Services G1 closure
Agent / MCP / LLM routing                    ⏭ last
```

## Branch hygiene rules

1. Every bounded architecture/build/certification gate gets its own branch.
2. `main` and `developer` are not scratch or feature branches.
3. A runtime claim stays attached to the exact executed source SHA even when later documentation commits exist.
4. Provider branches may be retained as extraction/certification history after merge.
5. Never delete a branch automatically; verify ancestry, PR state and evidence first.
6. `mk0/runtime` stays frozen.
7. A provider integration may not move Customer, Services, Scheduler, Temporal or persistence business policy into provider code.
