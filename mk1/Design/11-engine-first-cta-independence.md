# Design 11 — Engine-first CTA independence

Date: 2026-09-04
Status: ARCHITECTURE INVARIANT

## Decision

Engines is the product core. CTA is not the Engine and never becomes the Engine.

All client-facing ingress surfaces are replaceable transports/adapters around the same canonical runtime.

```text
                     ┌───────────────────────┐
                     │        ENGINES        │
                     │                       │
                     │ ChannelExecutionCore  │
                     │ Temporal Workflows    │
                     │ Customer              │
                     │ Services              │
                     │ Scheduler             │
                     │ Persistence           │
                     └───────────▲───────────┘
                                 │
                    Canonical CTA boundary
                                 │
        ┌──────────────┬─────────┼─────────┬──────────────┐
        │              │         │         │              │
       CLI          HTTP/API   WebChat  Telegram      WhatsApp
        │              │         │         │              │
     adapter         adapter    adapter    adapter         adapter
```

The transport may change. The Engine does not.

## Consequence

CLI, HTTP/Postman, WebChat, Telegram and WhatsApp are peer ingress implementations of the CTA boundary.

They are not successive rewrites of the Engine and they do not own business behavior.

Each transport is responsible only for:

```text
connection/session mechanics
provider authentication/verification
provider event identity
conversation/sender identity
transport payload normalization
canonical action/input mapping
outbound rendering
provider retry/ack mechanics
```

After normalization, every transport must enter the same canonical execution path.

## Canonical execution path

```text
Client
  ↓
Transport
  ↓
CTA Adapter
  ↓
CanonicalChannelEnvelope / canonical CTA command
  ↓
ChannelExecutionCore / CTA execution boundary
  ↓
Temporal
  ↓
Engine Workflow Library
  ↓
Customer / Services / Scheduler / persistence authorities
```

## What must remain transport-independent

The following must never depend on Telegram, WhatsApp, WebChat, CLI or HTTP/Postman:

- Customer domain rules;
- Service/Offering ownership and revisions;
- eligibility/recommendation policy;
- Scheduler capacity and reservation truth;
- Appointment Workflow phases and transitions;
- idempotent business effects;
- PostgreSQL business authority;
- Temporal orchestration semantics.

Provider-specific conditions terminate before these boundaries.

## Telegram

Telegram is only a CTA transport implementation:

```text
Telegram Bot API
  ↓
Telegram transport runner
  ↓
TelegramAdapter
  ↓
canonical CTA/channel contract
  ↓
Engines
```

Telegram does not introduce a Telegram Appointment Workflow, Telegram Customer model, Telegram Services policy or Telegram Scheduler.

## WhatsApp

WhatsApp is only a CTA transport implementation:

```text
Official WhatsApp provider transport
  ↓
Meta Cloud API or another official provider implementation
  ↓
WhatsAppAdapter
  ↓
canonical CTA/channel contract
  ↓
Engines
```

Meta direct vs Kapso is therefore an infrastructure/transport choice, not an Engine architecture choice.

Kapso may implement the WhatsApp transport port if it remains an official supported route, but it may not become the canonical Workflow, Services, Scheduler, Customer or persistence authority.

## Historical interpretation

The existing surfaces are understood as:

```text
MK0 CLI             = CTA transport/interface proof
MK0 HTTP/Postman    = CTA transport/interface proof
MK1 WebChat         = CTA transport/interface proof + durable channel UX proof
MK1 Telegram        = next CTA transport
MK1 WhatsApp        = next CTA transport
```

The Engine underneath remains the same architectural system and evolves independently through its own gates such as Services and Scheduler.

## Branch implication

Channel branches describe transport/CTA work only.

Engine-domain branches remain separate, for example:

```text
build/mk1-c2-telegram
build/mk1-c4-whatsapp

build/mk1-s8-services-final-certification
build/mk1-g2-s0-scheduler-contracts
```

A channel branch must not absorb domain-engine construction merely because the channel exercises that domain.

## Forbidden coupling

- provider-specific domain tables;
- provider-specific Appointment Workflow variants;
- Telegram/WhatsApp branches becoming the source of Service or Scheduler truth;
- direct provider writes into Customer/Services/Scheduler/Appointment persistence;
- transport SDK types escaping into domain contracts;
- Kapso/Meta/Telegram workflow engines replacing Temporal;
- a channel deciding business policy.

## Architecture sentence

> Engines comes first. CTA is a replaceable ingress boundary. CLI, API, WebChat, Telegram and WhatsApp are only different ways for a client to connect to the same Engine.
