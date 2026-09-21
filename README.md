# Engines

`Engines` is the provider-neutral operational orchestration core for VertikALL. Business truth and durable workflow state live in the Engine; CLI, HTTP, WebChat, Telegram, WhatsApp and future providers are replaceable ingress/egress surfaces.

## Repository role

This repository is the **core / integration registry / canonical documentation hub**.

The target repository policy is:

```text
Engines                                  core + shared contracts + canonical docs
Engines-Integration-WebChat              one integration repo
Engines-Integration-Telegram             one integration repo
Engines-Integration-WhatsApp-Kapso       one integration repo
Engines-Integration-WhatsApp-Meta        one integration repo
Engines-Integration-<provider>           one repo for each future external integration
```

Until integrations are split physically, their current integrated implementations live in this repository. `main` is the stable recognition point; `developer` is the active integration line. Historical provider branches remain evidence refs only.

## Version truth

```text
MK0  ✅ CLOSED / frozen certified laboratory
MK1  🔧 ACTIVE / integrated CTA baseline on main; future bounded work starts from developer
MK2  ⚪ future
```

`main` retains the frozen MK0 laboratory and the current integrated MK1 CTA/channel baseline. New bounded work is developed on `developer`/feature branches and returns to `main` only through an explicit integration gate.

Canonical lifecycle:

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

Every integration repository must preserve the same discipline. See [`docs/MK-LIFECYCLE.md`](docs/MK-LIFECYCLE.md) and [`integrations/_template/README.md`](integrations/_template/README.md).

## Current architecture

```text
                         ENGINES
              provider-neutral business core

CLI / HTTP / WebChat / Telegram / WhatsApp / future providers
                         ↓
               replaceable CTA boundary
                         ↓
                ChannelExecutionCore
                         ↓
              durable channel/event ledger
                         ↓
                      Temporal
                         ↓
        Customer / Services / Scheduler / persistence
```

Authority boundaries:

- **Temporal** — durable orchestration, Workflow state and Event History.
- **PostgreSQL** — canonical transactional/business truth and durable channel-event identity.
- **MongoDB** — execution/audit context where applicable; not shadow business truth.
- **AttachmentStore** — binary/document integrity and lifecycle.
- **Provider adapter/transport** — authentication, provider identity, payload normalization, rendering, transport retry/ack semantics only.
- **Customer / Services / Scheduler** — provider-agnostic domain rules.

Invariant:

> **Engines comes first. CTA is a replaceable ingress boundary. CLI, API, WebChat, Telegram and WhatsApp are only different ways for a client to connect to the same Engine.**

## Current platform status

```text
FOUNDATION
MK0 orchestration laboratory                     ✅ CERTIFIED / FROZEN

MK1 CUSTOMER + CTA
WebChat C1A                                      ✅ CERTIFIED + HUMAN VERIFIED
WebChat C1B durable restart/replay               ✅ CERTIFIED + HUMAN VERIFIED
Customer Registration Policy V2                  ✅ PROVEN
Durable ChannelExecutionCore                     ✅ PROVEN
Customer soft-duplicate resolution B2            ✅ CERTIFIED
Telegram local real-Temporal E2E                 ✅ AUTOMATED + HUMAN
WhatsApp local real-Temporal E2E                 ✅ AUTOMATED + HUMAN
Telegram official Bot API                        ✅ PHYSICALLY VERIFIED / SEALED
WhatsApp through Kapso Sandbox                   ✅ PHYSICALLY VERIFIED
Meta WhatsApp Cloud API                          ✅ DETERMINISTIC PASS / PHYSICAL PENDING

MK1 SERVICES
S0–S7                                            ✅ CERTIFIED
S8 final G1 closure                              ⏭ PENDING

SCHEDULER
Architecture                                     ✅ DESIGNED
Runtime                                          ⚪ NOT CERTIFIED

AGENT / MCP / LLM ROUTING                        ❌ INTENTIONALLY LAST
```

## CTA / Provider recognition index

Canonical CTA/channel documentation and reproducible setup now starts at [`mk1/CTA/README.md`](mk1/CTA/README.md).

