# C4 WhatsApp → RegisterNewCustomer

## Brainstorming / Quarry

WhatsApp can provide a verified sender phone, avoiding a redundant question. Provider webhook verification and delivery differ, while Customer and Temporal semantics do not.

## Design / Plan

`WhatsAppTransportPort` isolates verification and send. Meta Cloud API and Kapso are implementations below it. Only `VerifiedWhatsAppInbound` reaches the common adapter. Consent YES starts V2 with sender phone as a candidate patch; consent NO produces no operation. Text mapping requires a render intent derived from Temporal.

## Golden dataset / Evidence

- WA-RNC-001 verified inbound: PASS
- WA-RNC-002 sender phone prefill: PASS
- WA-RNC-003 text reply: PASS
- WA-RNC-004 interactive consent: PASS
- WA-RNC-005 invalid signature rejected: PASS
- shared policy/core, Telegram, WebChat and C1B regression: PASS
- Agent=false; MCP=false; Scheduler=false

## Current provider status

The original C4 design above remains the common WhatsApp adapter contract.

As of the 2026-09-22 pre-Agent campaign:

~~~text
Kapso Sandbox RegisterNewCustomer              ✅ PHYSICALLY VERIFIED
Kapso native RegisterNewAppointment            ✅ PHYSICALLY VERIFIED
Kapso CREATE_MANAGED_ENTITY                    ✅ PHYSICALLY VERIFIED
Kapso SELECT_MANAGED_ENTITY                    ✅ PHYSICALLY VERIFIED
Kapso × ManagedEntity                          ✅ SEALED
Meta Cloud API transport                       ✅ DETERMINISTIC PASS
direct Meta physical Appointment path          ⏳ NOT CLAIMED
~~~

See the Channel × ManagedEntity build note and the 2026-09-22 physical/final seal receipts.

Production webhook hosting, dedicated production-number operations, Agent and MCP remain outside this bounded certification.
