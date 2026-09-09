# Engines Integrations Registry

Date: 2026-09-07

This directory is the canonical integration registry in `main`.

## Rule: one repository per integration

External/provider-specific integrations should ultimately live in separate repositories. `Engines` remains the provider-neutral core and shared contract owner.

Target extraction names:

```text
Engines-Integration-WebChat
Engines-Integration-Telegram
Engines-Integration-WhatsApp-Kapso
Engines-Integration-WhatsApp-Meta
Engines-Integration-<future-provider>
```

The current GitHub installation exposes only `em3rc0dTh/Engines`, so these folders are extraction-ready indexes rather than claims that the separate repositories already exist.

## Registry

| Integration | MK | Current status | Current executable source |
|---|---|---|---|
| [`cli`](cli/README.md) | MK0/MK1 inherited | certified laboratory surface | `main` / MK0 frozen runtime |
| [`http-api`](http-api/README.md) | MK0/MK1 inherited | certified Postman-compatible CTA surface | `main` / MK0 frozen runtime |
| [`webchat`](webchat/README.md) | MK1 | C1A+C1B certified + human/restart verified | consolidated MK1 anchor; historical C1A/C1B branches |
| [`telegram`](telegram/README.md) | MK1 | official Bot API physically verified / sealed | consolidated MK1 anchor + historical provider branch |
| [`whatsapp-kapso`](whatsapp-kapso/README.md) | MK1 | Kapso Sandbox physically verified | consolidated MK1 anchor + historical provider branch |
| [`whatsapp-meta-cloud-api`](whatsapp-meta-cloud-api/README.md) | MK1 | deterministic pass; direct physical gate pending | dedicated Meta provider branch |

## Provider-neutral boundary

```text
integration/provider
      ↓
auth + transport + normalization + rendering
      ↓
canonical CTA operation/envelope
      ↓
Engines core
      ↓
Temporal / Customer / Services / Scheduler / persistence
```

No integration may own domain policy.

## Documentation standard

Every integration index and eventual integration repository must cover:

```text
Brainstorming
Mining Site / Quarries
Architecture
Design
Plan
Golden expectations
Build
Test / Evidence
Certification
Bootstrap / Operations
Secrets/config contract
Known non-claims
Extraction lineage
```

Use [`_template/README.md`](_template/README.md) as the canonical skeleton.

## Current integration sequence

```text
WebChat durable channel                     ✅ closed
Telegram official Bot API                  ✅ physically sealed
WhatsApp Kapso Sandbox                     ✅ physically verified
WhatsApp direct Meta Cloud API             🧪 deterministic only / physical pending
Future provider repositories               ⚪ extraction/admin step
```

## Evidence rule

A registry README may summarize evidence but must never upgrade a claim beyond the exact receipt:

```text
local mock/provider-shaped test != real provider
CI green != human verified
human verified != production ready
provider physical proof != core business policy proof
```
