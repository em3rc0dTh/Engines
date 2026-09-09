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

Until those repositories are split physically, the current certified implementations remain on their bounded historical/build branches. `integrations/` in `main` is the registry that explains status, source branch, evidence, boundaries and how to boot each integration without mixing provider policy into the Engine.

## Version truth

```text
MK0  ✅ CLOSED / frozen certified laboratory
MK1  🔧 ACTIVE / staged on explicit branches
MK2  ⚪ future
```

`main` retains the certified MK0 runtime and the cross-version registry/documentation. Active MK1 runtime work is not faked by moving `main`; it remains on explicit branches until a bounded promotion gate is approved.

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

The physically verified Kapso slice is merged into the consolidated customer-channel integration anchor. The direct Meta Cloud API implementation remains a separate bounded provider branch because its physical delivery gate has not been closed.

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
│   └── whatsapp-meta-cloud-api/
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

Active MK1 branches contain the matching `mk1/` structure with `Brainstorming`, `Design`, `Plan`, `Build`, `Test`, `mining-site/quarries`, `golden-dataset` and `runtime`. The integration registry points to those branches until MK1 is promoted as a complete milestone.

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

For MK1 and provider-specific boot commands, use [`docs/BOOTSTRAP.md`](docs/BOOTSTRAP.md). Secrets are always environment-only and must never be committed.

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
