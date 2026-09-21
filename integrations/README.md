# Engines Integrations Registry

Snapshot: 2026-09-21

This directory is the canonical recognition map for every CTA/provider surface integrated into Engines.

## Rule

Engines owns provider-neutral contracts, orchestration and business truth. Provider integrations own only transport concerns.

```text
integration/provider
      ↓
auth + transport + normalization + rendering
      ↓
canonical CTA operation/envelope
      ↓
Engines core
      ↓
Temporal / domain / persistence
```

## Registry

| Integration | Current status | Reproduction |
|---|---|---|
| [CLI](cli/README.md) | certified local laboratory | README |
| [HTTP / Postman](http-api/README.md) | certified local laboratory | README |
| [WebChat](webchat/README.md) | certified + browser physical proof | README |
| [Telegram](telegram/README.md) | official Bot API physically verified | README |
| [WhatsApp / Kapso](whatsapp-kapso/README.md) | provider physically verified | README |
| [WhatsApp / Meta Cloud API](whatsapp-meta-cloud-api/README.md) | deterministic certified; physical open | README |
| [Messenger](messenger/README.md) | real Page inbound/outbound transport | README |
| [Facebook Comments](facebook-comments/README.md) | Page.feed dashboard + synthetic replay | README |
| [TikTok](tiktok/README.md) | deterministic adapter only | README |

The clean-clone cross-channel reproduction sequence is [../mk1/CTA/REPRODUCE.md](../mk1/CTA/REPRODUCE.md).

## Source policy

After the 2026-09-21 promotion:

```text
main       canonical stable recognition point
developer  active integration line
```

Historical CTA/provider branches remain inspectable for exact evidence provenance but are not development bases.

## Evidence rule

```text
local deterministic test != synthetic replay
synthetic replay != provider dashboard delivery
provider dashboard delivery != real provider delivery
real provider delivery != complete CTA/domain physical proof
physical proof != production readiness
```

## Documentation standard

Every integration must expose:

```text
identity
architecture boundary
prerequisites
secret names
step-by-step bootstrap
deterministic test command
physical/provider test when available
expected markers
evidence location
known non-claims
historical source lineage
```
