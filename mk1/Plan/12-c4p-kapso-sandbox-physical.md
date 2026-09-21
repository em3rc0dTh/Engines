# Plan 12 — C4P Kapso sandbox physical proof

Date: 2026-09-07
Branch: `build/mk1-c4p-kapso-official`
Base: `build/mk1-customer-channels-integrated`

## Objective

Physically prove real WhatsApp traffic through Kapso Sandbox into the existing `RegisterNewCustomer` Engine without using Kapso Workflows/Agent/MCP.

## Gates

```text
C4KS-0 provider research / architecture          ✅
C4KS-1 Kapso v2 transport implementation         ✅ BUILT
C4KS-2 deterministic CI                          🧪 RUNNING
C4KS-3 sandbox test session activation            ⏳ EDUARDO
C4KS-4 public HTTPS webhook                       ⏳ EDUARDO
C4KS-5 real WhatsApp registration E2E             ⏳ EDUARDO
C4KS-6 evidence receipt / bounded sandbox seal    ⏳
```

## Human target

```text
real WhatsApp account
→ activate Kapso Sandbox session
→ send initial message
→ receive consent buttons
→ choose Sí, registrarme
→ phone prefilled when Kapso supplies phone identity
→ provide remaining Temporal-required fields
→ intentionally submit one invalid field
→ same Workflow recovers
→ Customer CREATED
→ receive Registro completado
```

## Environment

```text
KAPSO_API_KEY
KAPSO_WEBHOOK_SECRET
KAPSO_PHONE_NUMBER_ID
KAPSO_GRAPH_API_VERSION=v24.0
```

Physical runner:

```text
localhost:8791
POST /webhooks/kapso
```

A Cloudflare Quick Tunnel may be used for this development-only callback.

## Non-claims

Sandbox proof is not production-number certification. Templates, broadcasts/campaigns, production hosting, production billing behavior, Appointment, Scheduler runtime, Agent, MCP and LLM routing remain outside scope.
