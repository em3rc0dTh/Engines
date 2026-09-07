# MK1 — Stage 2 Registry

Status on `main`: **documentation/index only — executable MK1 remains on bounded branches until promotion**.

This folder exists in `main` so the repository shows the full generation lineage (`mk0`, `mk1`, future `mk2`, ...`) without pretending that incomplete MK1 runtime has been promoted into the stable branch.

## Current MK1 truth

```text
G0 Foundation                                ✅ CLOSED

CUSTOMER / CTA
WebChat C1A                                  ✅ CERTIFIED + HUMAN VERIFIED
WebChat C1B durable restart/replay           ✅ CERTIFIED + HUMAN VERIFIED
Customer Registration Policy V2              ✅ PROVEN
Durable ChannelExecutionCore                 ✅ PROVEN
B2 soft-duplicate resolution                 ✅ CERTIFIED
Telegram official Bot API                    ✅ PHYSICALLY VERIFIED / SEALED
WhatsApp Kapso Sandbox                       ✅ PHYSICALLY VERIFIED
WhatsApp direct Meta Cloud API               ✅ DETERMINISTIC PASS / PHYSICAL PENDING

SERVICES
S0–S7                                        ✅ CERTIFIED
S8                                           ⏭ PENDING

SCHEDULER
Architecture                                 ✅ DESIGNED
Runtime                                      ⚪ NOT CERTIFIED

AGENT / MCP / LLM ROUTING                    ❌ INTENTIONALLY ABSENT / LAST
```

## Current executable anchors

```text
Customer/channels consolidated
build/mk1-customer-channels-integrated

Services latest certified
build/mk1-s7-appointment-services-integration

Scheduler architecture
design/mk1-services-scheduler-integration

Direct Meta provider
build/mk1-c4p-whatsapp-cloud-api-official
```

The consolidated Customer/channel anchor includes the physically verified Telegram Bot API and Kapso Sandbox provider paths.

## MK1 documentation progression

```text
Brainstorming
→ Mining Site / Quarries
→ Architecture
→ Design
→ Plan
→ Golden expectations
→ Build
→ Test / Evidence
→ Certification
```

`main/mk1/` contains the navigation layer. Detailed active artifacts remain on their source branches until the MK1 promotion gate.

## Phase indexes

- [`Brainstorming/README.md`](Brainstorming/README.md)
- [`Architecture/README.md`](Architecture/README.md)
- [`Design/README.md`](Design/README.md)
- [`Plan/README.md`](Plan/README.md)
- [`Build/README.md`](Build/README.md)
- [`Test/README.md`](Test/README.md)
- [`mining-site/README.md`](mining-site/README.md)
- [`mining-site/quarries/README.md`](mining-site/quarries/README.md)
- [`golden-dataset/README.md`](golden-dataset/README.md)

## Integration indexes

Provider/channel-specific navigation is centralized under [`../integrations/`](../integrations/README.md). This supports the target **one repository per integration** policy without duplicating provider code into every MK documentation tree.

## Bring-up

Use [`../docs/BOOTSTRAP.md`](../docs/BOOTSTRAP.md). Do not infer MK1 executable availability from the docs-only folder on `main`; always switch to the explicit source branch named by the runbook.

## Promotion rule

MK1 may be promoted to `main` only through an explicit bounded promotion PR after the intended generation gate is defined. Promotion must not erase MK0, rewrite MK0 receipts or use branch movement as a substitute for certification.
