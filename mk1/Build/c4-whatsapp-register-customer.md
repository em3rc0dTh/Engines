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

READY FOR deterministic harness testing. Real Meta Cloud API and Kapso accounts remain **NOT CERTIFIED**.
