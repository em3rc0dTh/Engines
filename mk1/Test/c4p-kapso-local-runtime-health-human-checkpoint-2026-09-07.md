# C4P Kapso — Local Runtime Health Human Checkpoint

Date: 2026-09-07
Branch: `build/mk1-c4p-kapso-official`

## Human observation

The operator started the local Kapso runtime stack and confirmed the physical runner health endpoint from the development machine.

Observed response:

```json
{"ok":true,"provider":"KAPSO","agent":false,"mcp":false}
```

An initial transient `Recv failure: Connection reset by peer` occurred while the container was still starting; a subsequent health request succeeded without a restart.

## What this proves

```text
local whatsapp-kapso container started       ✅
local HTTP runner reachable on :8791         ✅
provider marker KAPSO                        ✅
Agent                                        false
MCP                                          false
```

## What remains open

This checkpoint does not yet prove public tunnel delivery, Kapso webhook delivery, HMAC verification from a real Kapso event, outbound Kapso API delivery, Temporal creation from real WhatsApp traffic, Customer persistence from real provider traffic, or the physical C4P seal.

Next physical boundary:

```text
public HTTPS tunnel
→ Kapso whatsapp.message.received v2 webhook
→ real WhatsApp message
→ signed inbound
→ Engines
→ Temporal RegisterNewCustomer
→ Customer
→ outbound Kapso reply
```
