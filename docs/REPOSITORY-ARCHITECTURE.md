# Repository Architecture

Date: 2026-09-07

## Objective

Keep `Engines` as the provider-neutral core and documentation/control repository while giving every integration an explicit boundary and a path to its own repository.

## Core rule

```text
ENGINE FIRST

provider/channel
    ↓
adapter / renderer / transport
    ↓
canonical CTA boundary
    ↓
ChannelExecutionCore
    ↓
Temporal + domain services + persistence
```

Provider differences stop at the adapter/renderer/transport layer.

The following stay provider-agnostic:

```text
Customer
Services / Catalog
Scheduler
Appointment
Temporal Workflows
idempotent business effects
PostgreSQL business truth
Mongo audit context
AttachmentStore
```

## Target repository topology

```text
em3rc0dTh/Engines
  core contracts
  MK0/MK1/... lifecycle documentation
  integration registry
  shared architecture
  data-model evolution index

em3rc0dTh/Engines-Integration-WebChat
em3rc0dTh/Engines-Integration-Telegram
em3rc0dTh/Engines-Integration-WhatsApp-Kapso
em3rc0dTh/Engines-Integration-WhatsApp-Meta
em3rc0dTh/Engines-Integration-<future-provider>
```

The current GitHub connection exposes only `em3rc0dTh/Engines`; therefore `main/integrations/` acts as the extraction-ready registry until the separate repositories are created through repository administration.

## What belongs in an integration repository

Allowed provider-owned responsibilities:

```text
provider credentials/configuration contract
webhook verification / auth
polling or webhook session mechanics
provider event / sender / conversation identity
payload normalization
canonical action/input mapping
outbound rendering
provider API transport
retry / ack / polling mechanics
provider-specific deterministic fixtures
provider physical runbooks and evidence
```

Forbidden provider-owned responsibilities:

```text
Customer state machine
Customer duplicate truth
Services eligibility or recommendation policy
Scheduler capacity truth
Appointment persistence authority
provider-specific domain tables
provider-specific business workflows
provider SDK types in canonical domain contracts
provider workflow engine replacing Temporal
```

## Main integration registry

`main/integrations/<slug>/README.md` is the central index for each surface/provider. It must record:

```text
purpose
repository target
current source branch
MK generation
status
canonical IDs/contracts
architecture boundary
Brainstorming summary
Mining/Quarry sources
Design/Architecture decisions
Plan/gates
Build authority
Test/human evidence
Golden expectations
boot commands
secrets/config contract
known non-claims
extraction checklist
```

The registry is not a second source tree. It is the navigation layer that lets an operator understand and raise any integration from a clean clone.

## Integration repository standard

Every extracted integration repository follows:

```text
.
├── README.md
├── Brainstorming/
├── Architecture/
├── Design/
├── Plan/
├── Build/
│   └── evidence/
├── Test/
├── mining-site/
│   └── quarries/
├── golden-dataset/
├── runtime/                 # only when the integration owns executable code
└── .github/workflows/
```

The core repository uses the same conceptual progression for `mk0`, `mk1`, `mk2`, etc.

## Version boundaries

### MK0

Frozen certified laboratory. `mk0/runtime` must not be modified by later gates.

### MK1

Stage-2 runtime and channel/services/scheduler evolution. Work stays on bounded branches until the appropriate promotion gate. The integrated customer/channel anchor is:

```text
build/mk1-customer-channels-integrated
```

### MK2+

Future generations must not silently rewrite MK0/MK1 evidence. Each generation gets its own top-level version folder and lifecycle chain.

## Current provider boundaries

### Telegram

```text
Telegram Bot API official
→ polling / provider client
→ TelegramAdapter
→ CanonicalChannelEnvelope
→ ChannelExecutionCore
→ Temporal RegisterNewCustomer
```

### WhatsApp / Kapso

```text
real WhatsApp
→ Kapso Sandbox
→ signed Kapso v2 webhook
→ OfficialKapsoTransport
→ WhatsAppAdapter
→ ChannelExecutionCore
→ Temporal RegisterNewCustomer
→ Kapso outbound
```

### WhatsApp / Meta Cloud API

```text
real WhatsApp
→ Meta Cloud API
→ public HTTPS webhook
→ Meta signature verification
→ OfficialMetaCloudApiTransport
→ WhatsAppAdapter
→ ChannelExecutionCore
```

Direct Meta and Kapso are peer implementations below the same `WhatsAppTransportPort`; neither may fork Customer business logic.

## Promotion policy

A provider implementation can be promoted or extracted only when its receipt clearly distinguishes:

```text
DESIGNED
BUILT
DETERMINISTIC PASS
HUMAN VERIFIED
PHYSICALLY VERIFIED
PRODUCTION READY
```

These are not interchangeable labels.

## Extraction checklist

Before splitting one integration into its own repository:

1. Preserve the exact source SHAs and CI artifacts in the registry.
2. Copy only provider-owned code and fixtures; keep canonical domain contracts in Engines.
3. Define an explicit versioned contract with Engines rather than importing internal implementation details.
4. Preserve provider secrets as environment-only configuration.
5. Re-run deterministic tests in the new repo.
6. Re-run one physical provider gate when extraction changes the executable packaging.
7. Update `integrations/<slug>/README.md` with the new repository URL and final branch lineage.
8. Do not delete the original historical branch until ancestry and evidence have been reviewed.
