# Brainstorming 08 — Kapso sandbox as first WhatsApp physical path

Date: 2026-09-07
Branch: `build/mk1-c4p-kapso-official`

## Decision

Use Kapso as the immediate external WhatsApp transport, starting with **Kapso Sandbox** before consuming a constrained/temporary dedicated number.

The Engine remains first:

```text
real WhatsApp user
→ Kapso Sandbox / Kapso WhatsApp API
→ signed phone-number webhook
→ WhatsAppAdapter
→ ChannelExecutionCore
→ PostgreSQL
→ Temporal RegisterNewCustomer
→ Customer
→ Kapso WhatsApp API reply
```

Kapso Workflows, Agents, Functions and MCP are intentionally not used. They would duplicate orchestration that belongs to Temporal/Engines.

## Why sandbox first

Kapso documents that sandbox supports real text and interactive WhatsApp messages plus phone-number webhooks. That is sufficient for the current bounded flow: consent → name/phone/email as required by Temporal → Customer completion. Templates and production-only behavior are outside this gate.

## Identity correction

WhatsApp can now deliver BSUID identity without a phone number. Therefore the provider-neutral inbound contract must allow `senderPhone` to be absent. When a verified phone exists it may prefill Customer phone after consent. When it does not, the Engine asks for phone according to Customer policy; the adapter must never invent one.

## Claim boundary

A successful sandbox test proves a real external Kapso/WhatsApp provider path, but does not certify a production business number, production templates, campaigns, provider billing, or production hosting.