```text
Register Appointment canonical CTA              ✅ CERTIFIED POC
WebChat browser path                            ✅ PHYSICALLY VERIFIED
Telegram official Bot API                       ✅ PHYSICALLY VERIFIED
WhatsApp / Kapso                                ✅ PHYSICALLY VERIFIED
Messenger Page transport                        ✅ REAL INBOUND + OUTBOUND
Messenger real CTA -> Temporal -> persistence    ⚪ OPEN
Facebook Page.feed dashboard transport           ✅ VERIFIED
Facebook comment synthetic edge replay           ✅ VERIFIED
Facebook real provider comment delivery          ⚪ OPEN
TikTok provider transport                        ⚪ DETERMINISTIC ONLY
```

Evidence classes remain separate: deterministic tests, sanitized synthetic replay, provider-dashboard transport and real external-provider delivery are never treated as equivalent.

The Meta Page callback topology is:

```text
Page callback
  /webhooks/meta/messenger
        ├── entry[].messaging[]            -> Messenger
        └── entry[].changes[field=feed]    -> Facebook Comments
```

The Graph API `User` object is not part of the Messenger/Facebook Comments CTA path.

The physically verified Kapso slice and the modern direct Meta Cloud API implementation are integrated into the canonical line. Direct Meta WhatsApp physical delivery remains explicitly open even though its deterministic implementation is now integrated.

## Repository map

```text
.
├── README.md
├── BRANCHES.md
├── docs/
│   ├── REPOSITORY-ARCHITECTURE.md
│   ├── BOOTSTRAP.md
│   └── MK-LIFECYCLE.md
├── data-model/
│   ├── README.md
│   └── V3-V4-EVOLUTION.md
├── integrations/
│   ├── README.md
│   ├── _template/
│   ├── cli/
│   ├── http-api/
│   ├── webchat/
│   ├── telegram/
│   ├── whatsapp-kapso/
│   ├── whatsapp-meta-cloud-api/
│   ├── messenger/
│   ├── facebook-comments/
│   └── tiktok/
└── mk0/
    ├── README.md
    ├── Brainstorming/
    ├── Design/
    ├── Plan/
    ├── Build/
    ├── Test/
    ├── mining-site/quarries/
    ├── golden-dataset/
    └── runtime/
```

`main` now contains the integrated `mk1/` CTA/channel structure. Historical branches remain useful only for exact source-bound evidence; new CTA work starts from `developer`.

## Quick start

For the stable MK0 laboratory:

```bash
git clone https://github.com/em3rc0dTh/Engines.git
cd Engines/mk0/runtime
npm ci
npm run check
docker compose up --build -d
curl -fsS http://127.0.0.1:8787/health
```

For MK1 CTA/channel reproduction, start with [`mk1/CTA/REPRODUCE.md`](mk1/CTA/REPRODUCE.md), then use [`docs/BOOTSTRAP.md`](docs/BOOTSTRAP.md) for runtime bring-up. Secrets are always environment-only and must never be committed.

## Data model direction

The repository tracks the operational data-model evolution separately from runtime certification. The supplied v3 baseline formalizes WorkTeams, schedule rules/overrides, 15-minute micro-slots and `ResourceReservation`; the supplied v4 companion adds the Operational Input Layer, granular provenance, `WorkOrderRequirement`, dimensional validation/outcome state and non-linear corrective cycles while retaining v3 as the cumulative base.

See [`data-model/README.md`](data-model/README.md). The English v4 companion explicitly states that the Spanish v4 document remains canonical; this repository does not silently promote the English companion above that source.

## Evidence discipline

```text
UNKNOWN != PASS
documented != verified
CI green != external-provider physical certification
runtime source SHA != later documentation SHA
provider-specific code != business policy
availability shown != reservation persisted
execution completed != outcome accepted
```

Every bounded claim must point to identified source, CI/human evidence and a clear non-claim boundary.

## What Engines does not currently claim

- production deployment/readiness;
- production webhook hosting or secret lifecycle;
- direct Meta WhatsApp physical certification;
- completed Scheduler runtime;
- warehouse/inventory/procurement semantics from the v4 data-model seam;
- Agent/MCP/LLM routing;
- automatic creation of separate GitHub repositories for integration extraction.

The integration folders in `main` are the canonical organization and extraction map; physical repo splitting is a separate repository-administration step.
