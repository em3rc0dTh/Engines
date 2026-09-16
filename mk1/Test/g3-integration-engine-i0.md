# G3-I0 — Integration canonical contracts + authority boundary

## Status

**CANDIDATE — certification pending dedicated gate evidence and exact-final-head reseal.**

## Scope

G3-I0 introduces only the provider-neutral Integration boundary:

```text
Temporal/domain
  → IntegrationCommand
  → Integration boundary

provider-authenticated/normalized input
  → IntegrationEvent
  → Temporal/domain
```

Executable surface:

```text
mk1/runtime/src/contracts/integration-engine/types.ts
mk1/runtime/src/contracts/integration-engine/validation.ts
mk1/runtime/src/contracts/integration-engine/index.ts
mk1/runtime/src/contracts/integration-engine/integration-engine.contract.test.ts
mk1/runtime/scripts/certify-integration-g3-i0.ts
mk1/runtime/scripts/verify-integration-certification-ledger.ts
```

## Required proof

The dedicated gate must prove:

```text
provider-neutral command/event validation
exact canonical top-level fields
business-scoped stable outbound operation identity
business+connection-scoped stable provider-event identity
exactly one subjectRef/targetRef per command
secret-like material rejected recursively
provider HTTP/SDK mechanics rejected from canonical payloads
Integration contracts remain decoupled from Scheduler/Services/CTA/Temporal implementation modules
protected Scheduler/Services/Appointment/CTA/channel regressions remain green
```

## Truth boundary

G3-I0 does not provide connection persistence, secret storage, external delivery, retry persistence, HTTP webhook ingress, webhook authentication, dedup persistence, a real provider adapter or Temporal Integration composition.

Existing Telegram and WhatsApp/Kapso interactive transports remain CTA/channel evidence; they are not Integration certification.

## Terminal marker

Promotion requires the dedicated workflow to emit:

```text
INTEGRATION_G3_I0_CERTIFICATION_PASS
```

This receipt must be promoted to `✅ CERTIFIED` only after candidate evidence exists, the machine ledger advances to `G3-I1 NEXT`, and the same G3-I0 workflow passes again on the documentation-complete exact branch head.
